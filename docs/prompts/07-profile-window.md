# 07 光标来访的独立生成提示词

复制下面整个文本块，即可交给没有项目上下文的 AI。尺寸、图形、运动和交付要求都在块内。

```text
请从空目录创建一个可以运行的单卡片动画演示。你只需要这份规格，不需要原项目、截图或之前的对话。直接完成实现。

技术与交付
使用 React、TypeScript 和 Vite，Node.js 24，普通 CSS，系统字体。选择互相兼容的依赖版本，开启 TypeScript strict。除本提示词明确列出的素材或播放器外，不增加 UI 库、动画库或远程资源。
创建 package.json、HTML 入口、React 入口、演示页面、独立动画组件与对应 CSS。提供 npm run dev、npm run build、npm run preview 和简短 README。使用清楚的组件及类名前缀，允许同一页面放多个实例。
有文件和终端工具时实际创建文件、安装依赖并验证构建；只有文本输出能力时，按文件给出完整代码和运行命令，并说明哪些检查没有执行。
将独立动画组件命名为 ProfileWindow。

目标画面
制作一张冷灰蓝色的档案窗口动画。中央是一扇略微倾斜的小窗口，有三枚标题栏圆点、AI头像、两行文字、绿色勾选标记与三条短横线。指针位置有一片淡蓝光晕和一枚装饰箭头，两者直接跟随；窗口本身独立浮动。

技术与结构
使用DOM、CSS keyframes、CSS custom properties、Pointer Events和RAF合帧。ref保存容器、最新坐标与待执行的RAF，不用每次移动都更新React state，不引入动画库或图片。
光晕、窗口、装饰箭头分别成层。窗口内容属于装饰性示例，AI头像、勾选标记与箭头可用内联SVG或简单字符绘制，不创建真实账号功能。

卡片外观
页面背景#f6f7f9。外卡片最大宽376px，窄屏左右留16px，白底、圆角21px、内边距8px、细白边，阴影0 1px 2px #23332a08和0 16px 32px -24px #23332a24。
舞台宽100%、高258px、圆角15px，背景linear-gradient(135deg,#f3f5fb,#fbfcff)，文字主色#526783，overflow hidden。下方写“光标来访”和“Follow your curiosity”，16px与10px，英文#a0a7a2。角落标NO. 07与“指针交互”。
光晕为136×136px的圆，背景radial-gradient(circle,#e3eaff 0,transparent 70%)，在窗口后面。
窗口184×118px，位于舞台中心，12px圆角，1px #cbd6e7边框，#ffffffd9背景，阴影0 18px 28px #34496517，叠白色内高光。
标题栏高22px，背景#f7f9fd，底边#e1e7f0，左侧三个5px圆点#aab9ce，右侧7px字“MOTION / PROFILE”。
资料行左右内边距13px、上14px，元素间距9px。头像32×32px，10px圆角，#e8eef9底，#5e79a6的13px AI文字。旁边10px主标题“Hello, explorer”，下面8px说明“a little interaction”，透明度0.65。最右边为18px淡绿色圆形勾选标记，底#e3f2ea、勾#469064。
下方三条4px高的圆角横线，颜色#e5ebf4，宽100%、68%、42%，间距4px。装饰箭头22px，颜色#52719f，轻微投影，在窗口前面。

直接跟随
pointermove仅保存最新client坐标；若没有等待中的回调，再预约一帧。回调使用容器矩形将坐标换成0至100的百分比并夹取，写入--pointer-x和--pointer-y。初始值50%、50%，离开时回中。
光晕left=pointerX%-68px、top=pointerY%-68px，确保圆心跟随。箭头left=pointerX%、top=pointerY%，再translate3d(4px,4px,0)，与系统指针错开一点。
两者的位置不设置CSS transition，也不加额外插值延迟，表现为直接跟手。保留系统指针，可以给舞台cursor crosshair；装饰箭头不能成为唯一的输入反馈。
窗口始终以舞台中心定位，不读取指针位移。装饰层pointer-events none，不遮挡外面的暂停和重播按钮。

循环动画
光晕用4.8s ease-in-out，0%与100%为scale0.8、opacity0.55，50%为scale1.14、opacity1。位置变化仍由left、top承担，缩放不会覆盖位置。
窗口用5.5s ease-in-out，起终点transform为translate(-50%,-50%) rotate(-4deg)，中点为translate(-50%,-54%) rotate(0deg)。窗口高118px，因此额外上移约4.72px。
箭头用3.8s ease-in-out在opacity0.42与1之间往返，保留固定的4px位移。不要给同一窗口再加一段争写transform的hover动画。

本动画额外验收
指针快速移动时箭头与光晕跟随，窗口仍只是原地浮动；离开后两个指针装饰回中。RAF是事件驱动的合帧，不是空闲时仍持续运行的追踪循环。静态模式中窗口、头像和文字完整可见。

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
