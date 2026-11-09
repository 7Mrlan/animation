import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWater,
  disturbWater,
  advanceWater,
  sampleWater,
  surfaceSplashPower,
  oceanHeight,
  strikeWater,
  waterImpactShape,
} from '../src/lib/deepseek-water.ts'

test('水面冲击向相邻区域传播，并逐渐衰减而不是持续增幅', () => {
  let water = disturbWater(createWater(), 180, -100)
  for (let i = 0; i < 30; i++) water = advanceWater(water, 1 / 60)
  assert.ok(Math.abs(water.heights[25]) > 0.01)
  const energy = () => [...water.heights, ...water.velocities].reduce((sum, n) => sum + n * n, 0)
  const early = energy()
  for (let i = 0; i < 900; i++) water = advanceWater(water, 1 / 60)
  assert.ok(energy() < early * 0.01)
  assert.ok([...water.heights, ...water.velocities].every(Number.isFinite))
})

test('暂停时不推进水面；重复猛烈冲击仍有界且坐标有限', () => {
  let water = disturbWater(createWater(), 180, -300)
  const before = [...water.velocities]
  advanceWater(water, 0)
  assert.deepEqual([...water.velocities], before)
  for (let i = 0; i < 600; i++) {
    if (i % 6 === 0) water = disturbWater(water, i % 360, -150)
    water = advanceWater(water, 1 / 30)
  }
  assert.ok([...water.heights].every((n) => Number.isFinite(n) && Math.abs(n) <= 32))
  assert.ok(Number.isFinite(sampleWater(water, -10)))
  assert.ok(Number.isFinite(sampleWater(water, 500)))
})

test('入水按接触速度与面积注入有界波能，输入快照不变且余波能传播', () => {
  const initial = createWater()
  const low = waterImpactShape(160, 0.8)
  const high = waterImpactShape(280, 0.8)
  assert.ok(high.radius > low.radius && high.life > low.life && high.impulse > low.impulse)
  assert.ok(waterImpactShape(280, 1).power > waterImpactShape(280, 0.25).power)
  let water = strikeWater(initial, 180, 280, 0.8)
  assert.ok(initial.velocities.every((value: number): boolean => value === 0))
  for (let frame: number = 0; frame < 120; frame++) water = advanceWater(water, 1 / 120)
  assert.ok(Math.abs(water.heights[20]) > 0.01)
  assert.ok(
    water.heights.every(
      (value: number): boolean => Number.isFinite(value) && Math.abs(value) <= 32,
    ),
  )
})

test('环境海面持续起伏且连续，水面函数不修改输入快照', () => {
  const water = createWater()
  const disturbed = disturbWater(water, 180, 100)
  const before = [...disturbed.heights, ...disturbed.velocities]
  advanceWater(disturbed, 1 / 30)
  assert.deepEqual([...disturbed.heights, ...disturbed.velocities], before)
  assert.ok(water.velocities.every((v) => v === 0))
  const levels = Array.from({ length: 600 }, (_v, i) => oceanHeight(180, i / 60))
  assert.ok(Math.max(...levels) - Math.min(...levels) > 10)
  assert.ok(levels.every((level, i) => i === 0 || Math.abs(level - levels[i - 1]) < 1))
})

test('只有靠近水面且在移动时甩出浪花，速度更大则浪花更强并有上限', () => {
  assert.equal(surfaceSplashPower(50, 500), 0)
  assert.equal(surfaceSplashPower(-50, 500), 0)
  assert.equal(surfaceSplashPower(0, 0), 0)
  assert.ok(surfaceSplashPower(0, 400) > surfaceSplashPower(0, 70))
  assert.equal(surfaceSplashPower(0, 10000), 2.4)
})
