import { useEffect, useId, useRef, type ReactElement } from 'react'
import { createDeepSeekScene } from '../lib/deepseek-scene'
import type { SceneProps } from '../catalog'
import {
  WHALE_ATLAS_CELL,
  WHALE_ATLAS_COLUMNS,
  WHALE_ATLAS_LAYER_ROWS,
} from '../lib/deepseek-whale-atlas'
import './DeepSeekDive.css'

/** 多行图集保存身体与尾部的运动补间，浏览器每帧只采样两个纹理窗口。 */
function WhaleArtwork(): ReactElement {
  return (
    <svg
      x="-48"
      y="-48"
      width="96"
      height="96"
      viewBox={`0 0 ${WHALE_ATLAS_CELL} ${WHALE_ATLAS_CELL}`}
      overflow="visible"
    >
      <svg
        width={WHALE_ATLAS_CELL}
        height={WHALE_ATLAS_CELL}
        viewBox={`0 0 ${WHALE_ATLAS_CELL} ${WHALE_ATLAS_CELL}`}
        overflow="hidden"
      >
        <image
          className="ds-whale-body-frame"
          href={`${import.meta.env.BASE_URL}brands/deepseek-whale-turn.png`}
          width={WHALE_ATLAS_COLUMNS * WHALE_ATLAS_CELL}
          height={WHALE_ATLAS_LAYER_ROWS * 2 * WHALE_ATLAS_CELL}
        />
      </svg>
      <g className="ds-whale-tail">
        <svg
          width={WHALE_ATLAS_CELL}
          height={WHALE_ATLAS_CELL}
          viewBox={`0 0 ${WHALE_ATLAS_CELL} ${WHALE_ATLAS_CELL}`}
          overflow="hidden"
        >
          <image
            className="ds-whale-tail-frame"
            href={`${import.meta.env.BASE_URL}brands/deepseek-whale-turn.png`}
            y={-WHALE_ATLAS_LAYER_ROWS * WHALE_ATLAS_CELL}
            width={WHALE_ATLAS_COLUMNS * WHALE_ATLAS_CELL}
            height={WHALE_ATLAS_LAYER_ROWS * 2 * WHALE_ATLAS_CELL}
          />
        </svg>
      </g>
    </svg>
  )
}

/** 水体可铺满卡片，鲸鱼由场景按布局尺寸补偿以保持原始比例。 */
export function DeepSeekDive({ active, reduced }: SceneProps): ReactElement {
  const root = useRef<HTMLDivElement>(null)
  const controller = useRef<ReturnType<typeof createDeepSeekScene> | null>(null)
  const id = useId().replaceAll(':', '')
  /** 每个实例的水体裁切和渐变保持隔离。 */
  const waterId: string = `${id}-water`
  const airId: string = `${id}-air`
  const gradientId: string = `${id}-depth`
  const sheenId: string = `${id}-sheen`
  /** 腹侧显露沿用当前角色轮廓，避免滚身时露出矩形贴片。 */
  const whaleShapeId: string = `${id}-whale-shape`
  const whaleMaskId: string = `${id}-whale-mask`
  /** use 实例有独立样式作用域，配色写入部件属性，避免依赖外层祖先选择器。 */
  const fishId: string = `${id}-fish`
  const shrimpId: string = `${id}-shrimp`
  /** 独立尾部与附肢让同一套矢量结构同时用于静态样张和运行时游姿。 */
  const fishTailId: string = `${id}-fish-tail`
  const shrimpTailId: string = `${id}-shrimp-tail`
  const shrimpLegsId: string = `${id}-shrimp-legs`
  const fishSilverId: string = `${id}-fish-silver`

  // 场景工厂热更新时重建监听器与部件引用，避免旧闭包继续绘制新模板。
  useEffect(() => {
    if (!root.current) return
    const scene = createDeepSeekScene(root.current, reduced)
    controller.current = scene
    return () => {
      scene.dispose()
      controller.current = null
    }
  }, [reduced, createDeepSeekScene])
  useEffect(() => {
    controller.current?.setPlaying(active)
  }, [active, reduced, createDeepSeekScene])

  return (
    <div ref={root} className="deepseek-dive">
      <div className="ds-scene">
        <svg className="ds-art" viewBox="0 0 360 300" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <clipPath id={airId}>
              <path className="ds-air-clip" />
            </clipPath>
            <mask
              id={whaleMaskId}
              x="-60"
              y="-60"
              width="120"
              height="120"
              maskUnits="userSpaceOnUse"
              style={{ maskType: 'alpha' }}
            >
              <use href={`#${whaleShapeId}`} />
            </mask>
            <linearGradient id={fishSilverId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#294f59" />
              <stop offset="33%" stopColor="#628d99" />
              <stop offset="55%" stopColor="#d2e4e8" />
              <stop offset="78%" stopColor="#f0f7f5" />
              <stop offset="100%" stopColor="#a0bec8" />
            </linearGradient>
            <g id={fishId} strokeLinejoin="round">
              <path
                fill="#8baeb6"
                fillOpacity="0.8"
                stroke="#557f8c"
                strokeWidth="0.3"
                d="M-4-2.1L-1.8-5.5L1.6-2.5M-1 2L1.5 4L3 2"
              />
              <path
                className="ds-fish-body"
                fill={`url(#${fishSilverId})`}
                stroke="#527985"
                strokeWidth="0.32"
                d="M-9-.7Q-5-3.4 1-3Q6-2.8 10.5-.1Q8.3 2.8 1.3 2.9Q-4 2.4-9 .7Z"
              />
              <path
                fill="none"
                stroke="#f0fbff"
                strokeWidth="0.4"
                opacity="0.75"
                d="M-7 .2Q0 1 7.2 .3"
              />
              <path
                fill="none"
                stroke="#4b6e7b"
                strokeWidth="0.35"
                d="M6-2Q4.9 0 6 1.9M9.2 .6L10.4 .1"
              />
              <path
                fill="#8baeb6"
                fillOpacity="0.8"
                stroke="#557f8c"
                strokeWidth="0.3"
                d="M4.5 .5L1.5 3.2L2.4 .8Z"
              />
              <circle cx="7.6" cy="-0.75" r="0.78" fill="#1a3039" stroke="none" />
              <circle cx="7.82" cy="-1" r="0.23" fill="#f4fcff" stroke="none" />
            </g>
            <g id={fishTailId}>
              <path
                fill="#8baeb6"
                fillOpacity="0.8"
                stroke="#557f8c"
                strokeWidth="0.3"
                strokeLinejoin="round"
                d="M-8.5-.9L-15.5-4L-12.7 0L-15.5 4L-8.5 .9Z"
              />
              <path
                fill="none"
                stroke="#4b6e7b"
                strokeWidth="0.35"
                d="M-9 0L-14.2-2.8M-9 0L-14.2 2.8"
              />
            </g>
            <g id={shrimpId} strokeLinecap="round" strokeLinejoin="round">
              <path
                className="ds-krill-shell"
                fill="#ee6350"
                fillOpacity="0.96"
                stroke="#b34c47"
                strokeWidth="0.5"
                d="M-3-1.8Q.5-3.2 4.4-1.9L6.2-.6Q6.1 .9 3.7 1.6Q.4 2-3 1.1Z"
              />
              <path
                fill="none"
                stroke="#fff1dd"
                strokeWidth="0.7"
                d="M5.3-.7Q8-4.2 13-3.6M5.6-.2Q9-.5 13.6 1.2"
              />
              <path fill="none" stroke="#fff1dd" strokeWidth="0.7" d="M2.9-2Q1.7-.1 2.2 1.6" />
              <circle cx="4.8" cy="-1.6" r="1.05" fill="#1a3039" stroke="none" />
              <circle cx="5.06" cy="-1.88" r="0.26" fill="#f4fcff" stroke="none" />
              <circle cx="-.7" cy="0.9" r="0.38" fill="#fff5e8" opacity="0.95" />
              <circle cx="1" cy="-1.2" r="0.46" fill="#fff5e8" opacity="0.95" />
              <circle cx="-1.3" cy="-0.8" r="0.35" fill="#fff5e8" opacity="0.95" />
            </g>
            <g id={shrimpTailId} strokeLinecap="round" strokeLinejoin="round">
              <path
                className="ds-krill-shell"
                fill="#ee6350"
                fillOpacity="0.96"
                stroke="#b34c47"
                strokeWidth="0.5"
                d="M-2.5-1.7Q-6.2-2.3-9-.2L-10.6 .4Q-7.5 2.1-2.5 1.2Z"
              />
              <path
                fill="none"
                stroke="#fff1dd"
                strokeWidth="0.7"
                d="M-4.4-1.8Q-4.7-.2-4.1 1.6M-6.4-1.4Q-6.9 0-6.1 1.5M-8.2-.7L-7.7 1.1"
              />
              <path
                fill="#f28567"
                fillOpacity="0.9"
                stroke="#ba6057"
                strokeWidth="0.55"
                d="M-9.3 0L-13.4-2.3L-12 .1L-13.5 2.5L-9 .8Z"
              />
            </g>
            <g id={shrimpLegsId}>
              <path
                fill="none"
                stroke="#fff1dd"
                strokeWidth="0.7"
                strokeLinecap="round"
                d="M2.5 1L.8 4.3M.5 1.2L-1.2 4.6M-1.2 1.1L-3.3 4M-4 1.1L-5.4 3.1M-6 1L-7.6 2.8"
              />
            </g>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a5d7f7" stopOpacity="0.72" />
              <stop offset="28%" stopColor="#75b7eb" stopOpacity="0.66" />
              <stop offset="100%" stopColor="#5e8cdb" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e5f9ff" stopOpacity="0.35" />
              <stop offset="42%" stopColor="#94c9f1" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#417ac5" stopOpacity="0.27" />
            </linearGradient>
            <clipPath id={waterId}>
              <path className="ds-water-clip" />
            </clipPath>
          </defs>
          <path className="ds-water-back" />
          <path className="ds-water-main" fill={`url(#${gradientId})`} />
          <path className="ds-water-front" />
          <g className="ds-flows" clipPath={`url(#${waterId})`}>
            <path className="ds-flow" />
            <path className="ds-flow" />
            <path className="ds-flow" />
            <path className="ds-flow" />
          </g>
          <g className="ds-wakes" clipPath={`url(#${waterId})`}>
            <path className="ds-wake" />
            <path className="ds-wake" />
            <path className="ds-wake" />
          </g>
          <g
            className="ds-prey"
            data-fish={fishId}
            data-shrimp={shrimpId}
            data-fish-tail={fishTailId}
            data-shrimp-tail={shrimpTailId}
            data-shrimp-legs={shrimpLegsId}
            clipPath={`url(#${waterId})`}
          />
          <g className="ds-whale-occlusion" data-water-clip={waterId}>
            <g className="ds-whale" transform="translate(180 116)">
              <g className="ds-whale-bank">
                <g id={whaleShapeId}>
                  <WhaleArtwork />
                </g>
                <ellipse
                  className="ds-whale-belly"
                  cx="-2"
                  cy="16"
                  rx="24"
                  ry="8"
                  fill="#e9f4ff"
                  opacity="0"
                  mask={`url(#${whaleMaskId})`}
                />
              </g>
            </g>
          </g>
          <path className="ds-water-veil" fill={`url(#${sheenId})`} />
          <g clipPath={`url(#${airId})`}>
            <g className="ds-surface-whale" fill="var(--ds-blue)" opacity="0">
              <path d="M-31 4Q-17-5-3-2Q2-4 6-14Q13-10 10-2Q20 0 31 4Z" />
            </g>
          </g>
          <g className="ds-ripples" clipPath={`url(#${waterId})`} />
          <path className="ds-surface" />
          <g className="ds-footprints" clipPath={`url(#${waterId})`} />
          <g className="ds-foam" clipPath={`url(#${waterId})`} />
          <g className="ds-splashes" />
          <g className="ds-droplets" />
          <g className="ds-bubbles" clipPath={`url(#${waterId})`} />
          <path className="ds-feed-pulse" clipPath={`url(#${waterId})`} opacity="0" />
          <g className="ds-breaths" />
          <g className="ds-snores" aria-hidden="true" opacity="0">
            <text>Z</text>
            <text>z</text>
            <text>z</text>
          </g>
        </svg>
        <button
          className="ds-whale-handle"
          type="button"
          aria-label="拖动小鲸进水里，贴着水面拖动会溅起浪花；方向键移动，空格或双击触发鲸跃"
          aria-pressed="false"
        />
        <span className="ds-state" />
        <span className="ds-note ds-accessible" />
        <span className="ds-brand">deepseek</span>
        <div className="ds-bottom">
          <span className="ds-hint">DRAG INTO THE BLUE</span>
        </div>
      </div>
    </div>
  )
}
