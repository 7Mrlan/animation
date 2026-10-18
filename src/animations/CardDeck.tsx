import { useEffect, useRef, useState } from 'react'
import {
  DECK_CYCLE_MS,
  deckFrame,
  deckTimeline,
  fanFrame,
  mixPose,
} from '../lib/subscription-motion'
import './CardDeck.css'

// 每帧只写 transform 和 CSS 变量，不用 React state 驱动 60fps 更新。
export function CardDeck({
  active = true,
  reduced = false,
}: {
  active?: boolean
  reduced?: boolean
}) {
  const deck = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const wasExpanded = useRef(false)
  const touch = useRef(false)
  const clock = useRef({ index: 0, elapsed: 0 })
  const current = useRef<ReturnType<typeof deckFrame> | null>(null)

  useEffect(() => {
    const element = deck.current
    if (!element) return
    const cards = [...element.querySelectorAll<HTMLElement>('[data-tier]')]
    const width = cards[0].offsetWidth
    current.current ??= deckFrame(0, 0, width)
    let frame = 0
    let last: number | null = null
    let settling = 600
    let handoff = 0
    if (wasExpanded.current && !expanded) clock.current.elapsed = 0
    wasExpanded.current = expanded

    const draw = () =>
      cards.forEach((card, i) => {
        const {
          position: [x, y, angle],
          scale,
          z,
          visible,
        } = current.current![i]
        card.style.transform = `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) rotate(${angle}deg) scale(${scale})`
        card.style.setProperty('--tier-z', String(z))
        card.dataset.copyVisible = String(visible)
      })
    // 首帧与暂停状态也有完整的静态构图。
    draw()
    if (!active && !reduced) return
    const tick = (now: number) => {
      const delta = last === null ? 0 : Math.min(now - last, 64)
      last = now
      const state = clock.current
      if (!expanded && settling === 0) state.elapsed += delta
      if (state.elapsed >= DECK_CYCLE_MS) {
        state.index = (state.index + 1) % 4
        state.elapsed %= DECK_CYCLE_MS
        handoff = 180
      }
      const { progress, phase } = deckTimeline(reduced ? 0 : state.elapsed)
      const target = expanded
        ? fanFrame(element.clientWidth, width, element.clientHeight)
        : deckFrame(state.index, progress, width, phase)
      const blend = reduced || (settling === 0 && handoff === 0) ? 1 : 1 - Math.exp(-delta / 80)
      current.current = target.map((pose, i) => ({
        ...pose,
        position: mixPose(current.current![i].position, pose.position, blend),
        scale: current.current![i].scale + (pose.scale - current.current![i].scale) * blend,
      }))
      settling = Math.max(0, settling - delta)
      handoff = Math.max(0, handoff - delta)
      element.dataset.phase = expanded ? 'inspect' : phase
      draw()
      if (active && !reduced) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, reduced, expanded])

  return (
    <div
      ref={deck}
      className="store-deck"
      role="button"
      tabIndex={0}
      aria-label="层叠卡片，悬停、聚焦或点击展开"
      aria-pressed={expanded}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setExpanded(true)
      }}
      onPointerLeave={() => {
        if (document.activeElement !== deck.current) setExpanded(false)
      }}
      onPointerDown={(event) => {
        touch.current = event.pointerType === 'touch'
      }}
      onFocus={() => {
        if (!touch.current) setExpanded(true)
      }}
      onBlur={() => {
        touch.current = false
        setExpanded(false)
      }}
      onClick={() => setExpanded((value) => !value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setExpanded((value) => !value)
        }
      }}
    >
      {['Form', 'Light', 'Space', 'Motion'].map((name, index) => (
        <div className="store-tier" data-tier={index} key={name} data-copy-visible={index === 0}>
          <div className="store-tier-face">
            <div className="store-tier-copy">
              <span className="deck-kicker">STUDY / 0{index + 1}</span>
              <strong>{name}</strong>
              <span className="deck-symbol" aria-hidden="true">
                {['◌', '✦', '◈', '≈'][index]}
              </span>
              <span className="deck-rule" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
