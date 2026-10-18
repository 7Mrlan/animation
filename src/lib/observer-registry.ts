export type IntersectionCallback = (isIntersecting: boolean) => void

export type ObserverLike = Pick<IntersectionObserver, 'observe' | 'unobserve' | 'disconnect'>

export type ObserverFactory = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit,
) => ObserverLike

type ObserverGroup = {
  observer: ObserverLike
  callbacks: Map<Element, Set<IntersectionCallback>>
}

const createNativeObserver: ObserverFactory = (callback, options) =>
  new IntersectionObserver(callback, options)

/**
 * 按配置共享 IntersectionObserver。
 *
 * 同一组配置（root、rootMargin、threshold）只创建一个观察器；同一元素可以
 * 有多个回调，最后一个回调移除时才 unobserve。观察器工厂可注入，便于在
 * 没有 DOM 的 Node 环境里测试订阅与清理。
 */
export function createObserverRegistry(createObserver: ObserverFactory = createNativeObserver) {
  const groups = new Map<string, ObserverGroup>()
  const rootIds = new WeakMap<object, number>()
  let nextRootId = 0

  function rootKey(root: Element | Document | null | undefined) {
    if (!root) return 'viewport'
    let id = rootIds.get(root)
    if (id === undefined) {
      id = ++nextRootId
      rootIds.set(root, id)
    }
    return `root-${id}`
  }

  function keyFor(options: IntersectionObserverInit) {
    return `${rootKey(options.root)}|${options.rootMargin ?? '0px'}|${String(options.threshold ?? 0)}`
  }

  function observe(
    element: Element,
    options: IntersectionObserverInit,
    callback: IntersectionCallback,
  ) {
    if (createObserver === createNativeObserver && typeof IntersectionObserver === 'undefined') {
      callback(true)
      return () => {}
    }
    const key = keyFor(options)
    let group = groups.get(key)
    if (!group) {
      const callbacks = new Map<Element, Set<IntersectionCallback>>()
      const observer = createObserver((entries) => {
        for (const entry of entries) {
          const subscriptions = callbacks.get(entry.target)
          if (!subscriptions) continue
          for (const subscription of subscriptions) subscription(entry.isIntersecting)
        }
      }, options)
      group = { observer, callbacks }
      groups.set(key, group)
    }
    const activeGroup = group
    let subscriptions = activeGroup.callbacks.get(element)
    if (!subscriptions) {
      subscriptions = new Set()
      activeGroup.callbacks.set(element, subscriptions)
    }
    subscriptions.add(callback)
    activeGroup.observer.observe(element)
    return () => {
      // 只删除自己的回调，避免 StrictMode 的清理误删下一次订阅。
      const current = activeGroup.callbacks.get(element)
      current?.delete(callback)
      if (current && current.size === 0) {
        activeGroup.callbacks.delete(element)
        activeGroup.observer.unobserve(element)
      }
      if (activeGroup.callbacks.size === 0) {
        activeGroup.observer.disconnect()
        if (groups.get(key) === activeGroup) groups.delete(key)
      }
    }
  }

  return {
    observe,
    get groupCount() {
      return groups.size
    },
  }
}

/** 页面级共享注册表；所有卡片和滚动显现区块共用同一批观察器。 */
export const observerRegistry = createObserverRegistry()
