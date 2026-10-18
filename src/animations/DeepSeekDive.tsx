import { useEffect, useId, useRef } from 'react'
import { createDeepSeekScene } from '../lib/deepseek-scene'
import './DeepSeekDive.css'

export function DeepSeekDive({
  active = true,
  reduced = false,
}: {
  active?: boolean
  reduced?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const controller = useRef<ReturnType<typeof createDeepSeekScene> | null>(null)
  const id = useId().replaceAll(':', '')
  const assetId = `${id}-whale`
  const bodyId = `${id}-body`
  const tailId = `${id}-tail`

  useEffect(() => {
    if (!root.current) return
    const scene = createDeepSeekScene(root.current, reduced)
    controller.current = scene
    return () => {
      scene.dispose()
      controller.current = null
    }
  }, [reduced])
  useEffect(() => {
    controller.current?.setPlaying(active)
  }, [active, reduced])

  return (
    <div ref={root} className="deepseek-dive">
      <div className="ds-scene">
        <svg className="ds-art" viewBox="0 0 360 300" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <image
              id={assetId}
              href={`${import.meta.env.BASE_URL}brands/deepseek-whale.svg`}
              width="56.3"
              height="41.4"
            />
            <clipPath id={bodyId}>
              <path d="M0 0H37V12L43 16H57V43H0Z" />
            </clipPath>
            <clipPath id={tailId}>
              <path d="M37 -1H57V16H43L37 12Z" />
            </clipPath>
          </defs>
          <path className="ds-water-back" />
          <path className="ds-water-main" />
          <path className="ds-water-front" />
          <g className="ds-flows">
            <path className="ds-flow" />
            <path className="ds-flow" />
            <path className="ds-flow" />
            <path className="ds-flow" />
          </g>
          <g className="ds-wakes">
            <path className="ds-wake" />
            <path className="ds-wake" />
            <path className="ds-wake" />
          </g>
          <g className="ds-whale" transform="translate(180 116)">
            <g className="ds-facing">
              <g transform="translate(-32.65 -24) scale(1.16)">
                <g clipPath={`url(#${bodyId})`}>
                  <use href={`#${assetId}`} />
                </g>
                <g className="ds-tail">
                  <g clipPath={`url(#${tailId})`}>
                    <use href={`#${assetId}`} />
                  </g>
                </g>
              </g>
            </g>
          </g>
          <path className="ds-water-veil" />
          <path className="ds-surface" />
          <path className="ds-foam" />
          <g className="ds-splashes" />
          <g className="ds-droplets" />
          <g className="ds-bubbles" />
        </svg>
        <button
          className="ds-whale-handle"
          type="button"
          aria-label="拖动小鲸进水里，贴着水面拖动会溅起浪花；方向键移动，空格或双击触发鲸跃"
          aria-pressed="false"
        />
        <span className="ds-state ds-accessible" />
        <span className="ds-note ds-accessible" aria-live="polite" />
        <span className="ds-brand">deepseek</span>
        <div className="ds-bottom">
          <span className="ds-hint">DRAG INTO THE BLUE</span>
        </div>
      </div>
    </div>
  )
}
