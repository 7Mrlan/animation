import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWater,
  disturbWater,
  advanceWater,
  sampleWater,
  surfaceSplashPower,
} from '../src/lib/deepseek-water.ts'

test('水面冲击向相邻区域传播，并逐渐衰减而不是持续增幅', () => {
  const water = createWater()
  disturbWater(water, 180, -100)
  for (let i = 0; i < 30; i++) advanceWater(water, 1 / 60)
  assert.ok(Math.abs(water.heights[30]) > 0.01)
  const energy = () => [...water.heights, ...water.velocities].reduce((sum, n) => sum + n * n, 0)
  const early = energy()
  for (let i = 0; i < 900; i++) advanceWater(water, 1 / 60)
  assert.ok(energy() < early * 0.01)
  assert.ok([...water.heights, ...water.velocities].every(Number.isFinite))
})

test('暂停时不推进水面；重复猛烈冲击仍有界且坐标有限', () => {
  const water = createWater()
  disturbWater(water, 180, -300)
  const before = [...water.velocities]
  advanceWater(water, 0)
  assert.deepEqual([...water.velocities], before)
  for (let i = 0; i < 600; i++) {
    if (i % 6 === 0) disturbWater(water, i % 360, -150)
    advanceWater(water, 1 / 30)
  }
  assert.ok([...water.heights].every((n) => Number.isFinite(n) && Math.abs(n) <= 20))
  assert.ok(Number.isFinite(sampleWater(water, -10)))
  assert.ok(Number.isFinite(sampleWater(water, 500)))
})

test('只有靠近水面且在移动时甩出浪花，速度更大则浪花更强并有上限', () => {
  assert.equal(surfaceSplashPower(50, 500), 0)
  assert.equal(surfaceSplashPower(-50, 500), 0)
  assert.equal(surfaceSplashPower(0, 0), 0)
  assert.ok(surfaceSplashPower(0, 400) > surfaceSplashPower(0, 70))
  assert.equal(surfaceSplashPower(0, 10000), 2.4)
})
