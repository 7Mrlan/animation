/**
 * 场景窗口的纯状态机。
 *
 * 画廊里只有“贵”的部分需要窗口化：动画场景会创建大量 DOM、RAF、Lottie
 * 实例和合成层，而卡片外壳（标题、说明、锚点）必须保留，否则滚动高度、
 * 深链接和键盘顺序都会被破坏。
 *
 * - near：进入预加载窗口时挂载场景，让滚动过程中不出现空白。
 * - view：进入视口时记录一次显现，并允许播放。
 * - release：越过更外层的释放边界后才卸载，避免在边界附近反复挂载。
 */
export const SCENE_PRELOAD_MARGIN = 600
export const SCENE_RELEASE_MARGIN = 1000
/** 只要露出一点就显现，避免卡片已经可见却停在透明初态。 */
export const SCENE_REVEAL_THRESHOLD = 0
/** 露出约 8% 才播放，减少边缘卡片不必要的动画帧。 */
export const SCENE_VIEW_THRESHOLD = 0.08

export type SceneWindowState = {
  mounted: boolean
  revealed: boolean
  inView: boolean
}

export const initialSceneWindowState: SceneWindowState = {
  mounted: false,
  revealed: false,
  inView: false,
}

export type SceneWindowEvent =
  | { type: 'near'; intersecting: boolean }
  | { type: 'release'; intersecting: boolean }
  | { type: 'view'; intersecting: boolean }
  | { type: 'reveal' }

export function reduceSceneWindow(
  state: SceneWindowState,
  event: SceneWindowEvent,
): SceneWindowState {
  switch (event.type) {
    case 'near':
      if (!event.intersecting || state.mounted) return state
      return { ...state, mounted: true }
    case 'release':
      if (event.intersecting || !state.mounted) return state
      return { ...state, mounted: false, inView: false }
    case 'view':
      if (!event.intersecting) {
        return state.inView ? { ...state, inView: false } : state
      }
      // 显现是一次性的：滚出视口后不再隐藏，避免上下滚动时闪烁。
      return state.mounted && state.revealed && state.inView
        ? state
        : { mounted: true, revealed: true, inView: true }
    case 'reveal':
      // 显现只负责可见性；挂载交给 near/view，避免远处聚焦后永远无法释放。
      return state.revealed ? state : { ...state, revealed: true }
    default:
      return state
  }
}

/** 元素与视口相交，允许向上下各扩展 margin 像素。 */
export function isWithinMargin(
  top: number,
  bottom: number,
  viewportHeight: number,
  margin: number,
) {
  return bottom > -margin && top < viewportHeight + margin
}
