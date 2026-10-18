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
        element.style.setProperty('--account-x', '50%')
        element.style.setProperty('--account-y', '50%')
        return
      }
      const rect = element.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((point.x - rect.left) / Math.max(1, rect.width)) * 100))
      const y = Math.max(0, Math.min(100, ((point.y - rect.top) / Math.max(1, rect.height)) * 100))
      element.style.setProperty('--account-x', `${x}%`)
      element.style.setProperty('--account-y', `${y}%`)
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
  const leave = () => {
    pointer.current = null
    schedule()
  }
  return (
    <div
      ref={art}
      className={`catalog-special-art catalog-account-art`}
      style={{ '--account-x': '50%', '--account-y': '50%' } as CSSProperties}
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
