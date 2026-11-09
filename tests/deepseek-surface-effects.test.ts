import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSurfaceEffects,
  advanceSurfaceEffects,
  addFlukePrint,
  addWindFoam,
  addImpactFoam,
  footprintCalm,
  breakingCrests,
  surfaceMarkStrength,
  type SurfaceEffects,
} from '../src/lib/deepseek-surface-effects.ts'
import { oceanCurrent, oceanHeight, windGust, waterImpactShape } from '../src/lib/deepseek-water.ts'
import {
  createSwimMotion,
  releaseWhale,
  tossWhale,
  advanceSwimMotion,
  advanceSwimMotionWithCurrent,
  type SwimMotion,
  type Whale,
} from '../src/lib/deepseek-motion.ts'

test('泡沫只在破碎条件和冲击后生成，持续海况中同时存在平静与破浪片段', () => {
  const flat: readonly number[] = Array.from({ length: 61 }, (): number => 147)
  assert.deepEqual(breakingCrests(flat, 1), [])
  const steep: readonly number[] = flat.map(
    (_value: number, index: number): number => 147 + Math.cos(index * 0.8) * 8,
  )
  assert.equal(breakingCrests(steep, 0.1).length, 0)
  assert.ok(breakingCrests(steep, 0.9).length > 0)
  let breaking: number = 0
  for (let second: number = 0; second < 120; second++) {
    const heights: readonly number[] = flat.map((_value: number, index: number): number =>
      oceanHeight(index * 6, second),
    )
    if (breakingCrests(heights, windGust(second)).length > 0) breaking++
  }
  assert.ok(breaking > 0 && breaking < 80)
})

test('浮沫和水印同向漂移，暂停保存快照，有限时间内全部消退', () => {
  const initial: SurfaceEffects = createSurfaceEffects()
  let effects: SurfaceEffects = addFlukePrint(addWindFoam(initial, 180, 0.8), 180, 1)
  const before: SurfaceEffects = effects
  assert.equal(advanceSurfaceEffects(effects, 0), effects)
  for (let frame: number = 0; frame < 60; frame++) effects = advanceSurfaceEffects(effects, 1 / 60)
  assert.ok(effects.foam[0].x > 181 && effects.footprints[0].x > 181)
  assert.equal(effects.foam[0].x, effects.footprints[0].x)
  assert.equal(before.foam[0].x, 180)
  assert.equal(initial.foam.length, 0)
  effects = advanceSurfaceEffects(effects, 8)
  assert.equal(effects.foam.length + effects.footprints.length, 0)
})

test('尾鳍水印延迟形成、只平滑局部短风纹，重叠也不会压平整片海', () => {
  let effects: SurfaceEffects = createSurfaceEffects()
  for (let index: number = 0; index < 30; index++) effects = addFlukePrint(effects, 180, 1)
  assert.equal(effects.footprints.length, 4)
  assert.equal(footprintCalm(effects, 180), 0)
  effects = advanceSurfaceEffects(effects, 1)
  const calm: number = footprintCalm(effects, effects.footprints[0].x)
  assert.ok(calm > 0.2 && calm <= 0.65)
  assert.ok(footprintCalm(effects, 0) < 0.001)
  assert.equal(
    surfaceMarkStrength({ ...effects.footprints[0], age: effects.footprints[0].life }),
    0,
  )
  for (let index: number = 0; index < 30; index++)
    effects = addImpactFoam(effects, 180, waterImpactShape(280, 0.8))
  assert.equal(effects.foam.length, 18)
})

test('被动滑行受到水流影响，离水弹道不会被海流推着飞', () => {
  const whale: Whale = { x: 180, y: 210, vx: 35, vy: 0, direction: 1 }
  const base: SwimMotion = {
    ...releaseWhale(createSwimMotion(whale, 527), whale),
    phase: 'cruise',
    nextBreach: 100,
    solo: { action: 'glide', startedAt: 0, duration: 2, origin: [180, 210], direction: 1 },
  }
  let calm: SwimMotion = base
  let flowing: SwimMotion = base
  for (let frame: number = 0; frame < 180; frame++) {
    calm = advanceSwimMotion(calm, 1 / 120, (): number => 147)
    flowing = advanceSwimMotionWithCurrent(
      flowing,
      1 / 120,
      (): number => 147,
      (): { x: number; y: number } => ({ x: 4, y: 0 }),
    )
  }
  assert.ok(flowing.whale.x > calm.whale.x + 0.5)
  const thrown: Whale = { ...whale, y: 120, vx: 20, vy: -150 }
  calm = tossWhale(createSwimMotion(thrown, 527), thrown)
  flowing = calm
  for (let frame: number = 0; frame < 30; frame++) {
    calm = advanceSwimMotion(calm, 1 / 120, (): number => 147)
    flowing = advanceSwimMotionWithCurrent(
      flowing,
      1 / 120,
      (): number => 147,
      (): { x: number; y: number } => ({ x: 4, y: 0.5 }),
    )
    assert.deepEqual(flowing.whale, calm.whale)
  }
})

test('统一时钟的海流在 20、60、120Hz 下保持相同运动时间', () => {
  const poses: Whale[] = [20, 60, 120].map((fps: number): Whale => {
    const whale: Whale = { x: 180, y: 210, vx: 30, vy: 0, direction: 1 }
    let motion: SwimMotion = releaseWhale(createSwimMotion(whale, 527), whale)
    for (let frame: number = 0; frame < fps * 4; frame++)
      motion = advanceSwimMotionWithCurrent(
        motion,
        1 / fps,
        (): number => 147,
        (x: number, y: number, elapsed: number) => oceanCurrent(x, y, frame / fps + elapsed),
      )
    return motion.whale
  })
  for (const pose of poses) assert.ok(Math.hypot(pose.x - poses[0].x, pose.y - poses[0].y) < 0.1)
})
