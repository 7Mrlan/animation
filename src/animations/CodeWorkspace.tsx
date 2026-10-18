// 从首页插画抽离；几何、配色与关键帧保留，移除业务文案。
import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import './CodeWorkspace.css'

export function CodeWorkspace() {
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
      const rect = element.getBoundingClientRect()
      const px = point ? Math.max(0, Math.min(rect.width, point.x - rect.left)) : rect.width / 2
      const py = point ? Math.max(0, Math.min(rect.height, point.y - rect.top)) : rect.height / 2
      const x = (px / Math.max(1, rect.width)) * 100
      const y = (py / Math.max(1, rect.height)) * 100
      element.style.setProperty('--code-x', `${x}%`)
      element.style.setProperty('--code-y', `${y}%`)
      element.style.setProperty('--code-dx', `${px - rect.width / 2}px`)
      element.style.setProperty('--code-dy', `${py - rect.height / 2}px`)
      element.style.setProperty('--code-shift-x', `${((x - 50) * 0.16).toFixed(2)}px`)
      element.style.setProperty('--code-shift-y', `${((y - 50) * 0.16).toFixed(2)}px`)
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
      className={`catalog-special-art catalog-gpt-code-art`}
      style={
        {
          '--code-x': '50%',
          '--code-y': '50%',
          '--code-dx': '0px',
          '--code-dy': '0px',
          '--code-shift-x': '0px',
          '--code-shift-y': '0px',
        } as CSSProperties
      }
      onPointerDown={move}
      onPointerMove={move}
      onPointerLeave={leave}
      aria-label="代码工作台互动动画"
    >
      <span className="gpt-code-aura" />
      <span className="gpt-code-crosshair" />
      <div className="gpt-code-terminal">
        <div className="gpt-code-bar">
          <i />
          <i />
          <i />
          <span>MOTION / WORKSPACE</span>
        </div>
        <div className="gpt-code-lines">
          <span>
            <b>01</b>
            <i>const</i>
            <strong> idea</strong>
            <em> = await</em>
          </span>
          <span>
            <b>02</b>
            <i> build</i>
            <strong>(prompt)</strong>
            <em>;</em>
          </span>
          <span>
            <b>03</b>
            <i>return</i>
            <strong> future</strong>
            <em>;</em>
          </span>
          <span className="gpt-code-caret">
            <b>04</b>
            <i>▋</i>
          </span>
        </div>
      </div>
      <span className="gpt-code-point-label">IDEA → CREATE</span>
    </div>
  )
}
