import { useId } from 'react'
import { DuoPlayer } from './DuoPlayer'
import './Membership.css'

// useId 避免同一页多个 SVG 的渐变 ID 相互覆盖。
function GeminiMark() {
  const id = useId().replaceAll(':', '')
  return (
    <svg viewBox="0 0 160 160" aria-hidden="true" className="gemini-art">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop stopColor="#4888ee" />
          <stop offset=".5" stopColor="#7e78ee" />
          <stop offset="1" stopColor="#dd85aa" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M80 5C91 48 112 69 155 80C112 91 91 112 80 155C69 112 48 91 5 80C48 69 69 48 80 5Z"
      />
    </svg>
  )
}

export function GeminiOrbit() {
  return (
    <div className="membership-scene scene-gemini">
      <div className="membership-visual" aria-hidden="true">
        <div className="gemini-orbit orbit-outer" />
        <div className="gemini-orbit orbit-inner" />
        <div className="gemini-star">
          <GeminiMark />
        </div>
        <span className="gemini-spark spark-one">✦</span>
        <span className="gemini-spark spark-two">✦</span>
      </div>
    </div>
  )
}

export function DuoScene({ active = true }: { active?: boolean }) {
  return (
    <div className="membership-scene scene-duolingo">
      <div className="membership-visual" aria-hidden="true">
        <span className="duo-word word-hello">Hello!</span>
        <span className="duo-word word-bonjour">Bonjour</span>
        <DuoPlayer visible={active} />
      </div>
    </div>
  )
}
