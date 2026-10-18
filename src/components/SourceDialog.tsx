import { useEffect, useRef, useState } from 'react'
import type { Study } from '../catalog'
import { Icon } from './Icon'

const sources = import.meta.glob<string>(
  ['../animations/*.{tsx,css}', '../lib/*.ts', '../hooks/*.ts', '../types/*.d.ts'],
  { query: '?raw', import: 'default' },
)

export function SourceDialog({ study, onClose }: { study: Study; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [file, setFile] = useState(study.files[0])
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const node = dialog.current!
    node.showModal()
    return () => node.close()
  }, [])
  useEffect(() => {
    let cancelled = false
    setSource('')
    setFailed(false)
    setStatus('')
    const load = sources[`../${file}`]
    if (!load) {
      setFailed(true)
      return
    }
    void load()
      .then((code) => {
        if (!cancelled) setSource(code)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [file])
  async function copy() {
    try {
      await navigator.clipboard.writeText(source)
      setStatus('已复制')
    } catch {
      setStatus('复制未成功，请选中文字复制')
    }
  }
  return (
    <dialog
      ref={dialog}
      className="source-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose()
      }}
      aria-labelledby="source-title"
    >
      <div className="source-heading">
        <div>
          <span className="eyebrow">BEHIND THE MOTION / {study.number}</span>
          <h2 id="source-title">{study.name}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="关闭源码">
          <Icon name="close" />
        </button>
      </div>
      <p className="source-lesson">{study.lesson}</p>
      <div className="source-toolbar">
        <label>
          文件
          <select value={file} onChange={(event) => setFile(event.target.value)}>
            {study.files.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
        </label>
        <button className="small-button" onClick={() => void copy()} disabled={!source}>
          <Icon name="copy" />
          复制
        </button>
      </div>
      <pre tabIndex={0} aria-label={file}>
        <code>{failed ? '加载失败，请从下方 GitHub 链接查看。' : source || '正在加载源码…'}</code>
      </pre>
      <div className="source-footer">
        <span role="status">{status || '源码与正在运行的动画保持一致'}</span>
        <a
          href={`https://github.com/7Mrlan/animation/blob/main/src/${file}`}
          target="_blank"
          rel="noreferrer"
        >
          在 GitHub 查看 ↗
        </a>
      </div>
    </dialog>
  )
}
