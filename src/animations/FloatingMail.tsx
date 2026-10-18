import './FloatingMail.css'

// 由原首页保留的信封 CSS 恢复最小 DOM；上下两片信封由伪元素组成。
export function FloatingMail() {
  return (
    <div className="store-mail-art" aria-hidden="true">
      <div className="store-envelope" />
      <span className="store-envelope-label">
        <span>✦</span> Hello, world
      </span>
    </div>
  )
}
