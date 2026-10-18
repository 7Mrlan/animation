# 05 一声 Hello的独立生成提示词

这份提示词包含固定版本的角色素材地址，拿到素材后即可独立实现。

```text
请从空目录创建一个可以运行的单卡片动画演示。你只需要这份规格，不需要原项目、截图或之前的对话。直接完成实现。

技术与交付
使用 React、TypeScript 和 Vite，Node.js 24，普通 CSS，系统字体。选择互相兼容的依赖版本，开启 TypeScript strict。除本提示词明确列出的素材或播放器外，不增加 UI 库、动画库或远程资源。
创建 package.json、HTML 入口、React 入口、演示页面、独立动画组件与对应 CSS。提供 npm run dev、npm run build、npm run preview 和简短 README。使用清楚的组件及类名前缀，允许同一页面放多个实例。
有文件和终端工具时实际创建文件、安装依赖并验证构建；只有文本输出能力时，按文件给出完整代码和运行命令，并说明哪些检查没有执行。
将独立动画组件命名为 DuoScene。

目标画面
制作一张浅绿色语言学习角色卡。中央播放绿色Duo角色的原始矢量动作，两侧有白色“Hello!”和“Bonjour”气泡。角色动作必须来自下方提供的Lottie数据，完整播放身体、表情和肢体的变化；不能用整张图片上下浮动代替角色动画。

技术与可独立取得的素材
除React、React DOM外，允许使用lottie-web。动态导入lottie-web/build/player/lottie_light，使用SVG renderer。先建立独立的DuoScene与DuoPlayer组件，不需要读取任何示例实现源码。
在开发准备阶段，把下面两个固定版本资源下载到新项目的public/animations目录，并检查HTTP状态及文件格式。运行页面时只从本地路径读取，不依赖远程站点在线。
动画JSON
https://raw.githubusercontent.com/7Mrlan/animation/550052d73fe2fc5c924ead463f93c3592938bf81/public/brands/duolingo-duo-home.json
保存名duo.json，SHA-256为1779ff69507fa97db1885ae98518e6e9890e8511ca2c8cca4434a3632343a352。
静态SVG海报
https://raw.githubusercontent.com/7Mrlan/animation/550052d73fe2fc5c924ead463f93c3592938bf81/public/brands/duolingo-duo-home.svg
保存名duo-poster.svg，SHA-256为b9dcf772720515a90abb499156cea4078b906e1eef39812349971baaa1d3c7e2。
JSON的fr为30、ip为130、op为290、画面560×480。该文件已经设置循环区间，直接使用其时间轴，不要再次偏移或裁剪130帧。
Duo美术及商标属于Duolingo，README保留素材出处与权利说明。这两份素材没有被声明为MIT许可。若下载环境受限，先完成播放器和页面，明确缺失文件；不要伪造下载成功，也不要把自画角色称为原始动作复现。

卡片外观
页面背景#f6f7f9。外卡片最大宽376px，窄屏左右留16px，白底、21px圆角、8px内边距、细白边。阴影0 1px 2px #23332a08与0 16px 32px -24px #23332a24。
舞台宽100%、高258px、圆角15px，背景radial-gradient(ellipse at 50% 70%,#e5f5c9 0%,#f4faea 52%,#f8fbf3 80%)。下方标题“一声 Hello”，16px；英文“A little character”，10px、#a0a7a2。角落写NO. 05和“Lottie”。
播放器与海报共用230×197px盒子，位于舞台50%、50%，translate(-50%,-50%)居中。海报object-fit contain，播放器preserveAspectRatio为xMidYMid meet。两层绝对定位完全重合，不要因加载切换改变布局。
气泡为白底，文字#4c7932，8px 13px内边距，圆角13px 13px 3px 13px，轻投影。Hello在left18px、top33px，13px粗体、旋转-9deg；Bonjour在right16px、top54px，11px、旋转9deg。窄屏减少气泡字号，避免遮住角色脸部。

播放器生命周期
初始先显示海报，SVG播放器透明。允许播放且实例尚未存在时，并行加载player模块和本地JSON，检查response.ok后解析。
loadAnimation设置renderer svg、loop true、autoplay false、animationData为JSON。调用setSubframe(false)。收到DOMLoaded才显示SVG并隐藏海报，再按当前播放条件决定play或pause。
用一个同步函数统一处理手动暂停、可见性、document.hidden和系统减少动态效果。通过ref保存最新条件，避免每次可见性变化都重建播放器。
fetch使用AbortController。异步返回后再次检查组件是否已卸载；卸载时abort、移除事件监听并destroy已有实例。动态import无法由该AbortController取消，所以必须另外防止迟到回调创建实例。
下载或渲染失败时保留海报，并允许重播按钮重新创建播放器。重播成功后从JSON的有效起始帧开始，不能同时叠两个SVG实例。
本地素材URL遵循Vite的BASE_URL，支持部署在/animation/这样的子目录。若light导入缺少TS声明，补一个本地declare module声明，复用lottie-web类型，不用全局any掩盖类型错误。

配套气泡动画
两个气泡用5.8s ease-in-out，在translateY(0)与translateY(-7px)之间往返，Bonjour延迟-2.1s。固定旋转与浮动使用父子层或独立translate属性，不能互相覆盖。
气泡与播放器共享暂停条件。减少动态效果时显示静态海报，停止气泡运动；即使动画已经ready，也要重新显示海报。

本动画额外验收
JSON成功加载时播放名义时长约160/30秒的角色循环。慢速加载时先见海报，失败后仍有画面。反复重播、离屏返回、后台恢复、快速卸载重挂载都不得残留实例。检查根目录和子目录两种素材路径。

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
