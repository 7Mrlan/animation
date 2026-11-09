import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWhaleTurn,
  advanceWhaleTurn,
  whaleTurnFrame,
  WHALE_TAIL_PIVOTS,
  type WhaleTurn,
} from '../src/lib/deepseek-whale-turn.ts'
import {
  WHALE_ATLAS_CELL,
  WHALE_ATLAS_COLUMNS,
  WHALE_ATLAS_LAYER_ROWS,
  WHALE_ATLAS_FRAMES,
} from '../src/lib/deepseek-whale-atlas.ts'

test('120Hz 双向转身持续更新补间帧，暂停不消耗进度或修改输入', () => {
  for (const direction of [-1, 1]) {
    let turn: WhaleTurn = createWhaleTurn(direction)
    const original: WhaleTurn = turn
    const frames: Set<number> = new Set<number>([whaleTurnFrame(turn)])
    assert.equal(advanceWhaleTurn(turn, -direction, 0), turn)
    for (let i: number = 0; i < 120; i++) {
      turn = advanceWhaleTurn(turn, -direction, 1 / 120)
      frames.add(whaleTurnFrame(turn))
    }
    assert.ok(frames.size >= 25)
    assert.equal(whaleTurnFrame(turn), direction < 0 ? WHALE_ATLAS_FRAMES - 1 : 0)
    assert.deepEqual(original, createWhaleTurn(direction))
  }
})

test('快速转身约 0.15 秒完成主体动作，不拖到长时间停留在背面', () => {
  let turn: WhaleTurn = createWhaleTurn(-1)
  for (let i: number = 0; i < 18; i++) turn = advanceWhaleTurn(turn, 1, 1 / 120)
  assert.ok(turn.position > 0.96)
  for (let i: number = 0; i < 36; i++) turn = advanceWhaleTurn(turn, 1, 1 / 120)
  assert.equal(whaleTurnFrame(turn), WHALE_ATLAS_FRAMES - 1)
})

test('途中反向从当前姿态返回，低帧率保持相同进度，尾柄连接点位于有效图集单元', () => {
  let turn: WhaleTurn = createWhaleTurn(-1)
  turn = advanceWhaleTurn(turn, 1, 0.1)
  const reversed: WhaleTurn = advanceWhaleTurn(turn, -1, 1 / 120)
  assert.ok(Math.abs(reversed.position - turn.position) <= Math.abs(turn.velocity) / 120)
  assert.ok(reversed.velocity < turn.velocity)
  const results: WhaleTurn[] = [20, 60, 120].map((fps: number): WhaleTurn => {
    let state: WhaleTurn = createWhaleTurn(-1)
    for (let i: number = 0; i < fps / 2; i++) state = advanceWhaleTurn(state, 1, 1 / fps)
    return state
  })
  for (const state of results) {
    assert.ok(Math.abs(state.position - results[0].position) < 0.000001)
    assert.ok(Math.abs(state.velocity - results[0].velocity) < 0.000001)
  }
  assert.equal(WHALE_TAIL_PIVOTS.length, WHALE_ATLAS_FRAMES)
  for (const [x, y] of WHALE_TAIL_PIVOTS)
    assert.ok(x > 0 && y > 0 && x < WHALE_ATLAS_CELL && y < WHALE_ATLAS_CELL)
  assert.ok(Math.ceil(WHALE_ATLAS_FRAMES / WHALE_ATLAS_COLUMNS) <= WHALE_ATLAS_LAYER_ROWS)
})
