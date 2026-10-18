# 08 小小宇宙的独立生成提示词

复制下面整个文本块，即可交给没有项目上下文的 AI。尺寸、图形、运动和交付要求都在块内。

```text
请从空目录创建一个可以运行的单卡片动画演示。你只需要这份规格，不需要原项目、截图或之前的对话。直接完成实现。

技术与交付
使用 React、TypeScript 和 Vite，Node.js 24，普通 CSS，系统字体。选择互相兼容的依赖版本，开启 TypeScript strict。除本提示词明确列出的素材或播放器外，不增加 UI 库、动画库或远程资源。
创建 package.json、HTML 入口、React 入口、演示页面、独立动画组件与对应 CSS。提供 npm run dev、npm run build、npm run preview 和简短 README。使用清楚的组件及类名前缀，允许同一页面放多个实例。
有文件和终端工具时实际创建文件、安装依赖并验证构建；只有文本输出能力时，按文件给出完整代码和运行命令，并说明哪些检查没有执行。
将独立动画组件命名为 OrbitCore。

目标画面
制作一张淡蓝灰色的小型轨道动画。中心是一块轻微倾斜、带柔和阴影的圆角方块，上面显示几何星形；两条细椭圆线在后方摆动，两个大小不同的粒子上下漂浮。使用少量元素和低饱和配色，不增加指针跟随。

技术与结构
使用DOM、CSS伪元素、CSS keyframes、CSS custom properties、currentColor和color-mix。轨道用容器的`::before`与`::after`绘制，两个粒子和中心方块用独立元素。所有图形本地生成，不使用图片或动画库。
提供可选hue和background参数，默认200与#e9f0f5。将参数放在组件根节点的局部CSS变量上，多个实例不得共用会相互覆盖的全局变量。

卡片外观
页面背景#f6f7f9。外卡片最大宽376px，窄屏左右留16px，白底、21px圆角、8px内边距、细白边。阴影0 1px 2px #23332a08以及0 16px 32px -24px #23332a24。
舞台宽100%、高258px、15px圆角，背景取background参数，前景为hsl(hue 36% 30%)。使用overflow hidden与isolation isolate。下方标题“小小宇宙”，16px；英文“Everything in orbit”，10px、#a0a7a2。角落标NO. 08与“CSS 循环”。
轨道A为185×92px，left=calc(50% - 92px)、top39px；轨道B为132×68px，left=calc(50% - 66px)、top56px。均为1px currentColor边框、50%圆角，透明度分别0.18与0.15。它们位于方块后面上半部，不是绕整个舞台的大圆环。
粒子A直径18px，left23%、top36px，颜色为currentColor与透明色混合，透明色占86%。粒子B直径9px，right23%、top118px，currentColor填充、整体opacity0.24。
中心方块78×78px，left50%、top50%，translate(-50%,-50%)居中，22px圆角。边框取currentColor的26%不透明度，背景为background色与白色按72%和28%混合。阴影0 16px 30px，色取currentColor的15%不透明度，再叠白色内高光。
方块中央放24px几何星形，可用字符✳或内联SVG保证字体兼容。左下写10px“IN ORBIT”，右上附近写8px竖排“A SMALL UNIVERSE”，都使用淡色。

运动规格
两条轨道共用往返关键帧。0%和100%为rotate(-18deg) translateY(0)，50%为rotate(-10deg) translateY(-5px)。A用6s ease-in-out，B用8s ease-in-out并reverse。这是小角度oscillation摆动，不是完整360度旋转；对称关键帧的reverse不必表现为明显相反方向。
两颗粒子共用关键帧。起终点为translateY(0) scale(1)，中点为translateY(-12px) scale(1.12)。A用4s，B用5.4s反向，ease-in-out。
中心方块用4.5s ease-in-out。起终点transform为translate(-50%,-50%) rotate(-6deg) scale(1)，中点为translate(-50%,-53%) rotate(-2deg) scale(1.04)。百分比位移以自身78px高度为参考。
各层周期独立，首尾值一致。明确写出完整transform或拆分父子定位层，不能因关键帧覆盖而丢掉居中位移。

本动画额外验收
默认配色符合蓝灰背景与深蓝灰线条。修改hue和background后，方块边缘、粒子及阴影随当前实例变化，其他实例不变。轨道小幅摆动，粒子明显浮动，中心方块动作更轻。检查静态姿态和窄屏裁切。

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
