import assert from 'node:assert/strict'
import test from 'node:test'
import {
  initialSceneWindowState,
  isWithinMargin,
  reduceSceneWindow,
  type SceneWindowState,
} from '../src/lib/viewport-window.ts'

const apply = (state: SceneWindowState, ...events: Parameters<typeof reduceSceneWindow>[1][]) =>
  events.reduce(reduceSceneWindow, state)

test('进入预加载区只挂载场景，进入视口才显现', () => {
  const near = apply(initialSceneWindowState, { type: 'near', intersecting: true })
  assert.deepEqual(near, { mounted: true, revealed: false, inView: false })

  const visible = apply(near, { type: 'view', intersecting: true })
  assert.deepEqual(visible, { mounted: true, revealed: true, inView: true })
})

test('离开预加载区后保留场景，越过外层释放边界才卸载', () => {
  const visible = apply(
    initialSceneWindowState,
    { type: 'near', intersecting: true },
    { type: 'view', intersecting: true },
  )
  const leaving = apply(visible, { type: 'near', intersecting: false })
  assert.equal(leaving.mounted, true, '预加载边界外仍保留，避免边界抖动反复挂载')

  const stillRetained = apply(leaving, { type: 'release', intersecting: true })
  assert.equal(stillRetained.mounted, true)

  const released = apply(stillRetained, { type: 'release', intersecting: false })
  assert.deepEqual(released, { mounted: false, revealed: true, inView: false })
})

test('显现状态只记录一次，滚回视口不会重置动画', () => {
  const revealed = apply(initialSceneWindowState, { type: 'view', intersecting: true })
  const scrolledAway = apply(revealed, { type: 'view', intersecting: false })
  assert.equal(scrolledAway.revealed, true)
  assert.equal(scrolledAway.inView, false)

  const returned = apply(scrolledAway, { type: 'view', intersecting: true })
  assert.deepEqual(returned, { mounted: true, revealed: true, inView: true })
})

test('卸载时保留显现记录，重新进入附近后直接播放', () => {
  const released = apply(
    initialSceneWindowState,
    { type: 'view', intersecting: true },
    { type: 'near', intersecting: false },
    { type: 'release', intersecting: false },
  )
  assert.deepEqual(released, { mounted: false, revealed: true, inView: false })

  const remounted = apply(released, { type: 'near', intersecting: true })
  assert.deepEqual(remounted, { mounted: true, revealed: true, inView: false })
})

test('重复的相交通知不会制造新对象，避免多余渲染', () => {
  const near = reduceSceneWindow(initialSceneWindowState, { type: 'near', intersecting: true })
  assert.equal(reduceSceneWindow(near, { type: 'near', intersecting: true }), near)
  const visible = reduceSceneWindow(near, { type: 'view', intersecting: true })
  assert.equal(reduceSceneWindow(visible, { type: 'view', intersecting: true }), visible)
  const notMounted = reduceSceneWindow(initialSceneWindowState, {
    type: 'release',
    intersecting: false,
  })
  assert.equal(notMounted, initialSceneWindowState)
})

test('键盘聚焦可以提前显现，但不冒充进入视口或单独挂载', () => {
  const focused = reduceSceneWindow(initialSceneWindowState, { type: 'reveal' })
  assert.deepEqual(focused, { mounted: false, revealed: true, inView: false })
  assert.equal(reduceSceneWindow(focused, { type: 'reveal' }), focused)
  const near = reduceSceneWindow(focused, { type: 'near', intersecting: true })
  assert.deepEqual(near, { mounted: true, revealed: true, inView: false })
})

test('isWithinMargin 包含边界内侧，排除边界外侧', () => {
  // 视口 800px，上下各扩展 600px，可用范围是 [-600, 1400]。
  assert.equal(isWithinMargin(1400, 1800, 800, 600), false)
  assert.equal(isWithinMargin(1399, 1799, 800, 600), true)
  assert.equal(isWithinMargin(-1000, -600, 800, 600), false)
  assert.equal(isWithinMargin(-999, -599, 800, 600), true)
  // margin 为 0 时就是与视口本身相交。
  assert.equal(isWithinMargin(800, 1200, 800, 0), false)
  assert.equal(isWithinMargin(799, 1199, 800, 0), true)
  assert.equal(isWithinMargin(-200, 0, 800, 0), false)
  assert.equal(isWithinMargin(-200, 1, 800, 0), true)
})
