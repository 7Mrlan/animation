import { useState, type CSSProperties } from 'react'
import type { Study } from '../catalog'
import { useMotionActivity } from '../hooks/useMotionActivity'
import { Icon } from './Icon'

export function AnimationCard({
  study,
  paused,
  reduced,
  onSource,
}: {
  study: Study
  paused: boolean
  reduced: boolean
  onSource: (button: HTMLButtonElement) => void
}) {
  const [localPaused, setLocalPaused] = useState(false)
  const [revision, setRevision] = useState(0)
  const { ref, active } = useMotionActivity(paused || localPaused, reduced)
  const stopped = paused || localPaused || reduced
  const { Scene } = study
  return (
    <article
      className="animation-card"
      style={{ '--scene-tint': study.tint } as CSSProperties}
      aria-labelledby={`${study.id}-title`}
    >
      <div
        ref={ref}
        className={`stage stage-${study.id}`}
        data-paused={!active}
        data-reduced={reduced}
      >
        <div className="scene-root" key={revision}>
          <Scene active={active} reduced={reduced} />
        </div>
        <div className="stage-meta">
          <span className="study-number">NO. {study.number}</span>
          <span className="stage-kind">{study.kind}</span>
        </div>
        <div className="stage-tools">
          <button
            className="icon-button"
            disabled={paused || reduced}
            aria-label={`${stopped ? '播放' : '暂停'}${study.name}`}
            aria-pressed={localPaused}
            title={stopped ? '播放' : '暂停'}
            onClick={() => setLocalPaused((value) => !value)}
          >
            <Icon name={stopped ? 'play' : 'pause'} />
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setRevision((value) => value + 1)
              setLocalPaused(false)
            }}
            aria-label={`重播${study.name}`}
            title="重播"
            disabled={paused || reduced}
          >
            <Icon name="reset" />
          </button>
        </div>
      </div>
      <div className="card-copy">
        <div className="card-title-row">
          <h2 id={`${study.id}-title`}>{study.name}</h2>
          <button
            className="source-button"
            onClick={(event) => onSource(event.currentTarget)}
            aria-label={`查看${study.name}源码`}
            title="查看源码"
          >
            <Icon name="code" />
            <Icon name="arrow" />
          </button>
        </div>
        <p className="card-english">{study.english}</p>
        <p className="card-note">{study.note}</p>
      </div>
    </article>
  )
}
