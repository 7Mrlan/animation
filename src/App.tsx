import { useState } from 'react'
import { studies, type Study } from './catalog'
import { AnimationCard } from './components/AnimationCard'
import { SourceDialog } from './components/SourceDialog'
import { Icon } from './components/Icon'
import { useReducedMotion } from './hooks/useMotionActivity'

const filters = ['全部作品', '指针交互', 'CSS 循环', '时间轴', 'Lottie'] as const
export default function App() {
  const [filter, setFilter] = useState<string>('全部作品')
  const [paused, setPaused] = useState(false)
  const [selected, setSelected] = useState<Study | null>(null)
  const reduced = useReducedMotion()
  const visible = studies.filter((study) => filter === '全部作品' || study.kind === filter)
  return (
    <>
      <a className="skip-link" href="#collection">
        跳到动画作品
      </a>
      <header className="site-header wrap">
        <a href="#" className="brand">
          <span className="brand-glyph" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          轻动<span className="brand-caption">ANIMATION STUDIES</span>
        </a>
        <a
          className="github-link"
          href="https://github.com/7Mrlan/animation"
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="github" />
          GitHub<small>↗</small>
        </a>
      </header>
      <main className="wrap">
        <section className="intro">
          <div className="intro-copy">
            <span className="eyebrow">
              <span className="green-dot" />A SMALL COLLECTION OF MOTION
            </span>
            <h1>
              让界面，
              <br className="mobile-break" />
              <span>轻轻动起来。</span>
              <span className="title-star" aria-hidden="true">
                ✳
              </span>
            </h1>
            <p>
              把细微的互动，收藏成卡片。
              <br />
              九个独立动画，从观看到拆解，让每一次灵感都有迹可循。
            </p>
          </div>
          <div className="edition">
            <span>THE COLLECTION</span>
            <strong>
              09<span> / studies</span>
            </strong>
            <span>观察 · 交互 · 探索源码</span>
          </div>
        </section>
        <section id="collection" aria-label="动画作品集">
          <div className="collection-toolbar">
            <div className="filters" role="group" aria-label="按动画类型筛选">
              {filters.map((item) => (
                <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {item}
                  {item === '全部作品' && <span>09</span>}
                </button>
              ))}
            </div>
            <button
              className="playback-button"
              disabled={reduced}
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              <Icon name={paused || reduced ? 'play' : 'pause'} />
              {reduced ? '系统静态模式' : paused ? '播放全部' : '暂停全部'}
            </button>
          </div>
          <div className="collection-caption">
            <span>
              <i />
              {reduced
                ? '遵循系统的减少动态效果设置'
                : paused
                  ? '时间暂歇，细节继续'
                  : '悬停探索，点击右下角查看源码'}
            </span>
            <span aria-live="polite">{String(visible.length).padStart(2, '0')} 个动画</span>
          </div>
          <div className="gallery">
            {visible.map((study) => (
              <AnimationCard
                key={study.id}
                study={study}
                paused={paused || selected !== null}
                reduced={reduced}
                onSource={() => setSelected(study)}
              />
            ))}
          </div>
        </section>
        <aside className="learning-note">
          <span className="note-symbol" aria-hidden="true">
            ✧
          </span>
          <div>
            <h2>好的动效，藏在恰到好处的细节里。</h2>
            <p>从关键帧到指针交互，每张卡片都是一个可以独立研究的小实验。</p>
          </div>
          <a href="https://github.com/7Mrlan/animation#readme" target="_blank" rel="noreferrer">
            开始拆解
            <Icon name="arrow" />
          </a>
        </aside>
      </main>
      <footer className="site-footer wrap">
        <span>
          轻动 <span className="footer-separator">/</span> ANIMATION STUDIES
        </span>
        <span>Made to move. Built to learn.</span>
        <a
          href="https://github.com/7Mrlan/animation/blob/main/docs/ATTRIBUTION.md"
          target="_blank"
          rel="noreferrer"
        >
          素材来源与说明 ↗
        </a>
      </footer>
      {selected && <SourceDialog study={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
