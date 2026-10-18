import assert from 'node:assert/strict'
import test from 'node:test'
import { DECK_CYCLE_MS, deckFrame, deckTimeline, fanFrame } from '../src/lib/subscription-motion.ts'

test('完整循环中每一时刻恰好一张卡片显示文字，且坐标有限', () => {
  for (let index = 0; index < 4; index++) {
    for (let time = 0; time < DECK_CYCLE_MS; time += 10) {
      const { progress, phase } = deckTimeline(time)
      const frame = deckFrame(index, progress, 174, phase)
      assert.equal(frame.filter((card) => card.visible).length, 1)
      assert.ok(frame.every((card) => card.position.every(Number.isFinite)))
      assert.equal(new Set(frame.map((card) => card.z)).size, 4)
    }
  }
})

test('循环衔接时几何位置连续，避免轮到下一张卡片时跳位', () => {
  for (let index = 0; index < 4; index++) {
    const end = deckFrame(index, 1, 174, 'hide')
    const start = deckFrame((index + 1) % 4, 0, 174)
    end.forEach((card, i) => {
      assert.deepEqual(card.position, start[i].position)
      assert.equal(card.visible, start[i].visible)
    })
  }
})

test('从手机到桌面的展开卡片不会互相遮挡文字或越出容器', () => {
  for (const width of [260, 300, 360, 400]) {
    const height = 258
    const poses = fanFrame(width, 174, height)
    const boxes = poses.map((card) => {
      const angle = (Math.abs(card.position[2]) * Math.PI) / 180
      const halfWidth = ((174 * Math.cos(angle) + 110 * Math.sin(angle)) * card.scale) / 2
      const halfHeight = ((110 * Math.cos(angle) + 174 * Math.sin(angle)) * card.scale) / 2
      const x = width / 2 - 8 + card.position[0]
      const y = height / 2 + card.position[1]
      assert.ok(card.visible)
      assert.ok(x - halfWidth >= 0 && x + halfWidth <= width)
      assert.ok(y - halfHeight >= 0 && y + halfHeight <= height)
      return {
        left: x - halfWidth,
        right: x + halfWidth,
        top: y - halfHeight,
        bottom: y + halfHeight,
      }
    })
    assert.ok(boxes[0].right < boxes[1].left)
    assert.ok(boxes[0].bottom < boxes[2].top)
  }
})
