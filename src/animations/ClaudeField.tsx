// 从首页插画抽离；几何、配色与关键帧保留，移除业务文案。
import { useState, type CSSProperties, type MouseEvent } from 'react'
import './ClaudeField.css'

export function ClaudeField() {
  const [pointer, setPointer] = useState({ x: 50, y: 50 })
  const move = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPointer({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    })
  }
  return (
    <div
      className={`catalog-special-art catalog-claude-art`}
      style={{ '--claude-x': `${pointer.x}%`, '--claude-y': `${pointer.y}%` } as CSSProperties}
      onPointerMove={move}
      onPointerLeave={() => setPointer({ x: 50, y: 50 })}
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
