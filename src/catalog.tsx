import { CardDeck } from './animations/CardDeck'
import { ClaudeField } from './animations/ClaudeField'
import { CodeWorkspace } from './animations/CodeWorkspace'
import { DuoScene, GeminiOrbit } from './animations/Membership'
import { ProfileWindow } from './animations/ProfileWindow'
import { TelegramSignal } from './animations/TelegramSignal'
import { OrbitCore } from './animations/OrbitCore'
import { FloatingMail } from './animations/FloatingMail'
import { DeepSeekDive } from './animations/DeepSeekDive'
import type { ComponentType } from 'react'

export type SceneProps = { active: boolean; reduced: boolean }
export type Study = {
  id: string
  number: string
  name: string
  english: string
  kind: '时间轴' | '指针交互' | 'CSS 循环' | 'Lottie'
  note: string
  lesson: string
  tint: string
  files: string[]
  Scene: ComponentType<SceneProps>
}
const files = (name: string) => [`animations/${name}.tsx`, `animations/${name}.css`]
export const studies: Study[] = [
  {
    id: 'deck',
    number: '01',
    name: '层叠之间',
    english: 'The card choreography',
    kind: '时间轴',
    note: '悬停或轻触，让卡片舒展开',
    lesson:
      '保留原首页的抽出 → 下沉 → 归位时间轴。requestAnimationFrame 计算位置，transform 与 z-index 协同完成遮挡。悬停、键盘聚焦或触摸可展开四张卡片。',
    tint: '#eef4f0',
    files: [...files('CardDeck'), 'lib/subscription-motion.ts'],
    Scene: CardDeck,
  },
  {
    id: 'claude',
    number: '02',
    name: '灵感引力场',
    english: 'A field of possibilities',
    kind: '指针交互',
    note: '移动指针，牵引一束灵感',
    lesson:
      '指针位置映射为百分比 CSS 变量。背景光晕、标志视差与多层关键帧使用不同节奏，形成柔和的空间层次。',
    tint: '#fcf1e9',
    files: files('ClaudeField'),
    Scene: ClaudeField,
  },
  {
    id: 'gemini',
    number: '03',
    name: '星光慢行',
    english: 'A quiet constellation',
    kind: 'CSS 循环',
    note: '双层轨道，反向流转',
    lesson:
      '椭圆边框绕中心旋转，星形轻轻缩放、浮动；负动画延迟让星点错开闪烁。SVG 的渐变 ID 通过 useId 保证实例隔离。',
    tint: '#f0effb',
    files: files('Membership'),
    Scene: GeminiOrbit,
  },
  {
    id: 'code',
    number: '04',
    name: '代码微光',
    english: 'Ideas come to life',
    kind: '指针交互',
    note: '移动指针，探索细小视差',
    lesson:
      '用 requestAnimationFrame 合并高频指针事件，每帧只写入一次 CSS 变量。背景网格、光圈、准星和终端使用不同的位移幅度。',
    tint: '#eff5f2',
    files: files('CodeWorkspace'),
    Scene: CodeWorkspace,
  },
  {
    id: 'duo',
    number: '05',
    name: '一声 Hello',
    english: 'A little character',
    kind: 'Lottie',
    note: '矢量角色，一段轻快的循环',
    lesson:
      '按需加载 Lottie light SVG 播放器与本地 JSON。离屏或标签页隐藏时暂停；加载失败及减少动态效果模式下显示同源静态海报。',
    tint: '#f1f8e7',
    files: [
      ...files('Membership'),
      'animations/DuoPlayer.tsx',
      'hooks/useMotionActivity.ts',
      'types/lottie-light.d.ts',
    ],
    Scene: DuoScene,
  },
  {
    id: 'telegram',
    number: '06',
    name: '讯息涟漪',
    english: 'A signal in the air',
    kind: 'CSS 循环',
    note: '消息依次浮现，信号轻轻扩散',
    lesson:
      '三个消息气泡共用一组关键帧，以 0、0.8、1.6 秒延迟形成顺序。手机浮动和信号呼吸采用不同周期。',
    tint: '#edf7fb',
    files: files('TelegramSignal'),
    Scene: TelegramSignal,
  },
  {
    id: 'profile',
    number: '07',
    name: '光标来访',
    english: 'Follow your curiosity',
    kind: '指针交互',
    note: '光圈与光标，跟随你的轨迹',
    lesson:
      '将光标坐标限制在容器内，通过 ref 更新光圈和装饰光标，避免每帧触发 React 重渲染；离开时回到中心。',
    tint: '#f0f3fa',
    files: files('ProfileWindow'),
    Scene: ProfileWindow,
  },
  {
    id: 'orbit',
    number: '08',
    name: '小小宇宙',
    english: 'Everything in orbit',
    kind: 'CSS 循环',
    note: '环绕、漂浮，与一次呼吸',
    lesson: '伪元素绘制两条轨道，CSS 自定义属性控制配色。错开的运动周期让少量元素保持自然变化。',
    tint: '#e9f0f5',
    files: files('OrbitCore'),
    Scene: OrbitCore,
  },
  {
    id: 'mail',
    number: '09',
    name: '一封轻盈的信',
    english: 'Something good is coming',
    kind: 'CSS 循环',
    note: '两层纸片，两个相反的节奏',
    lesson:
      '由原首页保留的信封 CSS 恢复最小 DOM。旋转方块与伪元素拼成信封，标签与信封在纵向反向浮动。',
    tint: '#eef2fa',
    files: files('FloatingMail'),
    Scene: FloatingMail,
  },
  {
    id: 'deepseek',
    number: '10',
    name: '潜入答案',
    english: 'A little deeper, a little clearer',
    kind: '指针交互',
    note: '拖入水中看它巡游，双击小鲸，邀它鲸跃',
    lesson:
      '本地 DeepSeek SVG 分层摆尾，弹簧水面传播冲击，贝塞尔曲线安排深浅巡游，重力抛物线完成鲸跃。拖拽速度控制浪花强度，暂停保留时钟，静态模式仍支持直接拖动。',
    tint: '#eff4ff',
    files: [
      ...files('DeepSeekDive'),
      'lib/deepseek-scene.ts',
      'lib/deepseek-motion.ts',
      'lib/deepseek-water.ts',
    ],
    Scene: DeepSeekDive,
  },
]
