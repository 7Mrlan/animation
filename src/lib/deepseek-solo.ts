import type { Whale } from './deepseek-motion.ts'

/** 独处动作只描述意图，推进与浮力仍由运动积分统一处理。 */
export type SoloAction =
  'swim' | 'glide' | 'dash' | 'surface' | 'sound' | 'spyhop' | 'roll' | 'tailSlap' | 'rest'

/** 动作的时间和起点属于实例，暂停后可从原位置继续。 */
export type SoloPlan = Readonly<{
  /** 当前独处意图；swim 表示普通航段。 */
  action: SoloAction
  /** 开始时的模拟时间。 */
  startedAt: number
  /** 结束后重新抽取，避免固定表演循环。 */
  duration: number
  /** 轨迹以动作开始位置为基准，不逐帧追逐移动目标点。 */
  origin: readonly [number, number]
  /** 优先向卡片内部活动。 */
  direction: number
}>

/** 姿态只表达身体动作，不能直接覆盖模型位置或速度。 */
export type SoloPose = Readonly<{
  /** 相对于游动方向的抬头角度，单位为度。 */
  pitch: number
  /** 用于贴水遮挡和背鳍显示的连续权重。 */
  surface: number
  /** 尾击在中间阶段完成一次接触。 */
  tail: number
  /** 浮休的呼吸和鼾声符号共用同一进出权重。 */
  rest: number
  /** 小幅滚身时的腹侧显露量，与左右偏航使用独立进度。 */
  bank: number
}>

/** 将外层航段重置为普通游动，不保留上次嬉游的动作姿态。 */
export function plainSolo(whale: Whale, clock: number): SoloPlan {
  return {
    action: 'swim',
    startedAt: clock,
    duration: 0,
    origin: [whale.x, whale.y],
    direction: whale.direction,
  }
}

/** 每次从带权动作池采样，连续同类动作让位于其他选择。 */
export function chooseSolo(
  whale: Whale,
  clock: number,
  seed: number,
  previous: SoloAction,
  surfaceY: number,
): readonly [SoloPlan, number] {
  const nextSeed: number = (seed * 1664525 + 1013904223) >>> 0
  const choices: readonly SoloAction[] = [
    'glide',
    'glide',
    'dash',
    'dash',
    'surface',
    'surface',
    'sound',
    'spyhop',
    'roll',
    'tailSlap',
    'rest',
  ]
  const speed: number = Math.hypot(whale.vx, whale.vy)
  const depth: number = whale.y - surfaceY
  const candidates: readonly SoloAction[] = choices.filter((action: SoloAction): boolean => {
    if (action === previous) return false
    if (action === 'glide')
      return (
        speed > 32 && Math.abs(whale.vx) > 24 && (whale.vx > 0 ? 300 - whale.x : whale.x - 60) > 80
      )
    if (action === 'rest') return depth > 0 && depth < 78 && speed < 60
    if (action === 'spyhop') return depth < 60 && speed < 45
    if (action === 'tailSlap') return depth < 48 && speed < 45
    return true
  })
  const action: SoloAction = candidates[nextSeed % candidates.length]
  const variation: number = ((nextSeed >>> 8) % 1000) / 1000
  const duration: number =
    action === 'glide'
      ? 1.5 + variation * 1.2
      : action === 'dash'
        ? 1.8 + variation
        : action === 'spyhop'
          ? 4.5 + variation
          : action === 'tailSlap'
            ? 3.2 + variation
            : action === 'rest'
              ? 5.2 + variation
              : 3.8 + variation * 2.5
  const direction: number = whale.x > 235 ? -1 : whale.x < 125 ? 1 : whale.direction
  return [{ action, startedAt: clock, duration, origin: [whale.x, whale.y], direction }, nextSeed]
}

/** 进出动作都保留短暂过渡，防止姿态瞬间弹起或下沉。 */
export function soloEnvelope(plan: SoloPlan, clock: number): number {
  if (plan.duration <= 0) return 0
  const p: number = Math.max(0, Math.min(1, (clock - plan.startedAt) / plan.duration))
  const enter: number = Math.min(1, p / 0.22)
  const exit: number = Math.min(1, (1 - p) / 0.22)
  const smooth = (value: number): number => value * value * (3 - 2 * value)
  return smooth(enter) * smooth(exit)
}

/** 轨迹有长短弧线与深浅变化，水面动作以实际动态水位为基准。 */
export function soloTarget(
  plan: SoloPlan,
  clock: number,
  surfaceY: number,
): readonly [number, number] {
  const p: number = Math.max(
    0,
    Math.min(1, (clock - plan.startedAt) / Math.max(0.01, plan.duration)),
  )
  const enter: number = Math.min(1, p / 0.25)
  const exit: number = Math.max(0, Math.min(1, (p - 0.75) / 0.25))
  const entered: number = enter * enter * (3 - 2 * enter)
  const exited: number = exit * exit * (3 - 2 * exit)
  const distance: number =
    plan.action === 'rest' || plan.action === 'spyhop' || plan.action === 'tailSlap' ? 18 : 100
  const x: number = Math.max(66, Math.min(294, plan.origin[0] + plan.direction * distance))
  const depth: number =
    plan.action === 'spyhop' || plan.action === 'rest'
      ? 7
      : plan.action === 'sound'
        ? 28 + Math.max(0, (p - 0.4) / 0.6) * 68
        : plan.action === 'surface'
          ? 20
          : plan.action === 'tailSlap'
            ? 22
            : 30
  const atSurface: boolean = ['surface', 'rest', 'spyhop', 'sound', 'tailSlap'].includes(
    plan.action,
  )
  const shallow: number = surfaceY + depth
  const settled: number = plan.action === 'sound' ? shallow : shallow + (214 - shallow) * exited
  const y: number = atSurface
    ? plan.origin[1] + (settled - plan.origin[1]) * entered
    : plan.origin[1] +
      (212 + 24 * Math.sin(p * Math.PI * (plan.action === 'roll' ? 2 : 1)) - plan.origin[1]) *
        entered
  return [x, Math.max(surfaceY + 4, Math.min(250, y))]
}

/** 小幅姿态与轨迹同步；探头仍受水支撑，不能进入腾空弹道。 */
export function soloPose(plan: SoloPlan, clock: number): SoloPose {
  const envelope: number = soloEnvelope(plan, clock)
  const p: number = (clock - plan.startedAt) / Math.max(0.01, plan.duration)
  return {
    pitch:
      plan.action === 'spyhop'
        ? 78 * envelope
        : plan.action === 'sound'
          ? -48 * Math.sin(Math.max(0, Math.min(1, (p - 0.3) / 0.7)) * Math.PI)
          : plan.action === 'roll'
            ? 23 * Math.sin(p * Math.PI * 2) * envelope
            : plan.action === 'surface'
              ? -24 * Math.sin(Math.max(0, Math.min(1, (p - 0.65) / 0.35)) * Math.PI)
              : 0,
    surface: plan.action === 'surface' ? envelope : 0,
    tail:
      plan.action === 'tailSlap'
        ? Math.sin(Math.max(0, Math.min(1, p / 0.65)) * Math.PI * 2) * 30 * envelope
        : 0,
    rest: plan.action === 'rest' ? envelope : 0,
    bank:
      plan.action === 'roll'
        ? Math.pow(Math.sin(Math.max(0, Math.min(1, p)) * Math.PI), 2) * envelope
        : 0,
  }
}
