import { useEffect, useRef, useState } from 'react'
import type { AnimationItem } from 'lottie-web'
import { loadDuoAnimationData } from '../lib/duo-preload'

export function DuoPlayer({ visible }: { visible: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const visibility = useRef(visible)
  const synchronize = useRef(() => {})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    visibility.current = visible
    synchronize.current()
  }, [visible])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pauseWhileScrolling = window.matchMedia('(hover: none), (pointer: coarse)').matches
    let animation: AnimationItem | undefined
    let loading = false
    let disposed = false
    let scrolling = true
    let idleTimer: number | undefined

    const sync = () => {
      if (reducedMotion.matches || document.hidden || !visibility.current) {
        animation?.pause()
      } else if (animation) {
        if (!scrolling || !pauseWhileScrolling) animation.play()
      } else if (!loading && !scrolling) {
        void load()
      }
    }
    async function load() {
      loading = true
      try {
        const [player, animationData] = await Promise.all([
          import('lottie-web/build/player/lottie_light'),
          loadDuoAnimationData(),
        ])
        if (disposed) return
        if (!container.current) {
          loading = false
          return
        }
        animation = player.default.loadAnimation({
          container: container.current,
          renderer: 'svg',
          loop: true,
          autoplay: false,
          animationData,
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        })
        animation.setSubframe(false)
        animation.addEventListener('DOMLoaded', () => {
          if (disposed) return
          setReady(true)
          sync()
        })
        animation.addEventListener('error', () => {
          if (!disposed) setReady(false)
          animation?.pause()
        })
      } catch {
        // Keep the matching official poster; a later scroll idle can retry.
        if (!disposed) loading = false
      }
    }
    // 滚动期间不创建/播放 Lottie；停止滚动 180ms 后再继续，避免 SVG 构建落在滚动帧里。
    const scheduleIdle = () => {
      if (disposed) return
      scrolling = true
      if (pauseWhileScrolling) animation?.pause()
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        idleTimer = undefined
        scrolling = false
        if (disposed || document.hidden || reducedMotion.matches) return
        sync()
      }, 180)
    }
    synchronize.current = sync
    reducedMotion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('scroll', scheduleIdle, { passive: true })
    scheduleIdle()
    sync()
    return () => {
      disposed = true
      window.clearTimeout(idleTimer)
      window.removeEventListener('scroll', scheduleIdle)
      synchronize.current = () => {}
      reducedMotion.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
      animation?.destroy()
    }
  }, [])

  return (
    <div className="duo-animation" data-ready={ready} aria-hidden="true">
      <img
        className="duo-art"
        src={`${import.meta.env.BASE_URL}brands/duolingo-duo-home.svg`}
        alt=""
      />
      <div className="duo-animation-player" ref={container} />
    </div>
  )
}
