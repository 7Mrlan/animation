import {
  createSwimMotion,
  advanceSwimMotionWithCurrent,
  grabWhale,
  releaseWhale,
  tossWhale,
  requestBreach,
  pursuePrey,
  finishPursuit,
  recordFeeding,
  deferAutoBreach,
  swimEffort,
  type SwimMotion,
  type Whale,
} from './deepseek-motion'
import {
  clamp,
  createWater,
  sampleWater,
  disturbWater,
  advanceWater,
  surfaceSplashPower,
  oceanHeight,
  oceanRipples,
  oceanCurrent,
  type WaterCurrent,
  windGust,
  strikeWater,
  waterImpactShape,
  type ImpactShape,
  type Water,
} from './deepseek-water'
import {
  createPreyScene,
  advancePreyScene,
  findPreyTarget,
  trackPreyTarget,
  getPreyPose,
  hasLivePrey,
  type PreyPose,
  type PreyScene,
  type Prey,
} from './deepseek-prey'
import {
  createWhaleTurn,
  advanceWhaleTurn,
  whaleTurnFrame,
  WHALE_TAIL_PIVOTS,
  type WhaleTurn,
  type TailPivot,
} from './deepseek-whale-turn'
import { WHALE_ATLAS_CELL, WHALE_ATLAS_COLUMNS } from './deepseek-whale-atlas'
import { soloPose, type SoloPose } from './deepseek-solo'
import {
  createSurfaceEffects,
  advanceSurfaceEffects,
  addWindFoam,
  addImpactFoam,
  addFlukePrint,
  breakingCrests,
  footprintCalm,
  surfaceMarkStrength,
  type SurfaceEffects,
  type SurfaceMark,
} from './deepseek-surface-effects'

/** 水印的平滑水斑与细反光共享同一个生命周期。 */
type FootprintVisual = { root: SVGGElement; patch: SVGEllipseElement; glint: SVGPathElement }

/** 活跃水滴拥有 DOM 节点；过期后节点归还池而不是删除重建。 */
type Drop = {
  el: SVGEllipseElement
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
}
/** 浮升气泡在穿越水面后回收。 */
type Bubble = { el: SVGCircleElement; x: number; y: number; age: number; life: number; r: number }
/** 短寿命的水冠，强度来自实际穿越速度。 */
type Splash = { el: SVGPathElement; x: number; y: number; age: number; life: number; power: number }
/** 首次入水掀起的水帘比后续细线浪冠更短促，随同一冲击预算展开。 */
type ImpactCrown = { el: SVGPathElement; x: number; age: number; shape: ImpactShape }

/** 入水点的余波独立于鲸鱼移动，节点归还池复用。 */
type Ripple = { elements: readonly SVGEllipseElement[]; x: number; age: number; shape: ImpactShape }
/** 换气是短寿命气雾，不按落水水滴的重力轨迹绘制。 */
type Breath = { el: SVGPathElement; x: number; y: number; age: number }
/** 尾迹保存真实时间，60Hz 与 120Hz 下覆盖相同长度的运动历史。 */
type WakePoint = Readonly<{ x: number; y: number; time: number }>

/** React 只管理生命周期，逐帧状态由独立场景持有。 */
type SceneController = { setPlaying: (next: boolean) => void; dispose: () => void }

/** 部件引用随节点池一并复用，逐帧不查询或重建猎物的矢量结构。 */
type PreyVisual = {
  /** 个体的位置和朝向容器。 */
  root: SVGGElement
  /** 头胸或鱼身，保持眼睛与鳃盖稳定。 */
  body: SVGUseElement
  /** 独立鱼尾或磷虾分节腹尾。 */
  tail: SVGUseElement
  /** 仅磷虾使用的腹下划游附肢。 */
  legs: SVGUseElement
}

/** 每个实例独立持有时钟、粒子和事件；暂停与恢复保留当前姿态。 */
export function createDeepSeekScene(root: HTMLElement, reduced: boolean): SceneController {
  const abort = new AbortController()
  /** 缺少模板契约时明确报错，避免只渲染半个场景。 */
  function q<T extends Element>(selector: string): T {
    const el = root.querySelector<T>(selector)
    if (!el) throw new Error(`Missing DeepSeek scene element: ${selector}`)
    return el
  }
  /** 共享撤销信号确保卸载时移除所有输入监听器。 */
  function listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ): void {
    target.addEventListener(type, listener, { signal: abort.signal })
  }

  const scene = q<HTMLElement>('.ds-scene')
  const handle = q<HTMLButtonElement>('.ds-whale-handle')
  const whale = q<SVGElement>('.ds-whale')
  const whaleBank = q<SVGGElement>('.ds-whale-bank')
  const whaleBelly = q<SVGEllipseElement>('.ds-whale-belly')
  const bodyFrame = q<SVGImageElement>('.ds-whale-body-frame')
  const tailFrame = q<SVGImageElement>('.ds-whale-tail-frame')
  const whaleTail = q<SVGElement>('.ds-whale-tail')
  const whaleOcclusion = q<SVGElement>('.ds-whale-occlusion')
  const surfaceWhale = q<SVGElement>('.ds-surface-whale')
  const surfaceProfile = q<SVGPathElement>('.ds-surface-whale path')
  const back = q<SVGElement>('.ds-water-back')
  const water = q<SVGElement>('.ds-water-main')
  const front = q<SVGElement>('.ds-water-front')
  const veil = q<SVGElement>('.ds-water-veil')
  const surface = q<SVGElement>('.ds-surface')
  const foam = q<SVGGElement>('.ds-foam')
  const footprintGroup = q<SVGGElement>('.ds-footprints')
  const waterClip = q<SVGElement>('.ds-water-clip')
  const airClip = q<SVGPathElement>('.ds-air-clip')
  const flows = [...root.querySelectorAll<SVGPathElement>('.ds-flow')]
  const wakes = [...root.querySelectorAll<SVGPathElement>('.ds-wake')]
  const dropGroup = q<SVGElement>('.ds-droplets')
  const bubbleGroup = q<SVGElement>('.ds-bubbles')
  const splashGroup = q<SVGElement>('.ds-splashes')
  const preyGroup = q<SVGGElement>('.ds-prey')
  const rippleGroup = q<SVGGElement>('.ds-ripples')
  const breathGroup = q<SVGGElement>('.ds-breaths')
  const feedingPulse = q<SVGPathElement>('.ds-feed-pulse')
  const snores = [...root.querySelectorAll<SVGTextElement>('.ds-snores text')]
  const snoreGroup = q<SVGGElement>('.ds-snores')
  const note = q<HTMLElement>('.ds-note')
  const label = q<HTMLElement>('.ds-state')
  const hint = q<HTMLElement>('.ds-hint')
  const media = { matches: reduced }
  const ns = 'http://www.w3.org/2000/svg'

  let waterState: Water = createWater()
  let surfaceEffects: SurfaceEffects = createSurfaceEffects()
  const foamNodes: Map<number, SVGPathElement> = new Map<number, SVGPathElement>()
  const foamPool: SVGPathElement[] = []
  const footprintNodes: Map<number, FootprintVisual> = new Map<number, FootprintVisual>()
  const footprintPool: FootprintVisual[] = []
  let flowDistance: number = 0
  let previousDepth: number | null = null
  let nextFootprintAt: number = 0
  /** 预生成的运动补间直接用于主场景，不在浏览器计算光流或叠加镜像。 */
  let whaleTurn: WhaleTurn = createWhaleTurn(-1)
  let renderedWhaleFrame: number = -1
  /** 真实运行每次刷新/重播独立采样；纯模型仍可用指定种子复现。 */
  const entropy: Uint32Array = crypto.getRandomValues(new Uint32Array(2))
  let prey: PreyScene = createPreyScene(entropy[0])
  const preyNodes: Map<number, PreyVisual> = new Map<number, PreyVisual>()
  const preyPool: PreyVisual[] = []
  const fish = {
    x: 180,
    y: 116,
    vx: 0,
    vy: 0,
    angle: 0,
    flip: 1,
    targetX: 180,
    targetY: 116,
    direction: -1,
  }
  const drops: Drop[] = [],
    bubbles: Bubble[] = [],
    splashes: Splash[] = []
  /** 仅保存过期节点，活跃数和池容量共同受发射上限约束。 */
  const dropPool: SVGEllipseElement[] = []
  const bubblePool: SVGCircleElement[] = []
  const splashPool: SVGPathElement[] = []
  /** 每次冲击只创建三条余波，连续邀请也有固定容量。 */
  const ripples: Ripple[] = []
  const ripplePool: (readonly SVGEllipseElement[])[] = []
  const breaths: Breath[] = []
  const breathPool: SVGPathElement[] = []
  const crowns: ImpactCrown[] = []
  const crownPool: SVGPathElement[] = []
  let feedingAge: number = 1
  let wakeHistory: WakePoint[] = []
  let lastImpactId: number = 0
  let lastBreathAt: number = -1
  /** 视觉衔接保留当前权重，追逐或拖动接管时不重置到另一张姿态。 */
  let renderedPose: SoloPose = { pitch: 0, surface: 0, tail: 0, rest: 0, bank: 0 }
  let renderedEffort: number = 0.2
  let surfaceExposure: number = 0
  /** 换气后先沉回水线再解除遮挡，捕食接管也不会让旧尾鳍突然弹出。 */
  let surfaceOccluded: boolean = false
  /** 布局尺寸只在 resize 时读取，手柄和图形共用同一坐标转换。 */
  let width: number = scene.clientWidth
  let height: number = scene.clientHeight
  let dragBounds: DOMRect | null = null
  let frame = 0,
    last: number | null = null,
    time = 0,
    dragId: number | null = null,
    grabX = 0,
    grabY = 0
  let playing = false,
    disposed = false
  let swimming = false,
    tailPhase = 0,
    splashCooldown = 0,
    bubbleClock = 0
  let lastMode = '',
    lastWet = false,
    keyboardMove = false,
    inputAt = 0
  let seed: number = entropy[1]
  /** 阵风只偶尔吹散浪尖，不让海面持续喷泉化。 */
  let windCooldown: number = 1.8
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  /** SVG 粒子首次使用时才创建，后续从节点池复用。 */
  function node<K extends keyof SVGElementTagNameMap>(
    tag: K,
    parent: Element,
  ): SVGElementTagNameMap[K] {
    const el = document.createElementNS(ns, tag)
    parent.appendChild(el)
    return el
  }
  /** 静态偏好冻结环境浪相位，不启动背景循环。 */
  function baseY(x: number): number {
    const clock: number = reduced ? 0 : time
    return oceanHeight(x, clock) - oceanRipples(x, clock) * footprintCalm(surfaceEffects, x)
  }
  /** 碰撞检测和实际水面使用相同的水位，避免浪花悬空。 */
  function waterY(x: number): number {
    return baseY(x) + sampleWater(waterState, x)
  }
  /** 每帧只采样一次海面，分层色带复用采样，不重复计算三套三角函数。 */
  function surfaceSamples(): readonly number[] {
    return Array.from({ length: 61 }, (_value: unknown, i: number): number => waterY(i * 6))
  }
  /** 二次曲线平滑有限采样点，减少路径字符串和绘制复杂度。 */
  function wavePath(samples: readonly number[], offset: number): string {
    let d: string = `M0 ${(samples[0] + offset).toFixed(1)}`
    for (let i: number = 1; i < samples.length - 1; i++) {
      d += `Q${i * 6} ${(samples[i] + offset).toFixed(1)} ${i * 6 + 3} ${((samples[i] + samples[i + 1]) / 2 + offset).toFixed(1)}`
    }
    return `${d}L360 ${(samples[60] + offset).toFixed(1)}`
  }
  /** 局部冲击返回新快照，水面模型不修改传入状态。 */
  function impulse(x: number, strength: number): void {
    if (media.matches) return
    waterState = disturbWater(waterState, x, strength)
  }
  /** 水滴发射与水面冲击分离，风吹飞沫不制造鲸鱼落水般的水坑。 */
  function emitDrops(x: number, power: number, direction: number): void {
    if (!playing || media.matches || drops.length >= 72) return
    const y = waterY(x) - 2,
      p = clamp(power, 0.12, 2.5)
    const count = Math.min(72 - drops.length, Math.round(3 + p * 6))
    for (let i = 0; i < count; i++) {
      const el = dropPool.pop() ?? node('ellipse', dropGroup)
      el.style.display = ''
      el.setAttribute('class', 'ds-drop')
      el.style.fill = i % 3 !== 0 ? 'var(--ds-white)' : 'var(--ds-blue)'
      const spread = (random() - 0.5) * (95 + p * 95)
      drops.push({
        el,
        x: x + (random() - 0.5) * 14,
        y,
        vx: spread + direction * 0.1,
        vy: -(48 + random() * 105) * Math.sqrt(p),
        age: 0,
        life: 0.5 + random() * 0.45,
        size: 0.7 + random() * 1.6,
      })
    }
  }
  /** 两侧喷散的破水飞沫保留各自初速度，不把落水画成一束竖直喷泉。 */
  function impactDrops(x: number, shape: ImpactShape): void {
    const count: number = Math.min(72 - drops.length, Math.round(6 + shape.power * 14))
    for (let index: number = 0; index < count; index++) {
      const side: number = index % 2 === 0 ? -1 : 1
      const el: SVGEllipseElement = dropPool.pop() ?? node('ellipse', dropGroup)
      const y: number = waterY(x) - 2
      el.style.display = ''
      el.setAttribute('class', 'ds-drop')
      el.style.fill = index % 3 === 0 ? 'var(--ds-white)' : '#9cccf0'
      drops.push({
        el,
        x: x + side * shape.width * (0.15 + random() * 0.45),
        y,
        vx: side * (35 + random() * 75) * Math.sqrt(shape.power) + fish.vx * 0.12,
        vy: -Math.min(
          (70 + random() * 130) * Math.sqrt(shape.power),
          Math.sqrt(520 * Math.max(0, y - 30)),
        ),
        age: 0,
        life: 0.6 + random() * 0.5,
        size: 0.9 + random() * 1.6,
      })
    }
  }
  /** 尾水和吞食反馈共用有上限的气泡池，连续捕食不会堆积节点。 */
  function addBubble(x: number, y: number, radius: number, life: number): void {
    if (bubbles.length >= 18 || reduced || !playing) return
    const el: SVGCircleElement = bubblePool.pop() ?? node('circle', bubbleGroup)
    el.style.display = ''
    el.setAttribute('class', 'ds-bubble')
    bubbles.push({ el, x, y, age: 0, life, r: radius })
  }
  /** 同一接触事件的水冠与传播波共享能量来源。 */
  function burst(x: number, power: number, direction: number): void {
    if (!playing || media.matches) return
    const y: number = waterY(x) - 2
    const p: number = clamp(power, 0.12, 2.5)
    surfaceEffects = addImpactFoam(surfaceEffects, x, waterImpactShape(p * 90, 0.25))
    emitDrops(x, p, direction)
    const el = splashPool.pop() ?? node('path', splashGroup)
    el.style.display = ''
    el.setAttribute('class', 'ds-splash')
    splashes.push({ el, x, y, age: 0, life: 0.52, power: p })
    impulse(x, 36 + p * 34)
    impulse(x - 22, -18 - p * 17)
    impulse(x + 22, -18 - p * 17)
  }
  /** 入水事件只消费一次，水冠、传播波和扩散圈共用同一能量预算。 */
  function landingImpact(x: number, speed: number, area: number): void {
    if (!playing || reduced) return
    const shape: ImpactShape = waterImpactShape(speed, area)
    surfaceEffects = addImpactFoam(surfaceEffects, x, shape)
    waterState = strikeWater(waterState, x, speed, area)
    impactDrops(x, shape)
    if (crowns.length < 4) {
      const sheet: SVGPathElement = crownPool.pop() ?? node('path', splashGroup)
      sheet.style.display = ''
      sheet.setAttribute('class', 'ds-impact-sheet')
      crowns.push({ el: sheet, x, age: 0, shape })
    }
    const el: SVGPathElement = splashPool.pop() ?? node('path', splashGroup)
    el.style.display = ''
    el.setAttribute('class', 'ds-splash')
    splashes.push({
      el,
      x,
      y: waterY(x),
      age: 0,
      life: 0.45 + shape.power * 0.1,
      power: shape.power,
    })
    if (ripples.length < 6) {
      const elements: readonly SVGEllipseElement[] =
        ripplePool.pop() ??
        Array.from({ length: 3 }, (): SVGEllipseElement => node('ellipse', rippleGroup))
      for (const ellipse of elements) {
        ellipse.setAttribute('class', 'ds-ripple')
        ellipse.style.display = ''
      }
      ripples.push({ elements, x, age: 0, shape })
    }
    scene.dataset.impactPower = shape.power.toFixed(3)
  }
  /** 气雾只在贴水动作到位后出现一次，避免水下巡游持续冒蒸汽。 */
  function breathe(x: number): void {
    if (breaths.length >= 2 || reduced) return
    const el: SVGPathElement = breathPool.pop() ?? node('path', breathGroup)
    el.setAttribute('class', 'ds-breath')
    el.setAttribute('d', 'M-5 0C-13-4-9-9-4-7C-7-14 3-16 5-8C13-11 16-3 7 0Z')
    el.style.display = ''
    breaths.push({ el, x, y: waterY(x) - 3, age: 0 })
  }
  /** 场景持有快照，运动积分不写入 DOM 或输入对象。 */
  let swimmer: SwimMotion = createSwimMotion(readWhale(), entropy[1])
  /** 自动状态不使用 live region，避免巡游不断打断读屏。 */
  function setMode(mode: string): void {
    if (mode === lastMode) return
    lastMode = mode
    const states: Record<string, string[]> = {
      idle: ['拖动 · 双击鲸跃', 'DRAG INTO THE BLUE', '拖入水中看它巡游，双击小鲸，邀它跃出水面。'],
      air: ['准备入水', 'A LITTLE DEEPER', '向上轻甩再松手，也可以邀请小鲸起跳。'],
      surface: ['水面嬉游', 'MAKE A LITTLE SPLASH', '贴着水面划过，会甩出更大的浪花。'],
      breathe: ['贴水换气', 'A BREATH ABOVE', '摆尾上浮，换口气，露背滑过后再潜入。'],
      deep: ['深浅巡游', 'FOLLOW THE CURRENT', '它会深潜、绕弯、上浮，偶尔跃出水面。'],
      gather: ['蓄力上浮', 'READY TO TAKE FLIGHT', '小鲸正在蓄力，准备冲出水面。'],
      prepare: ['下潜准备', 'DEEP BEFORE THE LEAP', '先潜入水下，再摆尾加速上冲。'],
      glide: ['顺势滑行', 'COAST THROUGH THE BLUE', '有力推进后，放松尾巴顺势滑行。'],
      dash: ['短促冲游', 'A PLAYFUL BURST', '摆尾提速，绕个弯，再顺势回稳。'],
      sound: ['抬尾下潜', 'ONE LAST FLUKE', '头部先潜下，尾鳍最后没入水面。'],
      spyhop: ['探头张望', 'A CURIOUS LOOK', '抬头看看水面，再轻轻滑回水中。'],
      roll: ['侧身嬉游', 'A GENTLE SWAY', '沿着宽弧侧身游过。'],
      tailSlap: ['轻拍海面', 'A LITTLE TAIL SLAP', '轻轻拍一下水，再继续巡游。'],
      rest: ['浮休片刻', 'REST WITH THE CURRENT', '随水流轻轻起伏，冒出小小的瞌睡气泡。'],
      breach: ['鲸跃', 'A MOMENT ABOVE', '起跳、舒展、落水，再潜回蓝色里。'],
      launch: ['加速上冲', 'POWER THROUGH THE BLUE', '摆尾加速，冲出水面。'],
      lunge: ['加速捕食', 'A QUICK LUNGE', '短促冲刺，掠过鱼群。'],
      feed: ['吞食滑行', 'A MOUTHFUL OF BLUE', '享用小小收获，顺着惯性继续滑行。'],
      recover: ['沉入蔚蓝', 'BACK TO THE CURRENT', '落水后顺势下潜，轻轻回稳，再继续巡游。'],
      hunt: [
        '追逐小小来客',
        'A LITTLE CHASE',
        '鱼虾聚散、逃逸，小鲸加速追逐，来客游远后继续巡游。',
      ],
    }
    const s = states[mode]
    label.textContent = s[0]
    hint.textContent = s[1]
    note.textContent = s[2]
  }
  /** 暂停时模型直接返回原快照。 */
  function updatePhysics(dt: number): void {
    waterState = advanceWater(waterState, dt)
  }
  /** 命中区域使用 transform 跟随，避免每帧改写布局坐标。 */
  function positionHandle(): void {
    handle.style.transform = `translate3d(${(fish.x / 360) * width}px, ${(fish.y / 300) * height}px, 0) translate(-50%, -50%)`
  }
  /** 仅向模型传递物理量，避免视觉角度等可变字段泄漏进不可变快照。 */
  function readWhale(): Whale {
    return { x: fish.x, y: fish.y, vx: fish.vx, vy: fish.vy, direction: fish.direction }
  }
  /** 首次使用才创建三组部件，后续更换物种只重设引用。 */
  function createPreyVisual(): PreyVisual {
    const root: SVGGElement = node('g', preyGroup)
    return { root, body: node('use', root), tail: node('use', root), legs: node('use', root) }
  }
  /** 个体共用本地矢量形状；离开或被吞食后归还节点池。 */
  function drawPrey(): void {
    const active: Set<number> = new Set<number>(prey.animals.map((p: Prey): number => p.id))
    for (const [id, visual] of preyNodes) {
      if (!active.has(id)) {
        visual.root.style.display = 'none'
        preyPool.push(visual)
        preyNodes.delete(id)
      }
    }
    for (const animal of prey.animals) {
      let visual: PreyVisual | undefined = preyNodes.get(animal.id)
      if (visual === undefined) {
        visual = preyPool.pop() ?? createPreyVisual()
        visual.body.setAttribute('href', `#${preyGroup.dataset[animal.kind]}`)
        visual.tail.setAttribute('href', `#${preyGroup.dataset[`${animal.kind}Tail`]}`)
        visual.legs.setAttribute('href', `#${preyGroup.dataset.shrimpLegs}`)
        visual.legs.style.display = animal.kind === 'shrimp' ? '' : 'none'
        visual.root.setAttribute('class', `ds-prey-animal ds-prey-${animal.kind}`)
        visual.root.style.display = ''
        preyNodes.set(animal.id, visual)
      }
      const caught: number =
        animal.caughtAt === null ? 0 : clamp((prey.clock - animal.caughtAt) / 0.2, 0, 1)
      const x: number = animal.x + (fish.x + fish.direction * 18 - animal.x) * caught
      const y: number = animal.y + (fish.y - animal.y) * caught
      const pose: PreyPose = getPreyPose(animal, prey.clock)
      const heading: number = Math.atan2(
        (Math.sin(pose.heading) * height) / 300,
        (Math.cos(pose.heading) * width) / 360,
      )
      const direction: number = Math.cos(heading) >= 0 ? 1 : -1
      const rotation: number = heading - (direction === -1 ? Math.PI : 0)
      const angle: number = (Math.atan2(Math.sin(rotation), Math.cos(rotation)) * 180) / Math.PI
      const size: number = animal.size * (1 - caught * 0.8)
      visual.root.setAttribute(
        'transform',
        `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(size * Math.min(1, height / 300 / (width / 360))).toFixed(3)} ${(size * Math.min(1, width / 360 / (height / 300))).toFixed(3)}) rotate(${angle.toFixed(1)}) scale(${direction} 1)`,
      )
      visual.tail.setAttribute(
        'transform',
        `rotate(${pose.tail.toFixed(1)} ${animal.kind === 'fish' ? '-8.5 0' : '-2.5 0.5'})`,
      )
      visual.legs.setAttribute('transform', `rotate(${pose.legs.toFixed(1)} 0 1)`)
      visual.root.style.opacity = String((1 - caught) * clamp(1 - (animal.y - 170) / 600, 0.8, 1))
    }
    scene.dataset.preyCount = String(
      prey.animals.filter((p: Prey): boolean => p.caughtAt === null).length,
    )
    scene.dataset.consumed = String(prey.consumed)
  }
  /** 浮沫有局部形状和寿命，反光留在水印内，不重新绘制整条白色海岸线。 */
  function drawSurfaceMarks(): void {
    const foamIds: Set<number> = new Set<number>(
      surfaceEffects.foam.map((mark: SurfaceMark): number => mark.id),
    )
    for (const [id, element] of foamNodes) {
      if (foamIds.has(id)) continue
      element.style.display = 'none'
      foamPool.push(element)
      foamNodes.delete(id)
    }
    for (const mark of surfaceEffects.foam) {
      let element: SVGPathElement | undefined = foamNodes.get(mark.id)
      if (element === undefined) {
        element = foamPool.pop() ?? node('path', foam)
        element.style.display = ''
        element.setAttribute('class', 'ds-foam-mark')
        element.setAttribute('stroke-dasharray', '3.5 2.5 1.5 3')
        foamNodes.set(mark.id, element)
      }
      const radius: number = mark.radius * (1 + (Math.max(0, mark.age) / mark.life) * 0.3)
      element.setAttribute(
        'd',
        `M${mark.x - radius} ${waterY(mark.x - radius) + 3}Q${mark.x} ${waterY(mark.x) + 6} ${mark.x + radius} ${waterY(mark.x + radius) + 3}M${mark.x - radius * 0.6} ${waterY(mark.x) + 6}q${radius * 0.6} 3 ${radius * 1.2} 0`,
      )
      element.style.opacity = String(surfaceMarkStrength(mark) * 0.8)
    }
    const printIds: Set<number> = new Set<number>(
      surfaceEffects.footprints.map((mark: SurfaceMark): number => mark.id),
    )
    for (const [id, visual] of footprintNodes) {
      if (printIds.has(id)) continue
      visual.root.style.display = 'none'
      footprintPool.push(visual)
      footprintNodes.delete(id)
    }
    for (const mark of surfaceEffects.footprints) {
      let visual: FootprintVisual | undefined = footprintNodes.get(mark.id)
      if (visual === undefined) {
        visual = footprintPool.pop()
        if (visual === undefined) {
          const root: SVGGElement = node('g', footprintGroup)
          visual = { root, patch: node('ellipse', root), glint: node('path', root) }
          visual.patch.setAttribute('class', 'ds-footprint-patch')
          visual.glint.setAttribute('class', 'ds-footprint-glint')
        }
        visual.root.style.display = ''
        footprintNodes.set(mark.id, visual)
      }
      const radius: number = mark.radius * (0.75 + clamp(mark.age / mark.life, 0, 1) * 0.25)
      const y: number = waterY(mark.x) + 8
      visual.patch.setAttribute('cx', String(mark.x))
      visual.patch.setAttribute('cy', String(y))
      visual.patch.setAttribute('rx', String(radius))
      visual.patch.setAttribute('ry', String(radius * 0.16))
      visual.glint.setAttribute(
        'd',
        `M${mark.x - radius * 0.6} ${y - 1}Q${mark.x} ${y - radius * 0.07} ${mark.x + radius * 0.6} ${y - 1}`,
      )
      visual.root.style.opacity = String(surfaceMarkStrength(mark) * 0.6)
    }
  }
  /** 所有输入在这一帧统一做水面反馈与绘制，避免事件与 RAF 重复喷溅。 */
  function draw(now: number): void {
    if (disposed) return
    frame = 0
    const dt = playing && !reduced && last !== null ? Math.min((now - last) / 1000, 0.1) : 0
    last = now
    if (!media.matches) time += dt
    surfaceEffects = advanceSurfaceEffects(surfaceEffects, dt)
    flowDistance += oceanCurrent(180, 150, time).x * dt
    updatePhysics(dt)
    const consumed: number = prey.consumed
    prey = advancePreyScene(prey, dt, swimming && fish.y > 153 ? readWhale() : null)
    if (prey.consumed > consumed) {
      swimmer = recordFeeding(swimmer)
      feedingAge = 0
      for (let index: number = 0; index < 3; index++)
        addBubble(
          fish.x + fish.direction * (18 + index * 2),
          fish.y - 3 + index * 2,
          1.2 + index * 0.35,
          0.4 + index * 0.12,
        )
    }
    if (dragId === null && !reduced && dt > 0) {
      prey = trackPreyTarget(prey, readWhale())
      if (hasLivePrey(prey)) swimmer = deferAutoBreach(swimmer)
      const target: readonly [number, number] | null = findPreyTarget(prey, readWhale())
      if (target !== null) {
        swimmer = pursuePrey(swimmer, target)
        if (swimmer.phase === 'hunt') swimming = true
      } else swimmer = finishPursuit(swimmer)
    }
    windCooldown = Math.max(0, windCooldown - dt)
    const gust: number = reduced ? 0 : windGust(time)
    if (dragId !== null || keyboardMove) {
      keyboardMove = false
    } else if (swimming && !media.matches) {
      swimmer = advanceSwimMotionWithCurrent(
        swimmer,
        dt,
        waterY,
        (x: number, y: number, elapsed: number): WaterCurrent =>
          oceanCurrent(x, y, time - dt + elapsed),
      )
      Object.assign(fish, swimmer.whale)
    }
    if (swimmer.impact !== null && swimmer.impact.id !== lastImpactId) {
      landingImpact(swimmer.impact.x, swimmer.impact.speed, swimmer.impact.area)
      lastImpactId = swimmer.impact.id
    }
    const sy = waterY(fish.x),
      depth = fish.y - sy
    const wet = depth > -11,
      nearSurface = Math.abs(depth) < 29
    const speed = Math.hypot(fish.vx, fish.vy)
    const poweringUp: boolean = swimmer.phase === 'breach' && !swimmer.airborne
    const ordinarySolo: boolean =
      ['cruise', 'rise', 'dive'].includes(swimmer.phase) && swimmer.solo.duration > 0
    const targetPose: SoloPose = ordinarySolo
      ? soloPose(swimmer.solo, swimmer.clock)
      : { pitch: 0, surface: 0, tail: 0, rest: 0, bank: 0 }
    const blend: number = 1 - Math.exp(-dt * 10)
    renderedPose = {
      pitch: renderedPose.pitch + (targetPose.pitch - renderedPose.pitch) * blend,
      surface: renderedPose.surface + (targetPose.surface - renderedPose.surface) * blend,
      tail: renderedPose.tail + (targetPose.tail - renderedPose.tail) * blend,
      rest: renderedPose.rest + (targetPose.rest - renderedPose.rest) * blend,
      bank: renderedPose.bank + (targetPose.bank - renderedPose.bank) * blend,
    }
    renderedEffort += (swimEffort(swimmer) - renderedEffort) * (1 - Math.exp(-dt * 7))
    const pose: SoloPose = renderedPose
    const effort: number = renderedEffort
    splashCooldown = Math.max(0, splashCooldown - dt)
    if (
      dt > 0 &&
      wet !== lastWet &&
      (dragId !== null || (swimming && !wet)) &&
      splashCooldown === 0 &&
      speed > 25
    ) {
      burst(fish.x, clamp(Math.abs(fish.vy) / 105 + speed / 600, 0.18, 2.5), fish.vx)
      splashCooldown = 0.12
    }
    if (dt > 0 && dragId !== null && surfaceSplashPower(depth, speed) > 0 && splashCooldown === 0) {
      burst(fish.x, surfaceSplashPower(depth, speed), fish.vx)
      splashCooldown = 0.1
    }
    if (nearSurface && speed > 12 && dt > 0) {
      const pressure: number = Math.exp(-Math.pow(depth / 25, 2)) * dt
      impulse(fish.x + fish.direction * 20, -pressure * speed * 0.9)
      impulse(fish.x - fish.direction * 17, pressure * speed * 0.6)
    }
    lastWet = wet
    if (wet) {
      swimming = swimming || dragId !== null
      if (!media.matches) tailPhase += dt * (3.5 + effort * 11 + clamp(speed / 75, 0, 3))
      bubbleClock += dt
      if (
        bubbleClock > 0.36 &&
        bubbles.length < 18 &&
        !media.matches &&
        speed > 30 &&
        effort > 0.35
      ) {
        bubbleClock = 0
        addBubble(fish.x + fish.flip * 25, fish.y - 7, 1 + random() * 1.5, 1.4 + random())
      }
    }
    if (Math.abs(fish.vx) > 12 && !['prepare', 'gather', 'breach'].includes(swimmer.phase))
      fish.direction = fish.vx > 0 ? 1 : -1
    whaleTurn = media.matches
      ? createWhaleTurn(fish.direction)
      : advanceWhaleTurn(whaleTurn, fish.direction, dt)
    const artworkFrame: number = whaleTurnFrame(whaleTurn)
    if (artworkFrame !== renderedWhaleFrame) {
      const column: number = artworkFrame % WHALE_ATLAS_COLUMNS
      const row: number = Math.floor(artworkFrame / WHALE_ATLAS_COLUMNS)
      const atlasOffset: string = `translate(${-column * WHALE_ATLAS_CELL} ${-row * WHALE_ATLAS_CELL})`
      bodyFrame.setAttribute('transform', atlasOffset)
      tailFrame.setAttribute('transform', atlasOffset)
      renderedWhaleFrame = artworkFrame
      scene.dataset.turnFrame = String(artworkFrame)
    }
    fish.flip = 1 - whaleTurn.position * 2
    const bank: number = pose.bank * fish.flip * fish.flip
    whaleBelly.style.display = bank > 0.001 ? '' : 'none'
    whaleBank.setAttribute('transform', `scale(1 ${1 - bank * 0.12})`)
    whaleBelly.setAttribute('cy', String(23 - bank * 2))
    whaleBelly.setAttribute('ry', String(8 + bank * 7))
    whaleBelly.style.opacity = String(bank * 0.7)
    const airborne: boolean = swimmer.phase === 'breach' && swimmer.airborne
    const trajectoryAngle =
      ((Math.atan2((fish.vy * height) / 300, (Math.max(12, Math.abs(fish.vx)) * width) / 360) *
        180) /
        Math.PI) *
      -fish.flip
    const tilt =
      swimming && dragId === null
        ? clamp(
            trajectoryAngle,
            airborne || poweringUp || swimmer.phase === 'gather' ? -80 : -38,
            airborne || poweringUp || swimmer.phase === 'gather' ? 80 : 38,
          ) + (airborne ? Math.sin(swimmer.flightAge * 3) * 8 : Math.sin(tailPhase) * 1.8)
        : clamp(-fish.vy * fish.direction * 0.1, -25, 25)
    const level: number = pose.surface * clamp((46 - depth) / 24, 0, 1)
    const posedTilt: number =
      -fish.direction * pose.pitch +
      tilt * (1 - Math.max(clamp(Math.abs(pose.pitch) / 20, 0, 0.85), level * 0.9))
    fish.angle += (posedTilt - fish.angle) * (1 - Math.exp(-dt * (airborne ? 12 : 7)))
    const surfaceRest: number = pose.rest * clamp((24 - depth) / 12, 0, 1)
    const breathing: number = Math.sin(time * 2.6) * surfaceRest
    const restingBob: number =
      !media.matches && dragId === null
        ? breathing * 0.9 + (!swimming ? Math.sin(time * 1.3) * 1.2 : 0)
        : 0
    whale.setAttribute(
      'transform',
      `translate(${fish.x.toFixed(2)} ${(fish.y + restingBob).toFixed(2)}) scale(${Math.min(1, height / 300 / (width / 360)).toFixed(4)} ${Math.min(1, width / 360 / (height / 300)).toFixed(4)}) rotate(${fish.angle.toFixed(2)})`,
    )
    surfaceExposure += (pose.surface * clamp((34 - depth) / 14, 0, 1) - surfaceExposure) * blend
    const exposed: number = surfaceExposure
    whale.style.opacity = '1'
    if (targetPose.surface > 0.001) surfaceOccluded = true
    if ((depth > 48 && pose.surface < 0.01) || (dragId !== null && depth < -12))
      surfaceOccluded = false
    if (surfaceOccluded)
      whaleOcclusion.setAttribute('clip-path', `url(#${whaleOcclusion.dataset.waterClip})`)
    else whaleOcclusion.removeAttribute('clip-path')
    surfaceWhale.style.opacity = '1'
    surfaceWhale.style.display = exposed > 0.001 ? '' : 'none'
    const finLean: number = fish.flip * -4
    surfaceProfile.setAttribute('d', `M-31 4Q-17-5-3-2Q-2-6 ${finLean} -14Q5-8 4-2Q20 0 31 4Z`)
    surfaceWhale.setAttribute(
      'transform',
      `translate(${fish.x} ${sy + (1 - exposed) * 18}) scale(${Math.min(1, height / 300 / (width / 360))} ${Math.min(1, width / 360 / (height / 300))})`,
    )
    snoreGroup.style.opacity = String(surfaceRest)
    snores.forEach((element: SVGTextElement, index: number): void => {
      const p: number = (((time / 2.1 + index / 3) % 1) + 1) % 1
      element.setAttribute(
        'transform',
        `translate(${fish.x + fish.direction * 18 + p * 13} ${sy - 6 - p * 24}) scale(${0.65 + p * 0.4})`,
      )
      element.style.opacity = String(Math.sin(p * Math.PI) * 0.85)
    })
    if (
      dt > 0 &&
      ordinarySolo &&
      (exposed > 0.65 || surfaceRest > 0.7) &&
      lastBreathAt !== swimmer.solo.startedAt
    ) {
      breathe(fish.x + fish.direction * 12)
      lastBreathAt = swimmer.solo.startedAt
    }
    const tailStroke = Math.sin(tailPhase) + 0.22 * Math.sin(tailPhase * 2)
    if (
      dt > 0 &&
      swimming &&
      dragId === null &&
      previousDepth !== null &&
      previousDepth <= 36 &&
      depth > 36 &&
      fish.vy > 8 &&
      effort > 0.25 &&
      !['breach', 'recover'].includes(swimmer.phase) &&
      time >= nextFootprintAt
    ) {
      surfaceEffects = addFlukePrint(
        surfaceEffects,
        fish.x - fish.direction * 25,
        clamp((speed / 80) * effort, 0.3, 1),
      )
      nextFootprintAt = time + 4.5
    }
    previousDepth = depth
    const tailAngle = !media.matches
      ? wet
        ? tailStroke * (5 + effort * 22) * Math.min(1, effort * 3)
        : airborne
          ? Math.sin(swimmer.flightAge * 4) * 5
          : 0
      : 0
    const pivot: TailPivot = WHALE_TAIL_PIVOTS[artworkFrame]
    whaleTail.setAttribute(
      'transform',
      `rotate(${((tailAngle + pose.tail) * fish.flip * (swimmer.phase === 'feed' ? 0.55 : 1)).toFixed(2)} ${pivot[0]} ${pivot[1]})`,
    )
    feedingAge += dt
    const bite: number = clamp(feedingAge / 0.24, 0, 1)
    feedingPulse.setAttribute('d', `M-3 ${-5 - bite * 3}Q${7 + bite * 4} 0 -3 ${5 + bite * 3}`)
    feedingPulse.setAttribute(
      'transform',
      `translate(${fish.x + fish.direction * 18} ${fish.y}) scale(${fish.direction * Math.min(1, height / 300 / (width / 360))} ${Math.min(1, width / 360 / (height / 300))})`,
    )
    feedingPulse.style.opacity = String((1 - bite) * 0.8)
    const samples: readonly number[] = surfaceSamples()
    if (dt > 0 && gust > 0.4 && windCooldown === 0) {
      const crests: readonly number[] = breakingCrests(samples, gust)
      if (crests.length > 0) {
        const x: number = crests[Math.floor(random() * crests.length)]
        emitDrops(x, 0.12 + gust * 0.2, 110)
        impulse(x, -gust * 9)
        surfaceEffects = addWindFoam(surfaceEffects, x, gust)
      }
      windCooldown = 0.7 + random() * 0.8
    }
    const path = wavePath(samples, 0),
      closed = `${path}L360 305H0Z`
    water.setAttribute('d', closed)
    veil.setAttribute('d', closed)
    surface.setAttribute('d', path)
    waterClip.setAttribute('d', closed)
    airClip.setAttribute('d', `${path}L360 -5H0Z`)
    back.setAttribute('d', `${wavePath(samples, -5)}L360 305H0Z`)
    front.setAttribute('d', `${wavePath(samples, 13)}L360 305H0Z`)
    flows.forEach((el, i) => {
      el.setAttribute('transform', `translate(0 ${Math.sin(time * 0.3 + i) * 0.9})`)
      el.setAttribute('stroke-dashoffset', String(-flowDistance * (1 + i * 0.12)))
    })
    wakeHistory = wakeHistory.map((point: WakePoint): WakePoint => {
      const current: WaterCurrent = oceanCurrent(point.x, point.y, time)
      return { ...point, x: point.x + current.x * dt, y: point.y + current.y * dt }
    })
    if (dt > 0 && wet) wakeHistory.unshift({ x: fish.x + fish.flip * 27, y: fish.y + 5, time })
    while (
      wakeHistory.length > 64 ||
      (wakeHistory.length > 0 && time - wakeHistory[wakeHistory.length - 1].time > 0.42)
    )
      wakeHistory.pop()
    wakes.forEach((el, i) => {
      el.setAttribute(
        'd',
        wakeHistory
          .map(
            (point: WakePoint, index: number): string =>
              `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${(point.y + i * 4).toFixed(1)}`,
          )
          .join(''),
      )
      el.style.opacity =
        wet && !media.matches
          ? String(clamp(speed / 150, 0, 0.85) * (0.35 + effort * 0.65) * (1 - i * 0.2))
          : '0'
    })
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i]
      p.age += dt
      p.vy += 260 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.age > p.life || (p.age > 0.12 && p.y > waterY(p.x) + 4)) {
        p.el.style.display = 'none'
        dropPool.push(p.el)
        drops.splice(i, 1)
        continue
      }
      p.el.setAttribute('cx', p.x.toFixed(2))
      p.el.setAttribute('cy', p.y.toFixed(2))
      p.el.setAttribute('rx', p.size.toFixed(2))
      p.el.setAttribute('ry', (p.size * (1.5 + Math.min(Math.abs(p.vy) / 140, 1.5))).toFixed(2))
      p.el.setAttribute(
        'transform',
        `rotate(${(Math.atan2(p.vy, p.vx) * 180) / Math.PI - 90} ${p.x} ${p.y})`,
      )
      p.el.style.opacity = String(0.85 * (1 - p.age / p.life))
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const p = bubbles[i]
      p.age += dt
      const current: WaterCurrent = oceanCurrent(p.x, p.y, time)
      p.y += (-19 + current.y) * dt
      p.x += (current.x + Math.sin(time * 2 + p.r) * 0.6) * dt
      if (p.age > p.life || p.y < waterY(p.x) + 2) {
        p.el.style.display = 'none'
        bubblePool.push(p.el)
        bubbles.splice(i, 1)
        continue
      }
      p.el.setAttribute('cx', p.x.toFixed(2))
      p.el.setAttribute('cy', p.y.toFixed(2))
      p.el.setAttribute('r', p.r.toFixed(2))
      p.el.style.opacity = String(0.8 * (1 - p.age / p.life))
    }
    for (let i = splashes.length - 1; i >= 0; i--) {
      const p = splashes[i]
      p.age += dt
      const a = p.age / p.life
      if (a >= 1) {
        p.el.style.display = 'none'
        splashPool.push(p.el)
        splashes.splice(i, 1)
        continue
      }
      const w = 9 + a * 20 * p.power,
        h = Math.sin(a * Math.PI) * (10 + p.power * 11)
      p.el.setAttribute(
        'd',
        `M${p.x - w} ${p.y + 2}Q${p.x - w * 1.2} ${p.y - h} ${p.x - 4} ${p.y + 3}M${p.x + 4} ${p.y + 3}Q${p.x + w * 1.2} ${p.y - h * 1.25} ${p.x + w} ${p.y + 2}`,
      )
      p.el.style.opacity = String((1 - a) * 0.95)
    }
    for (let index: number = crowns.length - 1; index >= 0; index--) {
      const crown: ImpactCrown = crowns[index]
      crown.age += dt
      const t: number = crown.age / 0.42
      if (t >= 1) {
        crown.el.style.display = 'none'
        crownPool.push(crown.el)
        crowns.splice(index, 1)
        continue
      }
      const x: number = crown.x
      const y: number = waterY(x)
      const w: number = crown.shape.width * (0.6 + t * 1.8)
      const h: number = Math.sin(Math.min(1, t / 0.85) * Math.PI) * (12 + crown.shape.power * 17)
      crown.el.setAttribute(
        'd',
        `M${x - 3} ${y + 3}Q${x - w * 0.7} ${y - h * 0.25} ${x - w} ${y - h}Q${x - w * 0.7} ${y - h * 1.12} ${x - w * 0.58} ${y - h * 0.65}Q${x - w * 0.35} ${y - h * 0.95} ${x - w * 0.28} ${y - h * 0.32}L${x - 3} ${y + 4}ZM${x + 3} ${y + 3}Q${x + w * 0.7} ${y - h * 0.2} ${x + w} ${y - h * 0.85}Q${x + w * 0.7} ${y - h} ${x + w * 0.58} ${y - h * 0.55}Q${x + w * 0.35} ${y - h * 0.85} ${x + w * 0.28} ${y - h * 0.28}L${x + 3} ${y + 4}Z`,
      )
      crown.el.style.opacity = String((1 - t) * 0.85)
    }
    for (let i: number = ripples.length - 1; i >= 0; i--) {
      const ripple: Ripple = ripples[i]
      ripple.age += dt
      ripple.x += oceanCurrent(ripple.x, 150, time).x * dt
      if (ripple.age >= ripple.shape.life) {
        for (const element of ripple.elements) element.style.display = 'none'
        ripplePool.push(ripple.elements)
        ripples.splice(i, 1)
        continue
      }
      ripple.elements.forEach((element: SVGEllipseElement, index: number): void => {
        const progress: number = (ripple.age / ripple.shape.life - index * 0.11) / 0.78
        const p: number = clamp(progress, 0, 1)
        const radius: number = 5 + ripple.shape.radius * Math.pow(p, 0.8)
        element.setAttribute('cx', String(ripple.x))
        element.setAttribute('cy', String((waterY(ripple.x - 12) + waterY(ripple.x + 12)) / 2 + 8))
        element.setAttribute('rx', String(radius))
        element.setAttribute('ry', String(radius * 0.13))
        element.style.opacity =
          progress > 0
            ? String(Math.pow(1 - p, 1.4) * clamp(ripple.shape.power * 0.5, 0.2, 0.85))
            : '0'
      })
    }
    for (let i: number = breaths.length - 1; i >= 0; i--) {
      const breath: Breath = breaths[i]
      breath.age += dt
      if (breath.age > 0.9) {
        breath.el.style.display = 'none'
        breathPool.push(breath.el)
        breaths.splice(i, 1)
        continue
      }
      breath.el.setAttribute(
        'transform',
        `translate(${breath.x + breath.age * 4} ${breath.y - breath.age * 13}) scale(${0.45 + breath.age * 0.55})`,
      )
      breath.el.style.opacity = String((1 - breath.age / 0.9) * 0.65)
    }
    positionHandle()
    drawPrey()
    drawSurfaceMarks()
    scene.dataset.swimPhase = swimmer.phase
    scene.dataset.soloAction = ordinarySolo ? swimmer.solo.action : 'swim'
    scene.dataset.rippleCount = String(ripples.length)
    scene.dataset.restWeight = pose.rest.toFixed(3)
    scene.dataset.foamCount = String(surfaceEffects.foam.length)
    scene.dataset.footprintCount = String(surfaceEffects.footprints.length)
    scene.dataset.currentX = oceanCurrent(fish.x, fish.y, time).x.toFixed(3)
    scene.dataset.mode =
      swimming &&
      dragId === null &&
      (swimmer.phase === 'breach' ||
        swimmer.phase === 'gather' ||
        swimmer.phase === 'prepare' ||
        swimmer.phase === 'recover' ||
        swimmer.phase === 'hunt' ||
        swimmer.phase === 'lunge' ||
        swimmer.phase === 'feed')
        ? poweringUp
          ? 'launch'
          : swimmer.phase
        : ordinarySolo
          ? swimmer.solo.action === 'surface'
            ? 'breathe'
            : swimmer.solo.action
          : wet
            ? nearSurface
              ? 'surface'
              : 'deep'
            : dragId !== null
              ? 'air'
              : 'idle'
    setMode(scene.dataset.mode)
    if (playing && !disposed && !document.hidden) frame = requestAnimationFrame(draw)
  }
  /** 合帧唤醒，暂停和静态模式只进行一次同步绘制。 */
  function wake(): void {
    if (disposed) return
    if (!playing) {
      draw(performance.now())
      return
    }
    if (!frame && !document.hidden) {
      last = null
      frame = requestAnimationFrame(draw)
    }
  }
  /** 拖拽期间复用按下时的矩形，避免高频事件反复读取布局。 */
  function point(e: PointerEvent): { x: number; y: number } {
    const r = dragBounds ?? scene.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 360, y: ((e.clientY - r.top) / r.height) * 300 }
  }
  listen(handle, 'pointerdown', (e) => {
    if (e.button !== 0 || dragId !== null) return
    e.preventDefault()
    dragBounds = scene.getBoundingClientRect()
    const p = point(e)
    grabX = p.x - fish.x
    grabY = p.y - fish.y
    dragId = e.pointerId
    handle.setPointerCapture(e.pointerId)
    handle.setAttribute('aria-pressed', 'true')
    swimmer = grabWhale(swimmer, readWhale())
    fish.targetX = fish.x
    fish.targetY = fish.y
    inputAt = performance.now()
    wake()
  })
  listen(handle, 'pointermove', (e) => {
    if (e.pointerId !== dragId) return
    const p = point(e),
      now = performance.now(),
      dt = Math.max(0.008, (now - inputAt) / 1000)
    inputAt = now
    fish.targetX = clamp(p.x - grabX, 39, 321)
    fish.targetY = clamp(p.y - grabY, 67, 256)
    const weight: number = 1 - Math.exp(-dt * 22)
    fish.vx += (clamp((fish.targetX - fish.x) / dt, -520, 520) - fish.vx) * weight
    fish.vy += (clamp((fish.targetY - fish.y) / dt, -520, 520) - fish.vy) * weight
    fish.x = fish.targetX
    fish.y = fish.targetY
    if (fish.y > waterY(fish.x) - 11) swimming = true
    positionHandle()
    wake()
  })
  /** 丢失捕获和暂停走同一清理路径；按住不动后松手不保留陈旧甩动速度。 */
  function release(): void {
    if (dragId === null) return
    const captured: number = dragId
    dragId = null
    dragBounds = null
    if (handle.hasPointerCapture(captured)) handle.releasePointerCapture(captured)
    handle.setAttribute('aria-pressed', 'false')
    swimming = true
    const decay: number = Math.exp(-Math.max(0, performance.now() - inputAt - 45) / 75)
    fish.vx *= decay
    fish.vy *= decay
    const toss = fish.vy < -70 && fish.y < 180
    fish.vx = clamp(fish.vx, -180, 180)
    fish.vy = clamp(fish.vy, -260, 260)
    if (!media.matches)
      swimmer = toss ? tossWhale(swimmer, readWhale()) : releaseWhale(swimmer, readWhale())
    wake()
  }
  /** 非活动手指不能结束当前捕获。 */
  function releasePointer(event: PointerEvent): void {
    if (event.pointerId === dragId) release()
  }
  listen(handle, 'pointerup', releasePointer)
  listen(handle, 'pointercancel', releasePointer)
  listen(handle, 'lostpointercapture', releasePointer)
  listen(handle, 'dblclick', (e) => {
    e.preventDefault()
    if (media.matches) return
    swimming = true
    if (!hasLivePrey(prey)) swimmer = requestBreach(swimmer)
    wake()
  })
  listen(handle, 'keydown', (e) => {
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-20, 0],
      ArrowRight: [20, 0],
      ArrowUp: [0, -18],
      ArrowDown: [0, 18],
    }
    const key = e.code || e.key
    if (offsets[key]) {
      e.preventDefault()
      const [x, y] = offsets[key]
      fish.targetX = clamp(fish.x + x, 39, 321)
      fish.targetY = clamp(fish.y + y, 67, 256)
      fish.x = fish.targetX
      fish.y = fish.targetY
      fish.vx = x * 5
      fish.vy = y * 5
      keyboardMove = true
      swimming = fish.y > 146
      swimmer = swimming
        ? releaseWhale(swimmer, readWhale())
        : { ...swimmer, whale: readWhale(), phase: 'idle' }
      wake()
    } else if (key === 'Space' || key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (e.repeat) return
      if (media.matches) {
        fish.y = fish.y < 160 ? 185 : 124
        swimming = fish.y > 160
      } else {
        swimming = true
        if (!hasLivePrey(prey)) swimmer = requestBreach(swimmer)
      }
      wake()
    }
  })
  listen(handle, 'blur', () => {
    if (dragId !== null) release()
  })
  /** 恢复重置上一帧时间，不补算后台经过的时间。 */
  function pause(): void {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    last = null
  }

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        release()
        pause()
      } else wake()
    },
    { signal: abort.signal },
  )
  /** 流纹几何只构建一次；后续仅平移和改变虚线相位。 */
  flows.forEach((el: SVGPathElement, i: number): void => {
    let d: string = ''
    for (let x: number = -18; x <= 378; x += 12) {
      const y: number = 166 + i * 28 + Math.sin(x * 0.031 + i) * (3 + i)
      d += `${x === -18 ? 'M' : 'L'}${x} ${y.toFixed(1)}`
    }
    el.setAttribute('d', d)
    el.setAttribute('stroke-dasharray', `${20 + i * 8} ${44 + i * 13}`)
  })
  /** 父卡片改变尺寸后同步图形补偿和命中框，不拉伸鲸鱼。 */
  const resize: ResizeObserver = new ResizeObserver((): void => {
    width = scene.clientWidth
    height = scene.clientHeight
    dragBounds = null
    wake()
  })
  resize.observe(scene)
  draw(performance.now())
  return {
    setPlaying(next: boolean) {
      playing = next && !reduced
      handle.disabled = !next && !reduced
      if (!playing) {
        pause()
        release()
        draw(performance.now())
      } else wake()
    },
    dispose() {
      disposed = true
      abort.abort()
      resize.disconnect()
      pause()
      if (dragId !== null && handle.hasPointerCapture(dragId)) handle.releasePointerCapture(dragId)
      dragId = null
      for (const group of [
        dropGroup,
        bubbleGroup,
        splashGroup,
        preyGroup,
        rippleGroup,
        breathGroup,
        foam,
        footprintGroup,
      ])
        group.replaceChildren()
      preyNodes.clear()
      preyPool.length = 0
    },
  }
}
