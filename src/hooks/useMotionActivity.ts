import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { observerRegistry } from '../lib/observer-registry'
import {
  SCENE_PRELOAD_MARGIN,
  SCENE_RELEASE_MARGIN,
  SCENE_REVEAL_THRESHOLD,
  SCENE_VIEW_THRESHOLD,
  initialSceneWindowState,
  isWithinMargin,
  reduceSceneWindow,
} from '../lib/viewport-window'

const observe = observerRegistry.observe

const pageVisibleListeners = new Set<() => void>()
let pageVisible = typeof document === 'undefined' ? true : !document.hidden

function notifyPageVisible() {
  for (const listener of pageVisibleListeners) listener()
}

function handlePageVisibility() {
  pageVisible = !document.hidden
  notifyPageVisible()
}

function subscribePageVisible(listener: () => void) {
  if (typeof document === 'undefined') return () => {}
  const first = pageVisibleListeners.size === 0
  pageVisibleListeners.add(listener)
  if (first) {
    pageVisible = !document.hidden
    document.addEventListener('visibilitychange', handlePageVisibility)
  }
  return () => {
    pageVisibleListeners.delete(listener)
    if (pageVisibleListeners.size === 0) {
      document.removeEventListener('visibilitychange', handlePageVisibility)
    }
  }
}

const getPageVisible = () => pageVisible

/** 页面可见性也走共享订阅：这一路 DOM 监听器始终只有一个。 */
export function usePageVisible() {
  return useSyncExternalStore(subscribePageVisible, getPageVisible, () => true)
}

const reducedMotionListeners = new Set<() => void>()
let reducedMotionQuery: MediaQueryList | null = null
let reducedMotionMatches =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

function notifyReducedMotion() {
  for (const listener of reducedMotionListeners) listener()
}

function handleReducedMotion(event: MediaQueryListEvent) {
  reducedMotionMatches = event.matches
  notifyReducedMotion()
}

function subscribeReducedMotion(listener: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const first = reducedMotionListeners.size === 0
  reducedMotionListeners.add(listener)
  if (first) {
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionMatches = reducedMotionQuery.matches
    reducedMotionQuery.addEventListener('change', handleReducedMotion)
  }
  return () => {
    reducedMotionListeners.delete(listener)
    if (reducedMotionListeners.size === 0) {
      reducedMotionQuery?.removeEventListener('change', handleReducedMotion)
      reducedMotionQuery = null
    }
  }
}

const getReducedMotion = () => reducedMotionMatches

export function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
}

/**
 * 统一管理可见性与场景窗口。
 *
 * `mounted`：是否在预加载窗口内，决定动画场景的挂载/卸载。
 * `revealed`：是否已经滚动显现过，用于一次性的淡入。
 * `active`：挂载、视口、页面可见、未暂停且未减少动态时才播放。
 */
export function useMotionActivity(paused: boolean, reduced: boolean) {
  // 显现/挂载观察整张卡片：舞台滚出视口后，标题和说明仍可能可见。
  // 播放单独观察内部舞台，避免只露出文字时还跑动画。
  const ref = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [state, dispatch] = useReducer(reduceSceneWindow, initialSceneWindowState)
  const pageVisible = usePageVisible()

  // 首屏在绘制前同步挂载附近场景，避免第一帧出现占位符。
  // 显现仍交给观察器，让首屏卡片也有一次自然的淡入。
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const { top, bottom } = element.getBoundingClientRect()
    if (isWithinMargin(top, bottom, window.innerHeight, SCENE_PRELOAD_MARGIN)) {
      dispatch({ type: 'near', intersecting: true })
    }
  }, [])

  useEffect(() => {
    const element = ref.current
    const stage = stageRef.current
    if (!element || !stage) return
    const stopNear = observe(
      element,
      { rootMargin: `${SCENE_PRELOAD_MARGIN}px 0px`, threshold: 0 },
      (intersecting) => dispatch({ type: 'near', intersecting }),
    )
    const stopRelease = observe(
      element,
      { rootMargin: `${SCENE_RELEASE_MARGIN}px 0px`, threshold: 0 },
      (intersecting) => dispatch({ type: 'release', intersecting }),
    )
    // 显现和播放分开：露出一点就淡入，舞台露出约 8% 才开始跑动画。
    const stopReveal = observe(element, { threshold: SCENE_REVEAL_THRESHOLD }, (intersecting) => {
      if (intersecting) dispatch({ type: 'reveal' })
    })
    const stopView = observe(stage, { threshold: SCENE_VIEW_THRESHOLD }, (intersecting) =>
      dispatch({ type: 'view', intersecting }),
    )
    return () => {
      stopNear()
      stopRelease()
      stopReveal()
      stopView()
    }
  }, [])

  return {
    ref,
    stageRef,
    mounted: state.mounted,
    revealed: reduced || state.revealed,
    active: state.mounted && state.inView && pageVisible && !paused && !reduced,
    reveal: () => dispatch({ type: 'reveal' }),
  }
}

/** 给不挂载动画的页面区块使用的一次性滚动显现。 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    return observe(element, { threshold: SCENE_REVEAL_THRESHOLD }, (intersecting) => {
      if (intersecting) setRevealed(true)
    })
  }, [])
  return { ref, revealed }
}
