# 从一张动画卡片开始

## 先区分三个层次

`AnimationCard` 管理外框、暂停按钮与源码入口；`src/animations` 下的组件只画动画；`useMotionActivity` 决定是否允许播放。这样更换卡片外观不需要改动画的关键帧。

提取时保留了一部分原 CSS 类名，例如 `store-tier`。它们现在只是视觉选择器，不会读取商品或商店数据。

## 最小使用方式

复制一个动画的 TSX 和同名 CSS，保留它们之间的相对路径，然后使用：

```tsx
import { TelegramSignal } from './animations/TelegramSignal'

export function Example() {
  return (
    <div style={{ height: 258, borderRadius: 16, overflow: 'hidden' }}>
      <TelegramSignal />
    </div>
  )
}
```

动画的容器使用 `height: 100%`，所以外层必须有高度。建议先保持原尺寸，再逐渐调整；不要同时在同一个元素上用两段动画写 `transform`。

部分示例还需要这些文件：

- `CardDeck`：`lib/subscription-motion.ts`。
- `GeminiOrbit` / `DuoScene`：`Membership.tsx`、`Membership.css`。此文件引用 `DuoPlayer.tsx`，复制时一起带上，或自行把两个组件拆开。
- `DuoScene`：`DuoPlayer.tsx`、`types/lottie-light.d.ts`、`lottie-web` 依赖、`public/brands/duolingo-duo-home.{json,svg}`。
- `ClaudeField`：`public/brands/claude.svg`，其 CSS 相对路径需要随目录变化调整。
- 需要本项目的自动暂停与静态模式时，一起复制 `hooks/useMotionActivity.ts`、卡片外壳，以及 `styles.css` 中与 `.stage[data-paused]` / `.stage[data-reduced]` 有关的规则。单独复制动画不会自动继承外壳能力。

## CSS 循环动画

从信封开始观察两个关键帧。主体向上移动 7px 时，标签向下移动 3px，较小的角度变化就能产生轻盈感。`animation-play-state: paused` 会停在当前帧，比卸载 DOM 更适合手动暂停。

手机消息示例共用一组关键帧，但通过延迟错开。星轨示例则让不同元素用不同周期，避免整个画面同时回到起点。

调整练习：只修改一个时长，再观察两个周期重新对齐需要多久。

## 指针交互

将 `clientX` / `clientY` 减去容器左上角，再除以容器尺寸，得到 0–100 的百分比。把坐标限制在范围内，避免边缘抖动。

`CodeWorkspace` 和 `ProfileWindow` 使用 ref 保存最新坐标，每帧最多安排一个 RAF 回调。它们只写入 CSS 变量，不会在每次指针事件后重新渲染组件。组件卸载时取消等待中的回调。

`ClaudeField` 保留了原始的 state 写法，方便对照学习两种实现方式。

调整练习：修改终端位移的 `0.16` 系数。比例越大，前景与背景之间的视差越明显。

## 卡片时间轴

纯函数 `deckTimeline` 把 5770ms 循环分为停留、准备、抽出、下沉、返回、收束与隐藏阶段。`deckFrame` 计算四张卡片的位置、层级和文字可见性。

卡片交接时，旧卡在返回阶段已经移到后面，因此文字也要切换到新的前卡。只处理坐标而忽略文字与层级，会出现重叠、空白或“文字贴在背面”的错觉。

`CardDeck` 保留原有路径与插值算法，加入可控的 `active` / `reduced` 参数。CSS 负责外观，JS 负责连续姿态；只写 DOM 样式，不用 React state 承载逐帧位置。

测试覆盖：整个循环每一时刻只有一张卡片显示文字；循环首尾几何连续；窄屏展开时卡片不越界且不互相遮挡。

## Lottie 生命周期

播放器模块和 JSON 并行加载。`AbortController` 取消卸载中的请求，`disposed` 避免异步回调写入已卸载组件；销毁时移除监听器并调用 `destroy()`。

页面不可见或卡片离屏时暂停；加载失败保留海报；系统减少动态效果偏好启用时显示海报。素材均在本地，不需要远程图片或字体服务器。

## 加入新动画

1. 在 `src/animations/` 新建 TSX 和 CSS。
2. 使用独立类名前缀，避免影响别的动画。
3. 在 `src/catalog.tsx` 添加组件、说明与源码路径。
4. 若使用 JS 时间轴或播放器，接收 `active`，在停用及卸载时停止 RAF、计时器或播放器。
5. 运行 `npm run check`，检查手机布局、键盘使用和系统减少动态效果模式。
