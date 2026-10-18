import assert from 'node:assert/strict'
import test from 'node:test'
import { createObserverRegistry } from '../src/lib/observer-registry.ts'
import type { ObserverFactory } from '../src/lib/observer-registry.ts'

class FakeObserver {
  targets = new Set<Element>()
  observed: Element[] = []
  unobserved: Element[] = []
  disconnects = 0
  callback: (entries: IntersectionObserverEntry[]) => void

  constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
    this.callback = callback
  }

  observe(target: Element) {
    this.targets.add(target)
    this.observed.push(target)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
    this.unobserved.push(target)
  }

  disconnect() {
    this.targets.clear()
    this.disconnects++
  }

  emit(isIntersecting: boolean) {
    this.callback(
      [...this.targets].map(
        (target) => ({ target, isIntersecting }) as unknown as IntersectionObserverEntry,
      ),
    )
  }
}

function setup() {
  const created: FakeObserver[] = []
  const factory: ObserverFactory = (callback) => {
    const observer = new FakeObserver(callback)
    created.push(observer)
    return observer
  }
  return { registry: createObserverRegistry(factory), created }
}

const element = (id: string) => ({ id }) as unknown as Element

test('相同配置的多个元素共享一个观察器并分别通知', () => {
  const { registry, created } = setup()
  const a = element('a')
  const b = element('b')
  const seen: string[] = []
  registry.observe(a, { threshold: 0 }, (intersecting) => seen.push(`a:${intersecting}`))
  registry.observe(b, { threshold: 0 }, (intersecting) => seen.push(`b:${intersecting}`))
  assert.equal(created.length, 1)
  created[0].emit(true)
  assert.deepEqual(seen, ['a:true', 'b:true'])
})

test('不同配置使用不同观察器，root 也参与分组', () => {
  const { registry, created } = setup()
  const a = element('a')
  const b = element('b')
  const root = element('root')
  registry.observe(a, { threshold: 0 }, () => {})
  registry.observe(b, { threshold: 0.08 }, () => {})
  registry.observe(a, { root, threshold: 0 }, () => {})
  assert.equal(created.length, 3)
  assert.equal(registry.groupCount, 3)
})

test('同一元素的多个回调互不影响，移除最后一个才 unobserve 并 disconnect', () => {
  const { registry, created } = setup()
  const a = element('a')
  const seenA: boolean[] = []
  const seenB: boolean[] = []
  const stopA = registry.observe(a, { threshold: 0 }, (intersecting) => seenA.push(intersecting))
  const stopB = registry.observe(a, { threshold: 0 }, (intersecting) => seenB.push(intersecting))
  assert.equal(created.length, 1)

  created[0].emit(true)
  stopA()
  assert.deepEqual(created[0].unobserved, [], '还有订阅时不应解除观察')
  created[0].emit(false)
  assert.deepEqual(seenA, [true])
  assert.deepEqual(seenB, [true, false])

  stopB()
  assert.deepEqual(created[0].unobserved, [a])
  assert.equal(created[0].disconnects, 1)
  assert.equal(registry.groupCount, 0)
})

test('分组清空后重新订阅会创建新的观察器，模拟 StrictMode 清理/重建', () => {
  const { registry, created } = setup()
  const a = element('a')
  const stopFirst = registry.observe(a, { threshold: 0 }, () => {})
  stopFirst()
  assert.equal(registry.groupCount, 0)
  assert.equal(created[0].disconnects, 1)

  const seen: boolean[] = []
  const stopSecond = registry.observe(a, { threshold: 0 }, (intersecting) =>
    seen.push(intersecting),
  )
  assert.equal(created.length, 2)
  created[1].emit(true)
  assert.deepEqual(seen, [true])
  stopSecond()
  assert.equal(created[1].disconnects, 1)
  assert.equal(registry.groupCount, 0)
})

test('重复清理回调不会误删后一次订阅', () => {
  const { registry, created } = setup()
  const a = element('a')
  const stopFirst = registry.observe(a, { threshold: 0 }, () => {})
  const stopSecond = registry.observe(a, { threshold: 0 }, () => {})
  stopFirst()
  stopFirst()
  assert.deepEqual(created[0].unobserved, [])
  stopSecond()
  assert.deepEqual(created[0].unobserved, [a])
})
