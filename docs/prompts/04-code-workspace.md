# 04 代码微光的独立生成提示词

复制下面整个文本块，即可交给没有项目上下文的 AI。尺寸、图形、运动和交付要求都在块内。

```text
请从空目录创建一个可以运行的单卡片动画演示。你只需要这份规格，不需要原项目、截图或之前的对话。直接完成实现。

技术与交付
使用 React、TypeScript 和 Vite，Node.js 24，普通 CSS，系统字体。选择互相兼容的依赖版本，开启 TypeScript strict。除本提示词明确列出的素材或播放器外，不增加 UI 库、动画库或远程资源。
创建 package.json、HTML 入口、React 入口、演示页面、独立动画组件与对应 CSS。提供 npm run dev、npm run build、npm run preview 和简短 README。使用清楚的组件及类名前缀，允许同一页面放多个实例。
有文件和终端工具时实际创建文件、安装依赖并验证构建；只有文本输出能力时，按文件给出完整代码和运行命令，并说明哪些检查没有执行。
将独立动画组件命名为 CodeWorkspace。

目标画面
制作一个淡薄荷绿的代码工作台动画。中央是一扇小终端，背景有缓慢漂移的细网格。指针控制一个带双环光晕的圆圈和准星，终端只跟随最多8px，并继续自身的轻微上下浮动。装饰文字使用代码片段，不出现商品和价格。

技术与结构
使用 DOM、CSS keyframes、CSS custom properties、Pointer Events 与 requestAnimationFrame。用 ref 保存DOM、最新指针坐标和等待中的RAF编号。输入事件只更新最新坐标，同一帧最多安排一次写样式，不用逐帧React state，不使用Canvas或动画库。
将背景网格、指针光圈、准星、终端窗口分成独立元素。终端标题栏和代码行放在窗口内部；装饰层pointer-events none，由舞台统一接收输入。

卡片外观
页面背景#f6f7f9。外卡片最大宽376px，窄屏两侧16px，白底、圆角21px、内边距8px、细白边，阴影0 1px 2px #23332a08和0 16px 32px -24px #23332a24。
舞台高258px、宽100%、圆角15px、overflow hidden。背景为 radial-gradient(circle at x% y%,#e7f3ed 0,#f2f6f4 38%,#f8faf9 82%)。下面写“代码微光”及“Ideas come to life”，分别16px和10px，英文色#a0a7a2。角落显示NO. 04与“指针交互”。
网格离舞台边缘12px，用两个linear-gradient画24×24px网格，线色#b8c9c1，整体opacity0.45，并用以指针为中心的径向mask让远处隐去。
光圈110×110px，边框#79a89a77，另加8px与18px的低透明度外圈。准星由20px圆环与横竖34px细线构成，颜色#638d8277。
终端194×108px，以舞台中心为锚点，12px圆角、1px #c0d0cb边框、#ffffffdf背景。阴影0 17px 28px #36544a1a，叠一层白色内高光。
标题栏高22px，浅色底，左侧三个5px圆点，右侧7px等宽字“MOTION / WORKSPACE”。内容区13px内边距，9px等宽字体，行间隔6px。显示行号01至04，以及const idea = await、build(prompt);、return future;、▋。关键词用#5f8e83，变量用#4d5a68，行号更浅。右下角放8px“IDEA → CREATE”。

指针坐标与视差
每帧用getBoundingClientRect取得容器位置。x=clamp(100*(clientX-left)/max(width,1),0,100)，y同理。初值50、50，pointerleave恢复到50、50。
--code-x与--code-y保存百分比，供背景、光圈和准星使用。光圈left=x%-55px、top=y%-55px；准星left=x%-10px、top=y%-10px。
终端额外位移shiftX=(x-50)*0.16px，shiftY=(y-50)*0.16px，所以范围是±8px。写成独立CSS变量，不能将整个transform覆盖掉。
光圈的left和top使用0.14s linear过渡，准星用0.1s linear，形成轻微lag；不要再叠一个无限追踪循环。

循环关键帧
网格用10s linear循环，两个背景层从(0,0)移到(24px,24px)与(-24px,-24px)。移动刚好一个网格单元，接缝要连续。
光圈用4s ease-in-out在scale0.72、opacity0.42与scale1.05、opacity0.82之间呼吸。
终端用5.6s ease-in-out。0%和100%为translate(calc(-50% + shiftX),calc(-50% + shiftY)) rotate(-3deg)，50%为translate(calc(-50% + shiftX),calc(-53% + shiftY)) rotate(0deg)。这里shiftX和shiftY由CSS变量提供，百分比居中以终端自身为参考。
文字光标用1s steps(1,end)闪烁，0%至45%为opacity1，46%至100%为0.15。静态模式要停掉实际承载光标动画的子元素。
hover时只略加深终端投影，不抢写已有的transform。

本动画额外验收
指针在左上角、中心、右下角时，终端位移分别约为(-8,-8)、(0,0)、(8,8)px。光圈仍能跟到舞台边缘；离开后回中。指针交互与5.6s浮动同时生效，卸载后没有待执行输入回调。

播放与可访问性
在舞台左下角放两个独立按钮，分别控制暂停或继续、从头重播。按钮尺寸至少 32px，有中文 aria-label 和清晰的键盘焦点，按钮自身不要跟随内部图形运动。
初始进入页面即可看到完整构图。使用 IntersectionObserver 观察舞台，露出比例达到 0.08 时才允许自动播放，并结合 document.hidden 和手动暂停状态共同控制。切到后台或离屏后停止主要循环，回来时只在手动暂停未开启的情况下恢复。
CSS 动画通过 animation-play-state 暂停，覆盖普通元素和伪元素；JS 时间轴取消 RAF；播放器使用自身暂停接口。恢复时重置上一帧时间戳，避免把后台停留时间算进动画。
监听 prefers-reduced-motion。开启时停止装饰性循环与跟随位移，展示清楚的静态构图；必要的展开或切换可以立即完成。任何 Effect 都要清理监听器、观察器和待执行的回调，确保 React StrictMode 的重复创建与清理安全。

完成后的验收
检查 320px、768px、1440px 宽度，页面没有横向滚动，标题和按钮不被动画遮住。分别检查首次加载、循环接缝、暂停继续、重播、离屏返回和静态模式。
验证同页两个实例互不影响，卸载后没有继续运行的时间轴或播放器。运行 npm run build，报告执行结果；无法运行的检查写明未执行。最后用短说明解释关键帧、坐标与交互之间的关系。
```

[返回提示词目录](README.md)
