# 第 07 章 光标来访的直接跟随

这张卡片的光圈和装饰箭头紧跟指针，档案窗口则独立浮动。它与代码终端用着相近的 JS 结构，跟随手感却不同。对照阅读，很容易看清差别来自哪里。

源码是 [ProfileWindow.tsx](../../src/animations/ProfileWindow.tsx) 和 [ProfileWindow.css](../../src/animations/ProfileWindow.css)。

## JS 保留最新位置

`pointer` ref 记录最近的 `clientX`、`clientY`，`frame` ref 确保当前只等待一个 RAF 回调。回调将坐标换算为 0 至 100 的百分比，写进 `--account-x` 和 `--account-y`。

指针离开后，两项都恢复为 50%。这个复位发生在下一次预约的帧中。若组件被卸载，清理函数会取消待执行的回调。

这部分可以与[第 04 章](04-code-workspace.md)逐行比较。终端组件还计算了额外的位移变量，档案窗口没有这一步。

## 跟随感主要由 CSS 决定

光圈直径为 136px，定位时减去半径 68px，让它的圆心跟住指针。装饰箭头直接定位到指针位置，再用 `translate3d(4px, 4px, 0)` 留一点偏移，避免完全压在系统指针下面。

两者都使用 `transition: none`。位置更新后直接到达目标，与终端卡片中 0.1s 和 0.14s 的坐标过渡相比，拖尾感更少。

这枚箭头属于 DOM 装饰。系统指针仍然存在，容器还设置了 `cursor: crosshair`。若以后要做完整的自定义鼠标指针，需要另外考虑原生指针、触摸设备和页面外区域。

## 背景、窗口和箭头各自怎么动

| 元素 | 周期 | 改变的属性                                           |
| ---- | ---- | ---------------------------------------------------- |
| 光圈 | 4.8s | scale 在 0.8 至 1.14 之间，opacity 在 0.55 至 1 之间 |
| 窗口 | 5.5s | 居中位移从 -50% 到 -54%，角度从 -4 度到 0 度         |
| 箭头 | 3.8s | opacity 从 0.42 到 1 再返回                          |

光圈的位置由指针变量控制，呼吸由 `transform: scale(...)` 控制，两部分作用在不同属性上。箭头的固定偏移也没有被透明度动画覆盖。

窗口高 118px，纵向百分比变化对应约 4.72px 的额外上移。它没有把 `--account-x`、`--account-y` 写进自身位移，所以当前窗口不会随着指针来回平移。

## 悬停声明为什么需要仔细读

CSS 还写了一条悬停规则，让 `.account-window` 抬高、旋转并放大。不过同一元素的循环关键帧也在写 `transform`，正常播放时会与普通悬停声明竞争。不能看到这条 hover 规则，就认定两个效果会自然叠加。

如果要让悬停抬升稳定生效，可以给窗口加一层外容器。外容器负责 hover 位移，内部窗口继续执行浮动。这里与 Claude 标志不同，Claude 的日常循环主要改变滤镜，悬停改变 transform，所以冲突条件不同。属性合成规则可查 [MDN animation-composition](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-composition)。

本章记录当前代码的行为，下面把结构调整留作练习。

## will-change 只是一条提示

光圈与箭头声明了 `will-change: left, top`。它提示浏览器这些属性可能经常变化，但不保证它们一定只在合成阶段处理，也不证明所有设备都会更快。

如果准备在一个页面放几十个同类实例，先用性能面板看实际开销，再决定是否保留这条提示，或改用其他定位方式。相关限制见 [MDN will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change)。

## 练习拆开两个 transform

为窗口增加一个外层，把居中定位和悬停抬升安排清楚，再让内层承担循环浮动。检查 `left`、`top` 与百分比位移的参考对象有没有改变。只加一层 div，却照搬原来的居中规则，可能让窗口偏离中心。

从空目录生成同款效果，可复制[独立生成提示词](../prompts/07-profile-window.md)。下面的提示词用于本项目内的修改练习。

```text
请检查 src/animations/ProfileWindow.tsx 和 ProfileWindow.css 中的窗口 hover 与浮动关键帧。
让悬停抬升和原有 5.5s 浮动稳定共存，优先用父子元素分担 transform。
保持窗口初始位置、尺寸、配色以及光圈和装饰箭头的直接跟随。
不要给所有元素加 will-change，不增加动画库。
验证悬停进入与离开、暂停后恢复、窄屏和减少动态效果，运行 npm run check。
解释每层元素负责的变换，以及修改后的坐标参照。
```

[返回目录](README.md) · [下一章 小小宇宙](08-orbit-core.md)
