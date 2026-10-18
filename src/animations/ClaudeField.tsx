// 从首页插画抽离；几何、配色与关键帧保留，移除业务文案。
import { useState, type CSSProperties, type PointerEvent } from 'react'
import './ClaudeField.css'

type ClaudePointer = { x: number; y: number; dx: number; dy: number }
const center: ClaudePointer = { x: 50, y: 50, dx: 0, dy: 0 }

export function ClaudeField() {
  const [pointer, setPointer] = useState<ClaudePointer>(center)
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    const py = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    setPointer({
      x: (px / Math.max(1, rect.width)) * 100,
      y: (py / Math.max(1, rect.height)) * 100,
      dx: px - rect.width / 2,
      dy: py - rect.height / 2,
    })
  }
  const leave = (event: PointerEvent<HTMLDivElement>) => {
    // 触摸抬手后 pointerleave 也会触发；保留最后触点，让手指点过的地方继续有反馈。
    if (event.pointerType !== 'touch') setPointer(center)
  }
  return (
    <div
      className={`catalog-special-art catalog-claude-art`}
      style={
        {
          '--claude-x': `${pointer.x}%`,
          '--claude-y': `${pointer.y}%`,
          '--claude-dx': `${pointer.dx}px`,
          '--claude-dy': `${pointer.dy}px`,
        } as CSSProperties
      }
      onPointerDown={move}
      onPointerMove={move}
      onPointerLeave={leave}
      aria-label="Claude 创意思考动画"
    >
      <span className="claude-paper paper-a" />
      <span className="claude-paper paper-b" />
      <span className="claude-paper paper-c" />
      <span className="claude-field" />
      <span className="claude-thread thread-a" />
      <span className="claude-thread thread-b" />
      <span className="claude-ray ray-a" />
      <span className="claude-ray ray-b" />
      <span className="claude-ray ray-c" />
      <span className="claude-mark" />
      <span className="claude-node node-a" />
      <span className="claude-node node-b" />
      <span className="claude-node node-c" />
      <span className="claude-word">THINK / CREATE</span>
      <span className="claude-cursor">✦</span>
    </div>
  )
}
