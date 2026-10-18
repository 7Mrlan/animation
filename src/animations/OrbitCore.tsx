import type { CSSProperties } from 'react'
import './OrbitCore.css'

// CSS 自定义属性让同一套关键帧可以配不同颜色。
export function OrbitCore() {
  return (
    <div
      className="store-product-art"
      style={{ '--catalog-hue': '200', '--catalog-bg': '#e9f0f5' } as CSSProperties}
      aria-hidden="true"
    >
      <span className="store-art-orbit orbit-one" />
      <span className="store-art-orbit orbit-two" />
      <span className="store-art-core">✳</span>
      <span className="store-art-label">IN ORBIT</span>
      <span className="store-art-caption">A SMALL UNIVERSE</span>
    </div>
  )
}
