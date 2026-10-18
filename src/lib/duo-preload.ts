// Duo 的 Lottie runtime 与 JSON 预热。
// 两者加载后会被模块缓存 / HTTP 缓存复用，不会因为卡片窗口反复挂载而重复解析。
let duoAnimationData: Promise<unknown> | null = null

export function loadDuoAnimationData() {
  duoAnimationData ??= fetch(`${import.meta.env.BASE_URL}brands/duolingo-duo-home.json`)
    .then((response) => {
      if (!response.ok) throw new Error('Duo animation unavailable')
      return response.json() as Promise<unknown>
    })
    .catch((error: unknown) => {
      duoAnimationData = null
      throw error
    })
  return duoAnimationData
}

/** 在首屏空闲时预热；慢速/省流网络跳过，等真正需要时再加载。 */
export function preloadDuoAnimation() {
  if (typeof document !== 'undefined' && document.hidden) return
  if (typeof window === 'undefined' || window.scrollY > 0) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (typeof navigator === 'undefined') return
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
  ).connection
  if (
    connection?.saveData ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g'
  ) {
    return
  }
  void import('lottie-web/build/player/lottie_light').catch(() => {})
  void loadDuoAnimationData().catch(() => {})
}
