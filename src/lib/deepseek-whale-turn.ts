import { WHALE_ATLAS_FRAMES } from './deepseek-whale-atlas.ts'
export { WHALE_TAIL_PIVOTS } from './deepseek-whale-atlas.ts'

/** 连续转身状态与补间图集解耦，暂停和中途换向都保留当前进度。 */
export type WhaleTurn = Readonly<{
  /** 0 为左侧面，1 为右侧面，中间依次经过斜侧与背面。 */
  position: number
  /** 单位为完整转身/秒，起步与收尾不再瞬间切换速度。 */
  velocity: number
}>

/** 每帧尾柄的连接点，坐标相对于元数据定义的图集单元。 */
export type TailPivot = readonly [x: number, y: number]

/** 主体转向约 0.15 秒完成；保留阻尼收尾与中断时的角速度。 */
const TURN_RESPONSE: number = 34

/** 静态偏好和首次挂载直接显示稳定侧面，不在加载时自动转身。 */
export function createWhaleTurn(direction: number): WhaleTurn {
  return { position: direction < 0 ? 0 : 1, velocity: 0 }
}

/** 临界阻尼的解析解让不同刷新率保持相同节奏，反向时保留角速度连续性。 */
export function advanceWhaleTurn(turn: WhaleTurn, headingX: number, delta: number): WhaleTurn {
  if (delta <= 0) return turn
  const target: number = (Math.max(-1, Math.min(1, headingX)) + 1) / 2
  const dt: number = Math.min(delta, 0.1)
  const offset: number = turn.position - target
  const impulse: number = turn.velocity + TURN_RESPONSE * offset
  const decay: number = Math.exp(-TURN_RESPONSE * dt)
  const position: number = target + (offset + impulse * dt) * decay
  const velocity: number = (turn.velocity - TURN_RESPONSE * impulse * dt) * decay
  return { position: Math.max(0, Math.min(1, position)), velocity }
}

/** 图集中只显示一帧，身体和尾部共用帧号，不交叉淡化或混合左右轮廓。 */
export function whaleTurnFrame(turn: WhaleTurn): number {
  return Math.round(turn.position * (WHALE_ATLAS_FRAMES - 1))
}
