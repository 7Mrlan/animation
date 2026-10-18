# 02 灵感引力场的独立生成提示词

复制下面整个文本块，即可交给没有项目上下文的 AI。尺寸、图形、运动和交付要求都在块内。

```text
请从空目录创建一个可以运行的单卡片动画演示。你只需要这份规格，不需要原项目、截图或之前的对话。直接完成实现。

技术与交付
使用 React、TypeScript 和 Vite，Node.js 24，普通 CSS，系统字体。选择互相兼容的依赖版本，开启 TypeScript strict。除本提示词明确列出的素材或播放器外，不增加 UI 库、动画库或远程资源。
创建 package.json、HTML 入口、React 入口、演示页面、独立动画组件与对应 CSS。提供 npm run dev、npm run build、npm run preview 和简短 README。使用清楚的组件及类名前缀，允许同一页面放多个实例。
有文件和终端工具时实际创建文件、安装依赖并验证构建；只有文本输出能力时，按文件给出完整代码和运行命令，并说明哪些检查没有执行。
将独立动画组件命名为 ClaudeField。

目标画面
制作一张暖杏色创意动画卡。中央是一枚不规则放射形标志，周围有三张漂浮纸片、两条旋转椭圆细线、三条射线和三个呼吸节点。移动指针时背景亮区跟随，中央标志只小幅移动。视觉要温和、细密，文字只作装饰。

技术与图形
使用 DOM、CSS keyframes、CSS custom properties 和 SVG mask。CSS 负责循环，Pointer Events 提供坐标，RAF 将同一帧内多次 pointermove 合并为一次样式更新。图形资源已经附在本提示词中，不依赖外部图标库。
将以下 SVG 原样放进新项目的本地资源目录，作为宽61px、高61px的 mask，用 #c86f52 填色。
<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Claude</title><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"></path></svg>
这枚图形来源于 Lobe Icons，保留 Copyright (c) 2023 LobeHub 和 MIT 许可说明，品牌权利属于各自权利人。组件代码与图形的许可分别说明。交付中为SVG附上下面的完整许可文本。
MIT License

Copyright (c) 2023 LobeHub

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

卡片外观
页面背景 #f6f7f9。外卡片最大宽376px，窄屏左右留16px，白底、21px圆角、8px内边距、细白边。外阴影为 0 1px 2px #23332a08 和 0 16px 32px -24px #23332a24。
舞台宽100%、高258px、圆角15px，overflow hidden，建立局部堆叠上下文。下方标题“灵感引力场”，16px；英文“A field of possibilities”，10px、#a0a7a2。舞台角落显示 NO. 02 与“指针交互”。
背景用 radial-gradient(circle at x% y%,#ffe8dc 0,#fbefe7 36%,#f9f4ee 78%)。叠一层28px间隔的横竖细网格，线色 #d9a58e，透明度0.35，用径向 mask 让网格边缘隐去。

从后向前安排元素
中心固定一块126px圆形柔光，颜色从 #fffaf2 到 #f8cfc0 再到透明。
三张纸片使用下面的布局，位置以舞台为参照。
a | 72×50px | left15%、top28%
b | 72×50px | right13%、top17%
c | 50×35px | left18%、bottom12% | opacity0.7
纸片用8px圆角、#d9ad8f细边、#fffdf9到#f7dfd1渐变、轻微投影，右下有三点装饰。
两条细线是以舞台中心为圆心的椭圆，尺寸185×72px与122×198px，边色 #cb785e，透明度0.45与0.28。
三条射线长116px、高1px，渐变两端透明，绕左端旋转18deg、142deg、265deg，再沿各自轴向偏移26px、22px、30px。
标志位于纸片和细线前方。三个7px节点位于 left30% top23%、right24% top63%、left23% bottom20%，颜色 #c76f53，外加5px淡色光圈。
右边放8px竖排 THINK / CREATE，右下附近放一枚小星号，作为漂浮装饰，不能误当作跟随系统指针。

循环动画规格
纸片a用4.4s ease-in-out，从 translateY(0) rotate(-18deg) 到 translateY(-8px) rotate(-12deg) 再返回；纸片b用5.3s反向播放同一序列；纸片c用6.1s并延迟0.6s。等待期间应用起始关键帧，避免首次闪跳。
网格在9s内匀速移动，两个背景层分别从(0,0)到(28px,28px)与(-28px,-28px)，随后无缝循环。
中心柔光用3.8s在0.92与1.08倍之间呼吸，保持居中位移。
椭圆线一用7s从-24deg转到336deg，椭圆线二用10s反向。用完整关键帧明确起点和终点。
射线用3.3s在opacity 0.18与0.72之间呼吸，后两条延迟0.7s和1.4s。保持各自静态角度，不让透明度动画覆盖旋转。
节点用2.7s在scale 0.7与1.25、opacity 0.4与1之间变化，三个延迟0、0.8s、1.6s。
标志以4.2s改变 drop-shadow，从0 10px 12px #a95c442b到0 15px 18px #a95c4450，再返回。
小星号用4s在原位与translate(8px,-8px) rotate(18deg)之间往返。

指针交互
由容器矩形计算 x=100*(clientX-left)/width、y=100*(clientY-top)/height，夹取到0至100，初值为50、50。离开时回到中心。
背景亮区圆心跟随 x、y；另画150px指针光圈，圆心对准指针，定位过渡0.35s ease。光圈用4.8s在scale0.6至1.05、opacity0.18至0.42之间呼吸。
中央标志的定位值为 left=50%+(x%-50%)*0.12，top同理，形成小幅 parallax 视差，位置过渡0.25s。标志基础rotate(-5deg)，hover时rotate(6deg) scale(1.08)，过渡0.3s。
把居中定位、交互旋转和阴影呼吸安排在不冲突的属性或父子层上，不能让关键帧覆盖整个指针变换。装饰层使用 pointer-events none，舞台接收指针事件。

本动画额外验收
指针从中心移动到四角时，光圈完整跟随而标志仅小幅移动。离开后回中，纸片和轨道不中断。没有素材网络请求，多实例图形正常。

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
