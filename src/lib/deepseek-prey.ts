import type { Whale } from './deepseek-motion.ts'
import { clamp, oceanCurrent, type WaterCurrent } from './deepseek-water.ts'

/** 个体拥有独立的大小和相位，群体不会像一张贴图平移。 */
export type Prey = Readonly<{
  /** 遭遇内稳定的渲染标识。 */
  id: number
  /** 小鱼与磷虾使用不同速度和逃避方式。 */
  kind: 'fish' | 'shrimp'
  /** 舞台内水平位置，可从边缘游出。 */
  x: number
  /** 水下深度。 */
  y: number
  /** 当前水平速度。 */
  vx: number
  /** 当前垂直速度。 */
  vy: number
  /** 个体大小，避免整群完全一致。 */
  size: number
  /** 游姿与逃逸摆动的独立相位。 */
  phase: number
  /** 身体前向的弧度角，与尾弹逃逸时的位移方向分离。 */
  heading: number
  /** 短促逃逸尾弹结束时间，之后恢复正常划游。 */
  escapeUntil: number
  /** 每只个体独立的反应间隔，避免虾群持续同步抽动。 */
  escapeReadyAt: number
  /** 邻近威胁经鱼群逐步传递的警戒强度。 */
  alarm: number
  /** 冲刺与恢复具有持续时间，不随距离阈值逐帧切换。 */
  pace: 'cruise' | 'accelerate' | 'burst' | 'recover'
  /** 入场只执行一次，逃回边缘后不会再次被入口规则强制推回。 */
  entered: boolean
  /** 接触嘴部后短暂收拢淡出，不能隔空移除。 */
  caughtAt: number | null
}>

/** 每次遭遇独立采样的平滑群体航线，仅提供引导，不覆盖个体位置。 */
type SchoolCourse = Readonly<{
  /** 群体巡游的基准深度。 */
  depth: number
  /** 宽弧线的垂直幅度。 */
  amplitude: number
  /** 航线波长，控制转弯半径。 */
  wavelength: number
  /** 各次遭遇的路径相位。 */
  phase: number
  /** 经转弯速率约束的群体前向，单位为弧度。 */
  heading: number
  /** 威胁近乎居中时保持避让侧，避免上下反复犹豫。 */
  avoidanceSide: number
  /** 群体可以改道或掉头，独立于固定的出生方向。 */
  travelDirection: number
  /** 规避选择有持续时间和冷却，避免目标方位微变时反复翻转。 */
  maneuver: 'cruise' | 'swerve' | 'reverse' | 'dive' | 'climb' | 'regroup' | 'exit'
  /** 当前规避动作至少持续到这一时间。 */
  maneuverUntil: number
  /** 下一次允许重新评估绕行或回身的时间。 */
  nextDecisionAt: number
}>

/** 个体只读取邻域快照；同一步内不依赖数组中其他个体的更新顺序。 */
type Neighbors = Readonly<{
  /** 邻域中的存活个体数。 */
  count: number
  /** 邻域位置合计，用于聚合。 */
  centerX: number
  /** 邻域垂直位置合计。 */
  centerY: number
  /** 邻域水平速度合计，用于对齐。 */
  velocityX: number
  /** 邻域垂直速度合计。 */
  velocityY: number
  /** 避免身体重叠的水平排斥量。 */
  separationX: number
  /** 避免身体重叠的垂直排斥量。 */
  separationY: number
  /** 最近邻传来的最大警戒信号。 */
  alarm: number
}>

/** 一个有限时长的偶发遭遇；随机状态显式保留以便复现问题。 */
export type PreyScene = Readonly<{
  /** 本实例的伪随机序列。 */
  seed: number
  /** 暂停时不推进。 */
  clock: number
  /** 下一群的最早出现时间。 */
  nextAt: number
  /** 此后优先朝出口游动，但绝不按时间清空仍在画面内的猎物。 */
  expiresAt: number
  /** 当前群体的迁移方向。 */
  direction: number
  /** 每次遭遇递增，用于隔离节点标识。 */
  encounter: number
  /** 活跃或正在被吞食的个体。 */
  animals: readonly Prey[]
  /** 累计实际接触捕食数，供场景触发轻微反馈。 */
  consumed: number
  /** 群体的迁移意图；鱼与磷虾分别实现局部群游和逃逸动力。 */
  course: SchoolCourse | null
  /** 鲸鱼持续追踪同一个可达猎物，而非逐帧重选最近者。 */
  targetId: number | null
  /** 切换目标需要经过短暂保持期和显著距离收益。 */
  targetHoldUntil: number
}>

/** 同一输入产生同一随机样本，运行时由 crypto 提供不同初始种子。 */
function drawRandom(seed: number): readonly [number, number] {
  const next: number = (seed * 1664525 + 1013904223) >>> 0
  return [next, next / 4294967296]
}

/** 首群延迟 8–20 秒，之后保留明显空档，不把偶遇变成常驻背景。 */
export function createPreyScene(seed: number): PreyScene {
  const [next, value] = drawRandom(seed)
  return {
    seed: next,
    clock: 0,
    nextAt: 8 + value * 12,
    expiresAt: 0,
    direction: 1,
    encounter: 0,
    animals: [],
    consumed: 0,
    course: null,
    targetId: null,
    targetHoldUntil: 0,
  }
}

/** 入场边缘的存活个体也占用捕食优先级，被吞食后的收拢节点不占用。 */
export function hasLivePrey(scene: PreyScene): boolean {
  return scene.animals.some((animal: Prey): boolean => animal.caughtAt === null)
}

/** 每次重新采样种类、数量、边缘、深度与个体差异，没有固定循环序列。 */
function spawnSchool(scene: PreyScene): PreyScene {
  let seed: number = scene.seed
  const sample = (): number => {
    const result: readonly [number, number] = drawRandom(seed)
    seed = result[0]
    return result[1]
  }
  const kind: Prey['kind'] = sample() < 0.52 ? 'fish' : 'shrimp'
  const count: number =
    kind === 'fish' ? 20 + Math.floor(sample() * 17) : 7 + Math.floor(sample() * 11)
  const direction: number = sample() < 0.5 ? 1 : -1
  const depth: number = 191 + sample() * 49
  const animals: Prey[] = Array.from({ length: count }, (_value: unknown, i: number): Prey => ({
    id: (scene.encounter + 1) * 64 + i,
    kind,
    x: (direction === 1 ? -15 : 375) - direction * sample() * (kind === 'fish' ? 105 : 43),
    y: clamp(depth + (sample() - 0.5) * (kind === 'fish' ? 48 : 36), 176, 260),
    vx: direction * (kind === 'fish' ? 31 + sample() * 12 : 22 + sample() * 9),
    vy: (sample() - 0.5) * 6,
    size: kind === 'fish' ? 0.8 + sample() * 0.22 : 0.52 + sample() * 0.1,
    phase: sample() * Math.PI * 2,
    heading: direction === 1 ? 0 : Math.PI,
    escapeUntil: 0,
    escapeReadyAt: scene.clock + sample() * 0.6,
    alarm: 0,
    pace: 'cruise',
    entered: false,
    caughtAt: null,
  }))
  const lifetime: number = 12 + sample() * 5
  const rest: number = 17 + sample() * 20
  const course: SchoolCourse = {
    depth,
    amplitude: (kind === 'fish' ? 13 : 18) + sample() * 8,
    wavelength: 300 + sample() * 160,
    phase: sample() * Math.PI * 2,
    heading: direction === 1 ? 0 : Math.PI,
    avoidanceSide: sample() < 0.5 ? -1 : 1,
    travelDirection: direction,
    maneuver: 'cruise',
    maneuverUntil: 0,
    nextDecisionAt: scene.clock + 0.6,
  }
  return {
    ...scene,
    seed,
    direction,
    animals,
    encounter: scene.encounter + 1,
    expiresAt: scene.clock + lifetime,
    nextAt: scene.clock + lifetime + rest,
    course,
    targetId: null,
    targetHoldUntil: 0,
  }
}

/** 邻域群游结合预测逃逸；模型来源：https://www.red3d.com/cwr/steer/gdc99/ 。 */
function readNeighbors(animal: Prey, scene: PreyScene): Neighbors {
  let separationX: number = 0
  let separationY: number = 0
  let centerX: number = 0
  let centerY: number = 0
  let alignmentX: number = 0
  let alignmentY: number = 0
  let neighbors: number = 0
  let alarm: number = 0
  for (const other of scene.animals) {
    if (other.id === animal.id || other.caughtAt !== null || other.kind !== animal.kind) continue
    const dx: number = animal.x - other.x
    const dy: number = animal.y - other.y
    const distance: number = Math.hypot(dx, dy)
    if (distance < (animal.kind === 'fish' ? 96 : 55)) {
      neighbors++
      centerX += other.x
      centerY += other.y
      alignmentX += other.vx
      alignmentY += other.vy
      alarm = Math.max(alarm, other.alarm)
      if (distance < 15) {
        separationX += dx / Math.max(4, distance * distance)
        separationY += dy / Math.max(4, distance * distance)
      }
    }
  }
  return {
    count: neighbors,
    centerX,
    centerY,
    velocityX: alignmentX,
    velocityY: alignmentY,
    separationX,
    separationY,
    alarm,
  }
}

/** 航线只提供宽弧引导，个体仍通过分离、对齐和聚合自由移动。 */
function courseDepth(course: SchoolCourse, x: number): number {
  return clamp(
    course.depth +
      Math.sin((x * Math.PI * 2) / course.wavelength + course.phase) * course.amplitude,
    183,
    250,
  )
}

/** 群体按有限角速度改变航向，避让依据已传入鱼群的警戒信号。 */
function advanceCourse(scene: PreyScene, whale: Whale | null, dt: number): PreyScene {
  const course: SchoolCourse | null = scene.course
  if (course === null) return scene
  const fish: readonly Prey[] = scene.animals.filter(
    (p: Prey): boolean => p.entered && p.caughtAt === null,
  )
  if (fish.length === 0) return scene
  const centerX: number = fish.reduce((sum: number, p: Prey): number => sum + p.x, 0) / fish.length
  const centerY: number = fish.reduce((sum: number, p: Prey): number => sum + p.y, 0) / fish.length
  // 局部受惊先由个体和邻居处理，共享航向不因单只个体报警就立刻整群翻转。
  const alarm: number = fish.reduce(
    (sum: number, p: Prey): number => sum + p.alarm / fish.length,
    0,
  )
  let nextCourse: SchoolCourse = course
  let seed: number = scene.seed
  if (scene.clock >= scene.expiresAt && course.maneuver !== 'exit') {
    nextCourse = { ...course, maneuver: 'exit', travelDirection: centerX < 180 ? -1 : 1 }
  } else if (
    scene.clock >= course.maneuverUntil &&
    ['swerve', 'reverse', 'dive', 'climb'].includes(course.maneuver)
  ) {
    nextCourse = { ...course, maneuver: 'regroup', maneuverUntil: scene.clock + 1.1 }
  } else if (scene.clock >= course.maneuverUntil && course.maneuver === 'regroup') {
    nextCourse = { ...course, maneuver: 'cruise' }
  }
  if (
    whale !== null &&
    alarm > 0.18 &&
    scene.clock < scene.expiresAt &&
    scene.clock >= nextCourse.nextDecisionAt &&
    centerX > 65 &&
    centerX < 295
  ) {
    const predictedX: number = whale.x + whale.vx * 0.55
    const predictedY: number = whale.y + whale.vy * 0.55
    const forwardClearance: number = Math.hypot(
      centerX + nextCourse.travelDirection * 52 - predictedX,
      centerY - predictedY,
    )
    const reverseClearance: number =
      Math.hypot(centerX - nextCourse.travelDirection * 52 - predictedX, centerY - predictedY) - 18
    const reverse: boolean = reverseClearance > forwardClearance + 18
    const downClearance: number =
      centerY < 222 ? Math.hypot(centerX - predictedX, centerY + 34 - predictedY) - 8 : -1000
    const upClearance: number =
      centerY > 210 ? Math.hypot(centerX - predictedX, centerY - 34 - predictedY) - 8 : -1000
    const vertical: number =
      Math.max(downClearance, upClearance) > Math.max(forwardClearance, reverseClearance) + 8
        ? downClearance > upClearance
          ? 1
          : -1
        : 0
    const random: readonly [number, number] = drawRandom(seed)
    seed = random[0]
    const side: number = reverse
      ? centerY < 218
        ? 1
        : -1
      : centerY < 193
        ? 1
        : centerY > 236
          ? -1
          : Math.abs(centerY - predictedY) > 12
            ? Math.sign(centerY - predictedY)
            : nextCourse.avoidanceSide
    nextCourse = {
      ...nextCourse,
      maneuver: vertical !== 0 ? (vertical > 0 ? 'dive' : 'climb') : reverse ? 'reverse' : 'swerve',
      depth: vertical !== 0 ? clamp(centerY + vertical * 30, 185, 246) : nextCourse.depth,
      travelDirection:
        vertical === 0 && reverse ? -nextCourse.travelDirection : nextCourse.travelDirection,
      avoidanceSide: side,
      maneuverUntil: scene.clock + (vertical !== 0 ? 1.1 : reverse ? 2 : 1.2),
      nextDecisionAt: scene.clock + 3.4 + random[1] * 1.2,
    }
  }
  const direction: number = nextCourse.travelDirection
  const slope: number =
    (Math.cos((centerX * Math.PI * 2) / course.wavelength + course.phase) *
      course.amplitude *
      Math.PI *
      2) /
    course.wavelength
  const evasion: number =
    nextCourse.maneuver === 'exit' ? 0 : nextCourse.avoidanceSide * alarm * 0.85
  const offset: number =
    nextCourse.maneuver === 'swerve'
      ? nextCourse.avoidanceSide * 25
      : nextCourse.maneuver === 'reverse'
        ? nextCourse.avoidanceSide * 14
        : 0
  const desired: number =
    nextCourse.maneuver === 'dive' && centerY < nextCourse.depth - 8
      ? Math.atan2(1, direction * 0.22)
      : nextCourse.maneuver === 'climb' && centerY > nextCourse.depth + 8
        ? Math.atan2(-1, direction * 0.22)
        : Math.atan2(
            slope * direction +
              clamp((courseDepth(nextCourse, centerX) + offset - centerY) / 45, -0.6, 0.6) +
              evasion,
            direction,
          )
  const turn: number = Math.atan2(
    Math.sin(desired - course.heading),
    Math.cos(desired - course.heading),
  )
  const turnRate: number = nextCourse.maneuver === 'reverse' ? 2.6 : 1.6
  const heading: number =
    course.heading + clamp(turn * (1 - Math.exp(-dt * 3.2)), -turnRate * dt, turnRate * dt)
  return { ...scene, seed, course: { ...nextCourse, heading } }
}

/** 入场保留向内速度，同时提前绕开入口附近的嘴部，避免出生点外左右反复争向。 */
function steerIncomingPrey(animal: Prey, scene: PreyScene, whale: Whale | null, dt: number): Prey {
  const current: WaterCurrent = oceanCurrent(animal.x, animal.y, scene.clock)
  const course: SchoolCourse | null = scene.course
  if (course === null)
    throw new Error(`Missing prey entry course: encounter=${scene.encounter} seed=${scene.seed}`)
  const speed: number = animal.kind === 'fish' ? 50 : 27
  const gain: number = 1 - Math.exp(-dt * 4)
  const vx: number = animal.vx + (scene.direction * speed + current.x - animal.vx) * gain
  const threat: number =
    whale === null ? 0 : clamp(1 - Math.hypot(animal.x - whale.x, animal.y - whale.y) / 105, 0, 1)
  const side: number =
    whale !== null && Math.abs(animal.y - whale.y) > 10
      ? Math.sign(animal.y - whale.y)
      : animal.y < 185
        ? 1
        : animal.y > 249
          ? -1
          : course.avoidanceSide
  const desiredY: number = side * threat * (animal.kind === 'fish' ? 42 : 30)
  const vy: number = animal.vy + (desiredY + current.y - animal.vy) * gain
  const x: number = animal.x + vx * dt
  return {
    ...animal,
    x,
    y: Math.max(170, animal.y + vy * dt),
    vx,
    vy,
    heading: Math.atan2(vy, vx),
    entered: x >= 24 && x <= 336,
  }
}

/** 鲱鱼保留群体朝向，近距离才局部避让；冲刺后降速回并而非持续散逃。 */
function steerHerring(animal: Prey, scene: PreyScene, whale: Whale | null, dt: number): Prey {
  if (animal.caughtAt !== null) return animal
  const course: SchoolCourse | null = scene.course
  if (course === null)
    throw new Error(
      `Missing herring migration course: encounter=${scene.encounter} seed=${scene.seed}`,
    )
  const neighbors: Neighbors = readNeighbors(animal, scene)
  const current: WaterCurrent = oceanCurrent(animal.x, animal.y, scene.clock)
  const awayX: number = whale === null ? 1000 : animal.x - whale.x - whale.direction * 18
  const awayY: number = whale === null ? 1000 : animal.y - whale.y
  const mouthDistance: number = Math.max(1, Math.hypot(awayX, awayY))
  const relativeX: number = whale === null ? 0 : animal.vx - whale.vx
  const relativeY: number = whale === null ? 0 : animal.vy - whale.vy
  const collisionTime: number = clamp(
    -(awayX * relativeX + awayY * relativeY) /
      Math.max(1, relativeX * relativeX + relativeY * relativeY),
    0,
    0.9,
  )
  const miss: number = Math.hypot(
    awayX + relativeX * collisionTime,
    awayY + relativeY * collisionTime,
  )
  const collisionRisk: number =
    whale === null
      ? 0
      : Math.max(
          clamp(1 - mouthDistance / 65, 0, 1),
          miss < 28 ? (1 - miss / 28) * (0.65 + 0.35 * (1 - collisionTime / 0.9)) : 0,
        )
  const threatX: number = whale === null ? 1000 : animal.x - (whale.x + whale.vx * 0.22)
  const threatY: number = whale === null ? 1000 : animal.y - (whale.y + whale.vy * 0.22)
  const distance: number = Math.max(1, Math.hypot(threatX, threatY))
  const immediateDistance: number =
    whale === null ? 1000 : Math.hypot(animal.x - whale.x, animal.y - whale.y)
  const directAlarm: number = clamp(1 - Math.min(distance, immediateDistance) / 86, 0, 1)
  const desiredAlarm: number = Math.max(directAlarm, neighbors.alarm * 0.82)
  const alarm: number =
    animal.alarm +
    (desiredAlarm - animal.alarm) * (1 - Math.exp(-dt * (directAlarm > 0.7 ? 14 : 5.8)))
  const startled: boolean =
    alarm > 0.42 + Math.sin(animal.phase) * 0.08 && scene.clock >= animal.escapeReadyAt
  const escapeUntil: number = startled
    ? scene.clock + 0.38 + (Math.cos(animal.phase) + 1) * 0.06
    : animal.escapeUntil
  const escapeReadyAt: number = startled
    ? scene.clock + 1.6 + (Math.sin(animal.phase) + 1) * 0.25
    : animal.escapeReadyAt
  const pace: Prey['pace'] =
    scene.clock < escapeUntil
      ? 'burst'
      : escapeUntil > 0 && scene.clock < escapeReadyAt
        ? 'recover'
        : alarm > 0.15
          ? 'accelerate'
          : 'cruise'
  const regroup: number =
    course.maneuver === 'regroup'
      ? clamp((scene.clock - course.maneuverUntil + 1.1) / 0.45, 0, 1)
      : 0
  const cohesion: number = 0.28 + (1 - directAlarm) * (0.42 + regroup * 0.25)
  const centerX: number =
    neighbors.count > 0 ? (neighbors.centerX / neighbors.count - animal.x) * cohesion : 0
  const centerY: number =
    neighbors.count > 0 ? (neighbors.centerY / neighbors.count - animal.y) * cohesion : 0
  const agreement: number =
    (neighbors.velocityX * Math.cos(course.heading) +
      neighbors.velocityY * Math.sin(course.heading)) /
    Math.max(1, Math.hypot(neighbors.velocityX, neighbors.velocityY))
  const alignmentGain: number =
    (0.15 + Math.max(0, agreement) * 0.4 + regroup * 0.15) * (1 - directAlarm * 0.4)
  const alignX: number =
    neighbors.count > 0 ? (neighbors.velocityX / neighbors.count) * alignmentGain : 0
  const alignY: number =
    neighbors.count > 0 ? (neighbors.velocityY / neighbors.count) * alignmentGain : 0
  const urgency: number = Math.max(clamp(1 - distance / 53, 0, 1), collisionRisk)
  const predictedY: number = animal.y + animal.vy * 0.35
  const navigationX: number =
    scene.clock > scene.expiresAt ? course.travelDirection * 120 : Math.cos(course.heading) * 54
  const navigationY: number = scene.clock > scene.expiresAt ? 0 : Math.sin(course.heading) * 54
  const desiredX: number =
    navigationX * (1 - urgency * 0.6) +
    centerX +
    alignX +
    neighbors.separationX * 150 +
    (threatX / distance) * urgency * 28
  const desiredY: number =
    navigationY * (1 - urgency * 0.6) +
    centerY +
    alignY +
    neighbors.separationY * 150 +
    clamp((courseDepth(course, animal.x) - animal.y) * 0.65, -24, 24) +
    (threatY / distance) * urgency * 40 +
    Math.sin(scene.clock * 1.1 + animal.phase) * 0.7 +
    Math.max(0, 186 - predictedY) * 12 -
    Math.max(0, predictedY - 250) * 12
  const travelHeading: number = Math.atan2(animal.vy - current.y, animal.vx - current.x)
  const avoidSide: number =
    animal.y < 190
      ? 1
      : animal.y > 242
        ? -1
        : Math.abs(awayY) > 12
          ? Math.sign(awayY)
          : course.avoidanceSide
  const avoidX: number = awayX / mouthDistance
  const avoidY: number = awayY / mouthDistance + avoidSide * 0.85
  const priority: number = clamp((collisionRisk - 0.12) / 0.45, 0, 1)
  const desiredHeading: number = Math.atan2(
    desiredY * (1 - priority) + avoidY * priority * 100,
    desiredX * (1 - priority) + avoidX * priority * 100,
  )
  let delta: number = Math.atan2(
    Math.sin(desiredHeading - travelHeading),
    Math.cos(desiredHeading - travelHeading),
  )
  // 回身期间保持同一转弯侧，水面/底部约束不会把半个掉头反向取消。
  const committedTurn: number = -course.travelDirection * course.avoidanceSide
  if (
    course.maneuver === 'reverse' &&
    collisionRisk < 0.3 &&
    predictedY > 181 &&
    predictedY < 254 &&
    Math.abs(delta) > 0.5 &&
    Math.sign(delta) !== committedTurn
  )
    delta = committedTurn * Math.abs(delta)
  const turnRate: number = pace === 'burst' ? 4.4 : 3.3
  const heading: number = travelHeading + clamp(delta, -turnRate * dt, turnRate * dt)
  const cruise: number = 52 + Math.sin(scene.clock * 0.8 + course.phase) * 4
  const formationSpeed: number =
    neighbors.count > 0
      ? clamp(
          (neighbors.centerX / neighbors.count - animal.x) * course.travelDirection * 0.22,
          -9,
          9,
        ) *
        (1 - directAlarm)
      : 0
  const closingSpeed: number =
    whale === null
      ? 0
      : Math.max(
          0,
          ((whale.vx - animal.vx) * (animal.x - whale.x) +
            (whale.vy - animal.vy) * (animal.y - whale.y)) /
            Math.max(1, immediateDistance),
        )
  const escapeAlignment: number =
    (Math.cos(heading) * awayX + Math.sin(heading) * awayY) / mouthDistance
  const targetSpeed: number =
    collisionRisk > 0.55 && escapeAlignment < -0.15
      ? cruise * 0.85
      : (pace === 'burst'
          ? 102 + Math.sin(animal.phase) * 5 + Math.min(12, closingSpeed * 0.12)
          : pace === 'recover'
            ? cruise + alarm * 9
            : cruise + alarm * 23) + formationSpeed
  const speed: number =
    Math.hypot(animal.vx - current.x, animal.vy - current.y) +
    (targetSpeed - Math.hypot(animal.vx - current.x, animal.vy - current.y)) *
      (1 - Math.exp(-dt * (pace === 'burst' ? 6.2 : 2.6)))
  const vx: number = Math.cos(heading) * speed + current.x
  const vy: number = Math.sin(heading) * speed + current.y
  return {
    ...animal,
    x: animal.x + vx * dt,
    y: Math.max(170, animal.y + vy * dt),
    vx,
    vy,
    heading,
    alarm,
    pace,
    escapeUntil,
    escapeReadyAt,
  }
}

/** 磷虾以邻居对齐与上下协调划游，近距离危险才触发带恢复期的后向尾弹。 */
function steerShrimp(animal: Prey, scene: PreyScene, whale: Whale | null, dt: number): Prey {
  if (animal.caughtAt !== null) return animal
  const course: SchoolCourse | null = scene.course
  if (course === null)
    throw new Error(
      `Missing krill migration course: encounter=${scene.encounter} seed=${scene.seed}`,
    )
  const {
    count: neighbors,
    centerX,
    centerY,
    velocityX: alignmentX,
    velocityY: alignmentY,
    separationX,
    separationY,
    alarm: neighborAlarm,
  }: Neighbors = readNeighbors(animal, scene)
  const current: WaterCurrent = oceanCurrent(animal.x, animal.y, scene.clock)
  const threatX: number = whale === null ? 1000 : animal.x - whale.x - whale.direction * 18
  const threatY: number = whale === null ? 1000 : animal.y - whale.y
  const distance: number = Math.max(1, Math.hypot(threatX, threatY))
  const immediateDistance: number =
    whale === null ? 1000 : Math.hypot(animal.x - whale.x, animal.y - whale.y)
  const directAlarm: number = clamp(1 - Math.min(distance, immediateDistance) / 86, 0, 1)
  const panic: number =
    animal.alarm +
    (Math.max(directAlarm, neighborAlarm * 0.72) - animal.alarm) * (1 - Math.exp(-dt * 9))
  const startled: boolean =
    Math.max(directAlarm, panic) > 0.42 && scene.clock >= animal.escapeReadyAt
  const escapeUntil: number = startled
    ? scene.clock + 0.16 + (Math.sin(animal.phase) + 1) * 0.035
    : animal.escapeUntil
  const escapeReadyAt: number = startled
    ? scene.clock + 0.85 + (Math.cos(animal.phase) + 1) * 0.25
    : animal.escapeReadyAt
  const tailFlip: boolean = scene.clock < escapeUntil
  const cohesionX: number =
    neighbors > 0 ? (centerX / neighbors - animal.x) * (0.22 - directAlarm * 0.12) : 0
  const cohesionY: number =
    neighbors > 0 ? (centerY / neighbors - animal.y) * (0.45 - directAlarm * 0.25) : 0
  const alignX: number = neighbors > 0 ? (alignmentX / neighbors) * 0.24 : 0
  const alignY: number = neighbors > 0 ? (alignmentY / neighbors) * 0.42 : 0
  const zigzag: number = Math.sin(scene.clock * 2.4 + animal.phase)
  const desiredX: number =
    (scene.clock > scene.expiresAt ? course.travelDirection * 140 : Math.cos(course.heading) * 35) +
    cohesionX +
    alignX +
    separationX * 125 +
    (threatX / distance) * panic * 100
  const desiredY: number =
    Math.sin(course.heading) * 35 +
    clamp((courseDepth(course, animal.x) - animal.y) * 0.35, -15, 15) +
    cohesionY +
    alignY +
    separationY * 125 +
    (threatY / distance) * panic * 100 +
    zigzag * (2 + panic * 4) +
    Math.max(0, 185 - animal.y) * 12 -
    Math.max(0, animal.y - 251) * 12
  const length: number = Math.max(1, Math.hypot(desiredX, desiredY))
  const speed: number = tailFlip ? 98 : 27 + panic * 16
  const gain: number = 1 - Math.exp(-dt * (tailFlip ? 11 : 5))
  const vx: number =
    animal.vx +
    ((tailFlip ? threatX / distance : desiredX / length) * speed + current.x - animal.vx) * gain
  const vy: number =
    animal.vy +
    ((tailFlip ? threatY / distance : desiredY / length) * speed + current.y - animal.vy) * gain
  const targetHeading: number = Math.atan2(tailFlip ? -vy : vy, tailFlip ? -vx : vx)
  const deltaHeading: number = Math.atan2(
    Math.sin(targetHeading - animal.heading),
    Math.cos(targetHeading - animal.heading),
  )
  const heading: number = animal.heading + deltaHeading * (1 - Math.exp(-dt * (tailFlip ? 16 : 9)))
  return {
    ...animal,
    x: animal.x + vx * dt,
    y: Math.max(170, animal.y + vy * dt),
    vx,
    vy,
    heading,
    escapeUntil,
    escapeReadyAt,
    alarm: panic,
    pace: tailFlip ? 'burst' : 'cruise',
  }
}

/** 尾部和游泳足角度为度，前向为弧度；全部由模拟时钟驱动以保持暂停姿态。 */
export type PreyPose = Readonly<{
  /** 前向弧度角，渲染时转换到显示坐标。 */
  heading: number
  /** 尾柄或腹尾连接处的弯曲角度。 */
  tail: number
  /** 磷虾腹下附肢的小幅划游角度。 */
  legs: number
}>

/** 鲱鱼以摆尾推进，磷虾以划游为主，受惊时腹尾短促收拢而非持续摇摆。 */
export function getPreyPose(animal: Prey, clock: number): PreyPose {
  const speed: number = Math.hypot(animal.vx, animal.vy)
  const stroke: number = Math.sin(clock * (6 + speed * 0.12) + animal.phase)
  const curling: number =
    animal.kind === 'shrimp' ? clamp((animal.escapeUntil - clock) / 0.14, 0, 1) : 0
  return {
    heading: animal.heading + (animal.kind === 'fish' ? stroke * 0.015 : 0),
    tail:
      animal.kind === 'fish' ? stroke * (7 + clamp(speed / 6, 0, 10)) : -curling * 48 + stroke * 2,
    legs: animal.kind === 'shrimp' ? Math.sin(clock * 13 + animal.phase) * 6 : 0,
  }
}

/** 预测距离加上转向代价，避免只因身后个体略近就放弃前方的攻击线路。 */
function huntCost(animal: Prey, whale: Whale): number {
  const dx: number = animal.x + animal.vx * 0.2 - whale.x
  const dy: number = animal.y + animal.vy * 0.2 - whale.y
  const distance: number = Math.max(1, Math.hypot(dx, dy))
  const speed: number = Math.hypot(whale.vx, whale.vy)
  const headingX: number = speed > 12 ? whale.vx / speed : whale.direction
  const headingY: number = speed > 12 ? whale.vy / speed : 0
  const alignment: number = (dx * headingX + dy * headingY) / distance
  return distance + (1 - alignment) * 22
}

/** 出生和退出边缘不属于可达追逐区，避免把鲸鱼引向舞台软边界的平衡点。 */
function nearestHuntablePrey(scene: PreyScene, whale: Whale): Prey | undefined {
  const candidates: readonly Prey[] = scene.animals.filter(
    (p: Prey): boolean => p.entered && p.caughtAt === null && p.x >= 70 && p.x <= 290 && p.y <= 250,
  )
  const closest: Prey | undefined = candidates.reduce<Prey | undefined>(
    (best: Prey | undefined, p: Prey): Prey =>
      best === undefined || huntCost(p, whale) < huntCost(best, whale) ? p : best,
    undefined,
  )
  return closest
}

/** 锁定后的释放区比获取区更宽，猎物在入口附近摆动不会逐帧切换追逐状态。 */
function lockedPrey(scene: PreyScene): Prey | undefined {
  return scene.animals.find(
    (p: Prey): boolean =>
      p.id === scene.targetId &&
      p.entered &&
      p.caughtAt === null &&
      p.x > 50 &&
      p.x < 310 &&
      p.y < 260,
  )
}

/** 优先保持当前猎物，只有失去目标或新目标显著更近时才切换。 */
export function trackPreyTarget(scene: PreyScene, whale: Whale): PreyScene {
  const current: Prey | undefined = lockedPrey(scene)
  const candidate: Prey | undefined = nearestHuntablePrey(scene, whale)
  if (current !== undefined) {
    const distance: number = Math.hypot(current.x - whale.x, current.y - whale.y)
    if (
      scene.clock < scene.targetHoldUntil ||
      candidate === undefined ||
      distance < 70 ||
      huntCost(candidate, whale) >= huntCost(current, whale) * 0.55
    )
      return scene
  }
  const targetId: number | null = candidate === undefined ? null : candidate.id
  return targetId === scene.targetId
    ? scene
    : { ...scene, targetId, targetHoldUntil: scene.clock + 0.75 }
}

/** 预测锁定猎物的短期位置，目标坐标始终位于鲸鱼的可达内区。 */
export function findPreyTarget(scene: PreyScene, whale: Whale): readonly [number, number] | null {
  const locked: Prey | undefined = lockedPrey(scene)
  const closest: Prey | undefined =
    locked === undefined ? nearestHuntablePrey(scene, whale) : locked
  if (closest === undefined) return null
  const dx: number = closest.x - whale.x
  const dy: number = closest.y - whale.y
  const pursuitSpeed: number = clamp(Math.hypot(whale.vx, whale.vy) + 40, 80, 144)
  let lead: number = clamp(Math.hypot(dx, dy) / pursuitSpeed, 0.08, 0.55)
  for (let step: number = 0; step < 3; step++)
    lead = clamp(
      Math.hypot(dx + closest.vx * lead, dy + closest.vy * lead) / pursuitSpeed,
      0.08,
      0.55,
    )
  return [
    clamp(closest.x + closest.vx * lead, 62, 298),
    clamp(closest.y + closest.vy * lead, 177, 258),
  ]
}

/** 只在嘴部附近接触才计数；捕食动画和逃出边缘的清理均保持有界。 */
function stepPrey(scene: PreyScene, dt: number, whale: Whale | null): PreyScene {
  let next: PreyScene = advanceCourse({ ...scene, clock: scene.clock + dt }, whale, dt)
  if (next.clock >= next.nextAt && next.animals.length === 0) next = spawnSchool(next)
  if (next.animals.length === 0) return next
  let consumed: number = next.consumed
  const animals: Prey[] = next.animals
    .map((p: Prey): Prey => {
      const moved: Prey = !p.entered
        ? steerIncomingPrey(p, next, whale, dt)
        : p.kind === 'fish'
          ? steerHerring(p, next, whale, dt)
          : steerShrimp(p, next, whale, dt)
      if (moved.caughtAt !== null || whale === null) return moved
      const mouthX: number = whale.x + whale.direction * 18
      if (
        (moved.x - whale.x) * whale.direction > 2 &&
        Math.hypot(moved.x - mouthX, moved.y - whale.y) < 11
      ) {
        consumed++
        return { ...moved, caughtAt: next.clock }
      }
      return moved
    })
    .filter(
      (p: Prey): boolean =>
        p.x > (p.entered ? -25 : -145) &&
        p.x < (p.entered ? 385 : 505) &&
        p.y < 335 &&
        (p.caughtAt === null || next.clock - p.caughtAt < 0.2),
    )
  if (animals.length === 0) {
    // 从真实离场开始留出空档，长时间追逐不能透支下一次偶遇的等待。
    const [seed, rest] = drawRandom(next.seed)
    return {
      ...next,
      animals,
      consumed,
      seed,
      nextAt: Math.max(next.nextAt, next.clock + 17 + rest * 20),
    }
  }
  return { ...next, animals, consumed }
}

/** 小规模群游保持纯函数和固定子步；暂停或静态模式不产生新的遭遇。 */
export function advancePreyScene(scene: PreyScene, delta: number, whale: Whale | null): PreyScene {
  if (delta <= 0) return scene
  const count: number = Math.ceil(Math.min(delta, 0.1) * 60)
  let next: PreyScene = scene
  for (let i: number = 0; i < count; i++) next = stepPrey(next, Math.min(delta, 0.1) / count, whale)
  return next
}
