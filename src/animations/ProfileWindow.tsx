// 从首页插画抽离；几何、配色与关键帧保留，移除业务文案。
import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import './ProfileWindow.css'

export function ProfileWindow() {
  const art = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef<number | null>(null)
  const schedule = () => {
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const element = art.current
      if (!element) return
      const point = pointer.current
      if (!point) {
        element.style.setProperty('--account-dx', '0px')
        element.style.setProperty('--account-dy', '0px')
        return
      }
      const rect = element.getBoundingClientRect()
      const px = Math.max(0, Math.min(rect.width, point.x - rect.left))
      const py = Math.max(0, Math.min(rect.height, point.y - rect.top))
      element.style.setProperty('--account-dx', `${px - rect.width / 2}px`)
      element.style.setProperty('--account-dy', `${py - rect.height / 2}px`)
    })
  }
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )
  const move = (event: PointerEvent<HTMLDivElement>) => {
    pointer.current = { x: event.clientX, y: event.clientY }
    schedule()
  }
  const leave = (event: PointerEvent<HTMLDivElement>) => {
    // 触摸抬手后 pointerleave 也会触发；保留最后触点，让手指点过的地方继续有反馈。
    if (event.pointerType === 'touch') return
    pointer.current = null
    schedule()
  }
  return (
    <div
      ref={art}
      className={`catalog-special-art catalog-account-art`}
      style={{ '--account-dx': '0px', '--account-dy': '0px' } as CSSProperties}
      onPointerDown={move}
      onPointerMove={move}
      onPointerLeave={leave}
      aria-label="浮动档案窗口动画"
    >
      <span className="account-glow" />
      <div className="account-window">
        <div className="account-window-bar">
          <i />
          <i />
          <i />
          <span>MOTION / PROFILE</span>
        </div>
        <div className="account-profile">
          <span className="account-avatar">AI</span>
          <span className="account-copy">
            <b>Hello, explorer</b>
            <small>a little interaction</small>
          </span>
          <span className="account-check">✓</span>
        </div>
        <div className="account-lines">
          <i />
          <i />
          <i />
        </div>
      </div>
      <span className="account-cursor">↗</span>
    </div>
  )
}
