import { plainSolo, chooseSolo, soloTarget, type SoloPlan } from './deepseek-solo.ts'
import type { WaterCurrent } from './deepseek-water.ts'

/** 舞台单位为 360 × 300；速度为单位/秒，输入快照始终保持不变。 */
export type Whale = Readonly<{
  /** 水平位置。 */
  x: number
  /** 垂直位置，向下为正。 */
  y: number
  /** 水平惯性，用于衔接拖拽与自主游动。 */
  vx: number
  /** 垂直惯性，离水后由重力推进。 */
  vy: number
  /** 最近一次稳定的朝向，低速时不反复翻转。 */
  direction: number
}>

/** recover 保留落水动量，gather 与 breach 分别表示水下蓄力和离水过程。 */
export type SwimPhase =
  | 'idle'
  | 'drag'
  | 'dive'
  | 'rise'
  | 'cruise'
  | 'gather'
  | 'prepare'
  | 'breach'
  | 'recover'
  | 'hunt'
  | 'lunge'
  | 'feed'

/** 可序列化运动快照；随机序列与时钟均属于实例，便于确定性复现。 */
export type SwimMotion = Readonly<{
  /** 当前角色位置和动量。 */
  whale: Whale
  /** 决定本步受到的推进力和阻力。 */
  phase: SwimPhase
  /** 仅在实际播放时累计。 */
  clock: number
  /** 当前阶段的经过时间。 */
  age: number
  /** 下一次自主鲸跃的播放时间。 */
  nextBreach: number
  /** 离水后的姿态时钟。 */
  flightAge: number
  /** 是否已经完全越过水面。 */
  airborne: boolean
  /** 水下起跳推力的目标方向，与正在减速的惯性方向分离。 */
  launchDirection: number
  /** 吞食后的短暂减速，不以瞬间清零速度表现进食。 */
  feedingUntil: number
  /** 区分邀请与甩动来源；猎物仍可中断未起跳的准备阶段。 */
  breachIntent: 'auto' | 'manual' | 'throw'
  /** 捕食冲刺的承诺窗口，期间不逐帧改追另一只鱼。 */
  lungeUntil: number
  /** 两次冲刺之间需要恢复，避免连续无代价加速。 */
  nextLungeAt: number
  /** 大角度水下掉头保持同一转向，避免目标变化导致弧线左右打摆。 */
  turnSide: number
  /** 巡游目标，提前切换以避免抵达后刹停。 */
  target: readonly [number, number]
  /** 深浅航段的轮换索引。 */
  route: number
  /** 伪随机种子，避免全局随机状态。 */
  seed: number
  /** 独处动作与航段分离，捕食期间不播放。 */
  solo: SoloPlan
  /** 行为之间留出随机空档，不串成固定节目。 */
  nextSoloAt: number
  /** 出水速度预算，按上方空间进一步收束。 */
  launchSpeed: number
  /** 最近一次入水或拍尾事件，场景按编号只消费一次。 */
  impact: WaterImpact | null
}>

/** 动量传给水面时记录减速前的速度，不能拿回稳后的慢速代替撞击。 */
export type WaterImpact = Readonly<{
  /** 单调递增的接触编号。 */
  id: number
  /** 实际接触横坐标。 */
  x: number
  /** 沿局部海面法向的入水速度。 */
  speed: number
  /** 尾击只动用局部质量，能量小于全身入水。 */
  area: number
}>

/** 限制数值而不更改调用方的运动快照。 */
const limit = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/** 用舞台单位表达的重力；让离水段短促，避免小鲸像滑翔机横跨卡片。 */
const AIR_GRAVITY: number = 510

/** 创建静止小鲸；只有用户入水或邀请鲸跃后才开始巡游。 */
export function createSwimMotion(whale: Whale, seed: number): SwimMotion {
  return {
    whale: { ...whale },
    phase: 'idle',
    clock: 0,
    age: 0,
    nextBreach: 6.8,
    flightAge: 0,
    airborne: false,
    launchDirection: whale.direction,
    feedingUntil: 0,
    breachIntent: 'auto',
    lungeUntil: 0,
    nextLungeAt: 0,
    turnSide: 0,
    target: [180, 205],
    route: 0,
    seed,
    solo: plainSolo(whale, 0),
    nextSoloAt: 2.8 + (seed % 200) / 100,
    launchSpeed: 250,
    impact: null,
  }
}

/** 规划有深浅变化的目标点，通过受限加速度追踪而非直接覆盖坐标。 */
function planLeg(motion: SwimMotion, phase: SwimPhase): SwimMotion {
  const seed: number = (motion.seed * 1664525 + 1013904223) >>> 0
  const variation: number = seed / 4294967296
  const direction: number =
    motion.whale.x > 240 ? -1 : motion.whale.x < 120 ? 1 : motion.whale.direction
  const x: number =
    phase === 'gather'
      ? motion.whale.x > 180
        ? 246
        : 114
      : limit(motion.whale.x + direction * (90 + variation * 65), 64, 296)
  const y: number =
    phase === 'gather'
      ? 201
      : phase === 'dive'
        ? 241 + variation * 13
        : phase === 'rise'
          ? 185 + variation * 15
          : 207 + variation * 25
  return {
    ...motion,
    phase,
    age: 0,
    target: [x, y],
    seed,
    solo: { ...plainSolo(motion.whale, motion.clock), action: motion.solo.action },
  }
}

/** 先进入水下准备区，再用真实推进累积出水速度。 */
function prepareBreach(motion: SwimMotion): SwimMotion {
  const seed: number = (motion.seed * 1664525 + 1013904223) >>> 0
  return {
    ...motion,
    phase: 'prepare',
    age: 0,
    seed,
    target: [limit(motion.whale.x, 96, 264), 240],
    launchDirection: motion.whale.x > 180 ? -1 : 1,
    launchSpeed: 226 + ((seed % 1000) / 1000) * 62,
    solo: plainSolo(motion.whale, motion.clock),
  }
}

/** 抓取中只保存用户位置，不推进自主运动。 */
export function grabWhale(motion: SwimMotion, whale: Whale): SwimMotion {
  return { ...motion, whale: { ...whale }, phase: 'drag', age: 0 }
}

/** 保留松手速度；水面上方进入抛物线，不悬空接入游泳曲线。 */
export function releaseWhale(motion: SwimMotion, whale: Whale): SwimMotion {
  const released: SwimMotion = {
    ...motion,
    whale: { ...whale },
    nextBreach: Math.max(motion.clock + 3.2, motion.nextBreach),
  }
  if (whale.y < 140) return tossWhale(released, whale)
  return planLeg(
    released,
    whale.vy < -20 || whale.y > 230 ? 'rise' : whale.vy > 20 ? 'dive' : 'cruise',
  )
}

/** 轻甩继承方向和力度；只限制会使角色飞出舞台的能量。 */
export function tossWhale(motion: SwimMotion, whale: Whale): SwimMotion {
  const vy: number = Math.max(whale.vy, -Math.sqrt(2 * AIR_GRAVITY * Math.max(0, whale.y - 48)))
  const flight: number = Math.max(
    0.35,
    (-vy + Math.sqrt(vy * vy + 2 * AIR_GRAVITY * Math.max(0, 172 - whale.y))) / AIR_GRAVITY,
  )
  const vx: number = limit(
    whale.vx,
    Math.max(-28 / flight, (42 - whale.x) / flight),
    Math.min(28 / flight, (318 - whale.x) / flight),
  )
  return {
    ...motion,
    whale: { ...whale, vx, vy },
    phase: 'breach',
    age: 0,
    flightAge: 0,
    airborne: true,
    breachIntent: 'throw',
  }
}

/** 蓄力与腾空期间重复邀请保持幂等，避免连续点击无限延后起跳。 */
export function requestBreach(motion: SwimMotion): SwimMotion {
  if (
    motion.phase === 'prepare' ||
    motion.phase === 'gather' ||
    motion.phase === 'breach' ||
    motion.phase === 'drag'
  )
    return motion
  return prepareBreach({ ...motion, breachIntent: 'manual' })
}

/** 追逐保留惯性并逐步加速；抓取、已开始的腾空与落水先完成安全衔接。 */
export function pursuePrey(motion: SwimMotion, target: readonly [number, number]): SwimMotion {
  if (motion.phase === 'feed') return { ...motion, target }
  if (
    motion.phase === 'drag' ||
    motion.phase === 'breach' ||
    motion.phase === 'recover' ||
    motion.phase === 'lunge'
  )
    return motion
  const dx: number = target[0] - motion.whale.x
  const dy: number = target[1] - motion.whale.y
  const distance: number = Math.max(1, Math.hypot(dx, dy))
  const speed: number = Math.hypot(motion.whale.vx, motion.whale.vy)
  const alignment: number =
    (dx * motion.whale.vx + dy * motion.whale.vy) / (distance * Math.max(1, speed))
  const ux: number = dx / distance
  const uy: number = dy / distance
  const xRoom: number =
    Math.abs(ux) < 0.001
      ? 1000
      : (ux > 0 ? 301 - motion.whale.x : motion.whale.x - 59) / Math.abs(ux)
  const yRoom: number =
    Math.abs(uy) < 0.001
      ? 1000
      : (uy > 0 ? 251 - motion.whale.y : motion.whale.y - 174) / Math.abs(uy)
  const attackDistance: number = Math.min(82, distance + 24, xRoom, yRoom)
  const endX: number = motion.whale.x + ux * attackDistance
  const endY: number = motion.whale.y + uy * attackDistance
  if (
    motion.phase === 'hunt' &&
    motion.whale.y > 166 &&
    motion.age > 0.3 &&
    motion.clock >= motion.nextLungeAt &&
    distance > 22 &&
    distance < 98 &&
    speed > 28 &&
    alignment > 0.65 &&
    attackDistance > 28 &&
    endX > 60 &&
    endX < 300 &&
    endY > 171 &&
    endY < 252
  ) {
    return {
      ...motion,
      phase: 'lunge',
      age: 0,
      target: [endX, endY],
      lungeUntil: motion.clock + limit(attackDistance / 142, 0.36, 0.62),
      nextLungeAt: motion.clock + 2.2,
    }
  }
  return { ...motion, phase: 'hunt', target, age: motion.phase === 'hunt' ? motion.age : 0 }
}

/** 追逐失败或猎物离开后回到巡游，延后自动鲸跃以留下水下休息时间。 */
export function finishPursuit(motion: SwimMotion): SwimMotion {
  return motion.phase === 'hunt'
    ? planLeg({ ...motion, nextBreach: Math.max(motion.nextBreach, motion.clock + 5) }, 'dive')
    : motion
}

/** 同一吞食窗口可收拢多个个体，但不能反复重置恢复计时；期间继续观察下一目标。 */
export function recordFeeding(motion: SwimMotion): SwimMotion {
  return motion.phase === 'hunt' || motion.phase === 'lunge'
    ? {
        ...motion,
        phase: 'feed',
        age: 0,
        feedingUntil: motion.clock + 0.42,
        nextLungeAt: Math.min(motion.nextLungeAt, motion.clock + 0.75),
      }
    : motion
}

/** 猎物在入口时也退出独处动作与起跳准备，不能等待目标锁定才唤醒。 */
export function deferAutoBreach(motion: SwimMotion): SwimMotion {
  const pending: SwimMotion = {
    ...motion,
    nextBreach: Math.max(motion.nextBreach, motion.clock + 4),
    nextSoloAt: Math.max(motion.nextSoloAt, motion.clock + 2),
  }
  const interruptible: boolean =
    (['dive', 'rise', 'cruise'].includes(motion.phase) && motion.solo.duration > 0) ||
    motion.phase === 'prepare' ||
    motion.phase === 'gather'
  return interruptible ? planLeg(pending, 'cruise') : pending
}

/** 推进强度共同驱动运动和尾部表现，滑行时尾部真正放松。 */
export function swimEffort(motion: SwimMotion): number {
  if (motion.phase === 'prepare') return 0.6
  if (motion.phase === 'gather') return 0.9
  if (motion.phase === 'breach') return motion.airborne ? 0 : 1
  if (motion.phase === 'lunge') return 1
  if (motion.phase === 'hunt') return 0.7
  if (motion.phase === 'feed' || motion.phase === 'recover') return 0.15
  if (motion.solo.duration <= 0 || motion.clock >= motion.solo.startedAt + motion.solo.duration)
    return 0.38 + 0.16 * Math.sin(motion.clock * 1.7)
  if (motion.solo.action === 'spyhop' || motion.solo.action === 'surface')
    return motion.whale.y - motion.target[1] > 12 ? 0.65 : 0.22
  if (motion.solo.action === 'rest')
    return motion.whale.y - motion.target[1] > 18 ||
      motion.clock - motion.solo.startedAt > motion.solo.duration * 0.75
      ? 0.5
      : 0.12
  if (motion.solo.action === 'glide') return 0.1
  if (motion.solo.action === 'dash')
    return Math.max(0.12, 1 - (motion.clock - motion.solo.startedAt) / 1.2)
  return 0.38 + 0.16 * Math.sin(motion.clock * 1.7)
}

/** 单步积分限制推进加速度；水下阻力逐渐消耗落水动量。 */
function stepMotion(
  motion: SwimMotion,
  dt: number,
  surfaceY: (x: number) => number,
  current: WaterCurrent,
): SwimMotion {
  if (motion.phase === 'idle' || motion.phase === 'drag') return motion
  let next: SwimMotion = { ...motion, clock: motion.clock + dt, age: motion.age + dt }
  const fish: Whale = motion.whale
  const ordinary: boolean =
    next.phase === 'dive' || next.phase === 'rise' || next.phase === 'cruise'
  if (
    ordinary &&
    next.solo.action === 'rest' &&
    next.solo.duration > 0 &&
    next.clock - next.solo.startedAt > next.solo.duration * 0.45 &&
    fish.y - surfaceY(fish.x) > 28
  )
    next = planLeg({ ...next, nextSoloAt: next.clock + 8 }, 'rise')
  if (
    ordinary &&
    next.solo.duration > 0 &&
    next.clock >= next.solo.startedAt + next.solo.duration
  ) {
    next = planLeg(
      { ...next, nextSoloAt: next.clock + 6 + (next.seed % 600) / 100 },
      next.solo.action === 'surface' || next.solo.action === 'rest' ? 'dive' : 'cruise',
    )
  }
  if (
    ordinary &&
    next.solo.duration === 0 &&
    next.clock >= next.nextSoloAt &&
    next.clock < next.nextBreach
  ) {
    const [solo, seed] = chooseSolo(fish, next.clock, next.seed, next.solo.action, surfaceY(fish.x))
    next = { ...next, solo, seed, turnSide: 0 }
  }
  const activeSolo: boolean = ordinary && next.solo.duration > 0
  if (
    activeSolo &&
    ['surface', 'sound', 'rest', 'spyhop', 'tailSlap'].includes(next.solo.action) &&
    ((fish.x > 278 && next.solo.direction > 0) || (fish.x < 82 && next.solo.direction < 0))
  )
    next = { ...next, solo: { ...next.solo, direction: -next.solo.direction } }
  if (activeSolo) next = { ...next, target: soloTarget(next.solo, next.clock, surfaceY(fish.x)) }
  let ax: number = 0
  let ay: number = 0
  if (next.phase === 'breach') {
    if (!next.airborne && fish.y < surfaceY(fish.x) - 24) {
      const flight: number = Math.max(0.3, (Math.abs(fish.vy) * 2) / AIR_GRAVITY)
      next = {
        ...next,
        // 鲸鱼已离开水面，进入抛物线滑行
        airborne: true,
        // 空中滑行时收窄水平速度，避免一次跃出飞出画面
        whale: { ...fish, vx: limit(fish.vx, -28 / flight, 28 / flight) },
      }
    }
    if (next.airborne) {
      ay = AIR_GRAVITY
      next = { ...next, flightAge: next.flightAge + dt }
    } else {
      const safeSpeed: number = Math.sqrt(
        2 * AIR_GRAVITY * Math.max(24, surfaceY(fish.x) - 24 - 54),
      )
      ax = (next.launchDirection * 22 + current.x - fish.vx) * 5
      ay = limit((Math.max(-safeSpeed, -next.launchSpeed + current.y) - fish.vy) * 9, -760, 760)
    }
  } else if (next.phase === 'gather') {
    ax = (next.launchDirection * 22 + current.x - fish.vx) * 4
    ay = (-85 + current.y - fish.vy) * 4.5
  } else if (next.phase === 'recover') {
    const immersed: number = limit((fish.y - surfaceY(fish.x) + 20) / 40, 0, 1)
    // 随浸没体积增加浮力与二次水阻，保留穿水惯性但不继续自由落体。
    ax = (fish.direction * 25 + current.x - fish.vx) * (0.8 + immersed * 1.8)
    ay =
      AIR_GRAVITY * (1 - immersed) -
      32 * immersed -
      (fish.vy - current.y) * (2.6 + Math.abs(fish.vy - current.y) * 0.012) * immersed
  } else if (next.phase === 'feed') {
    // 吞入海水后减速但保留前向滑行，不回头追已经经过的嘴部位置。
    ax = (fish.direction * 26 + current.x - fish.vx) * 4.8
    ay = -(fish.vy - current.y) * 4.8
    ax +=
      Math.max(0, 56 - fish.x - fish.vx * 0.3) * 8 - Math.max(0, fish.x + fish.vx * 0.3 - 304) * 8
    ay +=
      Math.max(0, 175 - fish.y - fish.vy * 0.3) * 7 - Math.max(0, fish.y + fish.vy * 0.3 - 251) * 10
  } else if (
    activeSolo &&
    ['surface', 'rest', 'spyhop', 'sound', 'tailSlap'].includes(next.solo.action)
  ) {
    const progress: number = (next.clock - next.solo.startedAt) / next.solo.duration
    const pace: number =
      next.solo.action === 'surface'
        ? 28
        : next.solo.action === 'sound'
          ? 24
          : next.solo.action === 'rest' &&
              (progress < 0.25 || progress > 0.75 || fish.y - surfaceY(fish.x) > 24)
            ? 24
            : next.solo.action === 'rest' || next.solo.action === 'spyhop'
              ? 5
              : 18
    ax = (next.solo.direction * pace + current.x - fish.vx) * 3
    ay = (next.target[1] - fish.y) * 18 - (fish.vy - current.y) * 8
    ax +=
      Math.max(0, 62 - fish.x - fish.vx * 0.35) * 10 -
      Math.max(0, fish.x + fish.vx * 0.35 - 298) * 10
    if (next.solo.action === 'tailSlap') {
      const contactAt: number = next.solo.startedAt + next.solo.duration * 0.52
      if (
        motion.clock < contactAt &&
        next.clock >= contactAt &&
        Math.abs(fish.y - surfaceY(fish.x)) < 48
      ) {
        next = {
          ...next,
          // 尾拍落点产生的水花冲击，驱动水面特效重放
          impact: {
            // 自增编号，特效据此判断是否需要重新播放
            id: (next.impact?.id ?? 0) + 1,
            // 冲击点横坐标，落在尾鳍拍击水面的位置
            x: fish.x - fish.direction * 23,
            // 水花向外扩散的初始速度
            speed: 95,
            // 水花覆盖范围，取值 0-1
            area: 0.25,
          },
        }
      }
    }
  } else if (activeSolo && next.solo.action === 'glide') {
    ax = -(fish.vx - current.x) * 0.24
    ay = (next.target[1] - fish.y) * 0.8 - (fish.vy - current.y) * 1.8
    ax += Math.max(0, 65 - fish.x) * 7 - Math.max(0, fish.x - 295) * 7
  } else {
    const dx: number = next.target[0] - fish.x
    const dy: number = next.target[1] - fish.y
    const distance: number = Math.max(1, Math.hypot(dx, dy))
    const cruisingSpeed: number =
      next.phase === 'lunge'
        ? 144
        : next.phase === 'hunt'
          ? next.clock < next.feedingUntil
            ? 34
            : 56 + 38 * (1 - Math.exp(-next.age * 2))
          : next.phase === 'prepare'
            ? 64
            : activeSolo &&
                next.solo.action === 'dash' &&
                next.clock - next.solo.startedAt < next.solo.duration * 0.45
              ? 92
              : 43 + 10 * Math.sin(next.clock * 0.9)
    const speed: number = cruisingSpeed * (next.phase === 'hunt' ? limit(distance / 48, 0, 1) : 1)
    const desiredX: number =
      (dx / distance) * speed +
      current.x +
      (next.phase === 'hunt' || next.phase === 'lunge'
        ? 0
        : Math.sin(next.clock * 0.7 + fish.y * 0.025) * 3)
    const desiredY: number = (dy / distance) * speed + current.y
    // 追逐接近目标后采用临界附近的阻尼，避免固定速度穿过目标再反复掉头。
    const response: number =
      next.phase === 'hunt'
        ? 6.4
        : next.phase === 'lunge'
          ? 8
          : activeSolo && next.solo.action === 'dash'
            ? 5
            : 2.3
    const forceX: number = (desiredX - fish.vx) * response
    const forceY: number = (desiredY - fish.vy) * response
    const force: number = Math.max(
      1,
      Math.hypot(forceX, forceY) /
        (next.phase === 'hunt' ? 180 : next.phase === 'lunge' ? 380 : 130),
    )
    ax = forceX / force
    ay = forceY / force
    const currentSpeed: number = Math.hypot(fish.vx, fish.vy)
    const heading: number = Math.atan2(fish.vy, fish.vx)
    const error: number = Math.atan2(
      Math.sin(Math.atan2(dy, dx) - heading),
      Math.cos(Math.atan2(dy, dx) - heading),
    )
    const turnSide: number =
      distance < 28 || Math.abs(error) < 0.55 || currentSpeed < 12
        ? 0
        : next.turnSide !== 0
          ? next.turnSide
          : Math.abs(error) > 1.9 && distance > 35 && currentSpeed > 22
            ? Math.sign(fish.vx) * (fish.y < 213 ? 1 : -1)
            : 0
    next = { ...next, turnSide }
    if (turnSide !== 0) {
      // 将大反向指令分解为切向推力与侧向转弯力，不能靠刹停再倒车完成掉头。
      const clearance: number = fish.vx > 0 ? 314 - fish.x : fish.x - 46
      const turnSpeed: number = Math.min(speed, Math.max(20, clearance * 1.1), 42)
      const thrust: number = limit((turnSpeed - currentSpeed) * response, -120, 150)
      const angularSpeed: number = turnSide * Math.min(2.8, 180 / Math.max(25, currentSpeed))
      ax = Math.cos(heading) * thrust - Math.sin(heading) * angularSpeed * currentSpeed
      ay = Math.sin(heading) * thrust + Math.cos(heading) * angularSpeed * currentSpeed
    }
    // 软边界提前转弯，不等到角色碰壁才反射速度。
    ax += Math.max(0, 61 - fish.x) * 7 - Math.max(0, fish.x - 299) * 7
    ay += Math.max(0, 171 - fish.y) * 4 - Math.max(0, fish.y - 253) * 8
  }
  const vx: number = next.whale.vx + ax * dt
  const vy: number = fish.vy + ay * dt
  const x: number = limit(fish.x + (fish.vx + vx) * 0.5 * dt, 38, 322)
  const y: number = limit(fish.y + (fish.vy + vy) * 0.5 * dt, 46, 268)
  const launching: boolean =
    next.phase === 'prepare' ||
    next.phase === 'gather' ||
    (next.phase === 'breach' && !next.airborne)
  const direction: number = launching
    ? next.launchDirection
    : Math.abs(vx) > 9
      ? Math.sign(vx)
      : fish.direction
  next = { ...next, whale: { x, y, vx, vy, direction } }
  if (next.phase === 'breach') {
    if (next.airborne && vy > 0 && y > surfaceY(x) - 20) {
      const slope: number = (surfaceY(x + 2) - surfaceY(x - 2)) / 4
      const normalSpeed: number = Math.max(0, (vy - vx * slope) / Math.sqrt(1 + slope * slope))
      next = planLeg(
        {
          ...next,
          nextBreach: next.clock + 25 + (next.seed % 1400) / 100,
          nextSoloAt: next.clock + 4,
          // 鲸鱼落回水面时的水花冲击，驱动水面特效
          impact: {
            // 自增编号，特效据此判断是否需要重新播放
            id: (next.impact?.id ?? 0) + 1,
            // 冲击点横坐标，取鲸鱼落水位置
            x,
            // 沿水面法线方向的入水速度，决定水花大小
            speed: normalSpeed,
            // 水花覆盖范围，横向入水时扩散更宽
            area: 0.8 + (Math.abs(vx) / Math.max(1, Math.hypot(vx, vy))) * 0.35,
          },
        },
        'recover',
      )
    }
  } else if (next.phase === 'prepare') {
    if ((y > 224 && next.age > 0.8) || next.age > 3.2)
      next = { ...next, phase: 'gather', age: 0, turnSide: 0 }
  } else if (next.phase === 'gather') {
    if (next.age > 0.7) {
      next = {
        ...next,
        // 蓄力完成，进入跃出水面阶段
        phase: 'breach',
        // 新阶段计时从零开始
        age: 0,
        // 空中滑行计时清零
        flightAge: 0,
        // 重新起跳，先回到贴水状态
        airborne: false,
        // 起跳朝向对齐蓄力时选定的方向
        whale: { ...next.whale, direction: next.launchDirection },
      }
    }
  } else if (next.phase === 'recover') {
    if (next.age > 0.75 && Math.abs(vy) < 75) next = planLeg(next, 'dive')
  } else if (next.phase === 'lunge') {
    if (next.clock >= next.lungeUntil) next = { ...next, phase: 'hunt', age: 0 }
  } else if (next.phase === 'feed') {
    if (next.clock >= next.feedingUntil) next = { ...next, phase: 'hunt', age: 0.2 }
  } else if (next.phase === 'hunt') {
    return next
  } else if (
    activeSolo &&
    ['dash', 'roll'].includes(next.solo.action) &&
    Math.hypot(x - next.target[0], y - next.target[1]) < 25
  ) {
    next = planLeg({ ...next, nextSoloAt: next.clock + 6 }, 'cruise')
  } else if (next.clock >= next.nextBreach && !activeSolo) {
    next = prepareBreach({ ...next, breachIntent: 'auto' })
  } else if (
    !activeSolo &&
    (Math.hypot(x - next.target[0], y - next.target[1]) < 22 || next.age > 5)
  ) {
    const phases: readonly SwimPhase[] = ['rise', 'cruise', 'dive']
    next = planLeg({ ...next, route: next.route + 1 }, phases[next.seed % phases.length])
  }
  return next
}

/** 最长 1/120 秒子步保持不同刷新率一致，暂停不消耗时钟或修改输入。 */
export function advanceSwimMotion(
  motion: SwimMotion,
  delta: number,
  surfaceY: (x: number) => number,
): SwimMotion {
  return advanceSwimMotionWithCurrent(motion, delta, surfaceY, (): WaterCurrent => ({ x: 0, y: 0 }))
}

/** 注入同一世界时刻的流场，空中不受水流推进；保留无流场接口以复现原有轨迹。 */
export function advanceSwimMotionWithCurrent(
  motion: SwimMotion,
  delta: number,
  surfaceY: (x: number) => number,
  currentAt: (x: number, y: number, elapsed: number) => WaterCurrent,
): SwimMotion {
  if (delta <= 0) return motion
  const count: number = Math.ceil(Math.min(delta, 0.1) * 120)
  const dt: number = Math.min(delta, 0.1) / count
  let next: SwimMotion = motion
  for (let i: number = 0; i < count; i++)
    next = stepMotion(next, dt, surfaceY, currentAt(next.whale.x, next.whale.y, (i + 1) * dt))
  return next
}
