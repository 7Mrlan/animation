// 从首页插画抽离；几何、配色与关键帧保留，移除业务文案。

import './TelegramSignal.css'

export function TelegramSignal() {
  return (
    <div className={`catalog-special-art catalog-telegram-art`} aria-hidden="true">
      <span className="telegram-phone">
        <span className="telegram-notch" />
        <span className="telegram-message msg-a">+1</span>
        <span className="telegram-message msg-b">SMS</span>
        <span className="telegram-message msg-c">OK</span>
      </span>
      <span className="telegram-signal signal-a" />
      <span className="telegram-signal signal-b" />
    </div>
  )
}
