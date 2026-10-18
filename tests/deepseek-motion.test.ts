import assert from 'node:assert/strict'
import test from 'node:test'
import { createSwimMotion } from '../src/lib/deepseek-motion.ts'

test('不同初始位置在起伏水面下持续巡游、鲸跃和落水，路径连续且不越界', () => {
  for (let k = 0; k < 12; k++) {
    let seed = k + 1
    let time = 0
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 2 ** 32
    }
    const fish = { x: 45 + k * 22, y: 185, vx: 0, vy: 0, direction: k % 2 ? 1 : -1 }
    const splashes: number[] = []
    const motion = createSwimMotion(
      fish,
      random,
      (x) => 146 + 7 * Math.sin(x * 0.026 - time),
      (_x, power) => splashes.push(power),
    )
    motion.release()
    const phases = new Set<string>()
    let low = 300,
      high = 0
    for (let i = 0; i < 60 * 90; i++) {
      const previous = { ...fish }
      time = i / 60
      motion.update(1 / 60)
      phases.add(motion.state.phase)
      low = Math.min(low, fish.y)
      high = Math.max(high, fish.y)
      assert.ok([fish.x, fish.y, fish.vx, fish.vy].every(Number.isFinite))
      assert.ok(fish.x >= 32 && fish.x <= 328 && fish.y >= 58 && fish.y <= 240)
      assert.ok(Math.hypot(fish.x - previous.x, fish.y - previous.y) < 7)
    }
    assert.ok(phases.has('breach') && phases.has('dive') && phases.has('rise'))
    assert.ok(low < 80 && high > 205)
    assert.ok(splashes.filter((power) => power === 2.5).length >= 4)
  }
})

test('暂停不推进时钟，抓住小鲸后从手动位置连续恢复', () => {
  const fish = { x: 180, y: 190, vx: 0, vy: 0, direction: 1 }
  const motion = createSwimMotion(
    fish,
    () => 0.5,
    () => 146,
    () => {},
  )
  motion.requestBreach()
  motion.update(0)
  assert.equal(motion.state.clock, 0)
  assert.equal(fish.x, 180)
  motion.grab()
  fish.x = 78
  fish.y = 210
  motion.release()
  motion.update(1 / 60)
  assert.ok(Math.hypot(fish.x - 78, fish.y - 210) < 7)
})
