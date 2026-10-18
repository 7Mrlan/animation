import { useEffect, useRef, useState } from 'react'
import type { AnimationItem } from 'lottie-web'

// 窗口化会让 Duo 场景反复卸载/挂载；JSON 只取一次，失败时清空以便重试。
let duoAnimationData: Promise<unknown> | null = null

function loadDuoAnimationData() {
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
    let animation: AnimationItem | undefined
    let loading = false
    let disposed = false

    const sync = () => {
      if (reducedMotion.matches || document.hidden || !visibility.current) {
        animation?.pause()
      } else if (animation) {
        animation.play()
      } else if (!loading) {
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
        if (disposed || !container.current) return
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
        // Keep the matching official poster if the player or asset cannot load.
      }
    }
    synchronize.current = sync
    reducedMotion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      disposed = true
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
