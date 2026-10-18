# 轻动 · Animation Studies

把细微的互动，收藏成卡片。项目包含从现有首页抽离的九个动画，以及新增的 DeepSeek「潜入答案」，放进可以暂停、重播和筛选的卡片中。查看效果时，也能直接打开对应源码。

**只有动画，没有商品、价格、购买流程、登录或后台接口。**

## 本地运行

需要 Node.js **22.18+（22 系列）或 24+**，推荐 Node.js 24 LTS，与 `.nvmrc` 和 CI 一致。

```bash
git clone https://github.com/7Mrlan/animation.git
cd animation
npm ci
npm run dev
```

打开终端显示的本地地址，通常是 `http://localhost:5173`。

```bash
npm run typecheck  # TypeScript 严格检查
npm test           # 卡片时间轴、循环衔接和展开几何测试
npm run build      # 类型检查 + 生成 dist/
npm run preview    # 本地预览生产构建
npm run check      # 类型 + 测试 + 构建，与 CI 一致
npm run format     # 格式化代码和文档
```

## 为什么是这套框架

- 沿用 **React + TypeScript** 和原动画组件的实现，减少重写带来的偏差，展示与运动逻辑分别维护。
- 使用 **Vite** 构建静态演示，无需服务端渲染、路由或后端，产物可直接托管。
- 样式采用 **普通 CSS**，可以直接阅读关键帧、变量和伪元素，不依赖样式框架。
- Duo 示例按需加载 **Lottie light SVG**，其余动画使用 CSS 或 `requestAnimationFrame`。
- 运行时只有 React、React DOM 和 Lottie 三个依赖；字体使用系统字体，动画素材本地提供。

## 动画目录

| 卡片            | 内容                                     | 核心入口                                                                               |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| 01 层叠之间     | 卡片抽出、下沉、归位；悬停/聚焦/触摸展开 | [CardDeck.tsx](src/animations/CardDeck.tsx) · [时间轴](src/lib/subscription-motion.ts) |
| 02 灵感引力场   | Claude 标志、纸片、轨道、指针光晕        | [ClaudeField.tsx](src/animations/ClaudeField.tsx)                                      |
| 03 星光慢行     | Gemini 星形、双轨旋转、星点呼吸          | [Membership.tsx](src/animations/Membership.tsx)                                        |
| 04 代码微光     | 终端浮动、指针准星、背景网格视差         | [CodeWorkspace.tsx](src/animations/CodeWorkspace.tsx)                                  |
| 05 一声 Hello   | Duo Lottie 循环与静态海报回退            | [DuoPlayer.tsx](src/animations/DuoPlayer.tsx)                                          |
| 06 讯息涟漪     | 手机浮动、消息交错出现、信号呼吸         | [TelegramSignal.tsx](src/animations/TelegramSignal.tsx)                                |
| 07 光标来访     | 浮动窗口、光晕与装饰光标跟随             | [ProfileWindow.tsx](src/animations/ProfileWindow.tsx)                                  |
| 08 小小宇宙     | 轨道、悬浮粒子、中心呼吸                 | [OrbitCore.tsx](src/animations/OrbitCore.tsx)                                          |
| 09 一封轻盈的信 | 伪元素信封与反向浮动标签                 | [FloatingMail.tsx](src/animations/FloatingMail.tsx)                                    |

| 10 潜入答案 | 拖拽小鲸、流动水面、曲线巡游与鲸跃 | [DeepSeekDive.tsx](src/animations/DeepSeekDive.tsx) · [运动模型](src/lib/deepseek-motion.ts) |

每个组件旁边都有对应 CSS。Gemini 与 Duo 共用 `Membership.css`。查看文件面板还会显示动画所需的时间轴、播放器或 Hook，便于一起复制。

## 学习顺序

1. 先看 `FloatingMail` / `TelegramSignal`，理解 `@keyframes`、伪元素和错峰延迟。
2. 看 `GeminiOrbit` / `OrbitCore`，理解多组动画如何叠加，注意每组 `transform` 的作用层级。
3. 看 `ClaudeField` / `CodeWorkspace` / `ProfileWindow`，理解指针坐标、CSS 变量和 RAF 合帧。
4. 看 `CardDeck` 和 `subscription-motion.ts`，理解离散阶段、连续插值和层级交接。
5. 看 `DuoPlayer`，理解异步加载、取消、失败回退和动画实例销毁。
6. 看 `DeepSeekDive`，理解拖拽、水面冲击、曲线巡游和抛物线鲸跃。

完整的 [动画学习手册](docs/learning/README.md) 包含十个动画的逐章讲解，以及基础、播放控制、术语和 AI coding 四个专题。每个动画章节都有参数说明、动手练习和可复制的提示词。

- [从基础开始](docs/learning/00-foundations.md)
- [按卡片查找章节](docs/learning/README.md)
- [动画术语与需求翻译](docs/learning/11-motion-vocabulary.md)
- [动画生成与产品创意提示词](docs/prompts/README.md)，含十份动画规格和四份新产品创意模板，可直接交给没有项目上下文的 AI

原文件对应关系见 [抽离记录](docs/EXTRACTION.md)，第三方图形出处见 [素材说明](docs/ATTRIBUTION.md)。

## 结构

```text
src/
  animations/       独立动画组件与对应 CSS
  lib/              动画控制器与运动、水面计算函数
  hooks/            可见性与系统减少动态效果偏好
  components/       卡片外壳、源码对话框、图标
  catalog.tsx       十个动画的名称、说明与源码路径
  App.tsx           筛选与全局播放状态
  styles.css        新的卡片画廊外观
public/brands/      原动画所需的本地素材和第三方许可
```

## 播放与可访问性

- 卡片离屏、页面隐藏、打开源码面板时暂停；返回后恢复。
- 每张卡片和整页均可手动暂停，重播会重建该动画实例。
- 遵循系统 `prefers-reduced-motion`，展示静态构图、Duo 海报，不开启循环动画。卡片展开可用键盘立即切换。
- 源码面板使用原生 `<dialog>`，支持 Esc、焦点约束及关闭后焦点返回。
- 手机可点击层叠卡片展开；所有卡片均提供触摸可用的播放工具。

## 静态部署

`npm run build` 后部署 `dist/`。`base: './'` 让产物支持根目录及 `/animation/` 等子目录；Lottie 和海报路径也遵循同一规则。项目不需要环境变量。

线上演示：[轻动 · Animation Studies](https://7mrlan.github.io/animation/)。

仓库使用 `.github/workflows/check.yml` 自动检查和发布到 GitHub Pages。每次推送到 `main`，先安装依赖并运行 `npm run check`（类型检查、测试和构建），成功后上传 `dist/` 并部署。PR 和其他分支只检查，不发布。也可在 GitHub Actions 的 **Check and deploy Pages** 页面手动运行工作流。

首次启用时，需要在仓库 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**；后续发布由工作流自动完成。本项目不需要配置部署密钥或环境变量。

## 来源说明

动画来自原项目当前工作区，只复制到新项目，原项目保持不动。保留原来的动画形状、配色、关键帧和主要时序，移除业务依赖，并重新设计展示卡片。信封示例根据原首页保留的 CSS 恢复最小 DOM。品牌图形与 Duo 动画保留其原有权利说明；详见 [ATTRIBUTION](docs/ATTRIBUTION.md)。
