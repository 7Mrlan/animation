# 代码与素材来源

## 提取的动画代码

动画组件和 CSS 从 `7Mrlan/digital-tools-store` 当前工作区提取，具体对应关系见 [EXTRACTION.md](EXTRACTION.md)。画廊外壳和学习功能为此独立项目新增。本次提取未给原代码另行设定开源许可证。

## Claude 标志

`public/brands/claude.svg` 沿用原项目资产。原项目记录：来源为 [Lobe Icons](https://github.com/lobehub/lobe-icons) 的 `@lobehub/icons-static-svg` 包，取得时间 2026-09-26。保留原始 SVG 路径，以 CSS mask 着色。

原上游 MIT 许可完整保留在 [public/brands/LICENSE](../public/brands/LICENSE)，该许可针对相应上游素材，不代表整个仓库或所有品牌素材都采用 MIT。

## Duolingo Duo

原项目记录：取得时间 2026-10-03，来自 Duolingo 官方首页动画。

- 官方页面：[duolingo.cn](https://www.duolingo.cn/)
- 原始 Lottie：[首页 splash 动画](https://d35aaqx5ub95lt.cloudfront.net/lottie/splash/50bda50231c0bce1584e982cebfe8f33.json)
- 本地 JSON：`public/brands/duolingo-duo-home.json`
- 本地静态海报：`public/brands/duolingo-duo-home.svg`

本地文件沿用原项目已裁剪版本：保留原 Duo 图层 `comp_6` 及根父级，保留路径、遮罩、颜色和关键帧；循环为 30fps 下的 130–290 帧，画面裁剪到 x=470、y=300、width=560、height=480。海报由同一动画的第 130 帧生成。本次提取没有重新下载或修改这两份素材。

Duolingo 保留其角色、美术和商标权利。本项目未取得或附加这些素材的再许可，不应把它们视作可任意商用的通用图标。

## DeepSeek 小鲸

`public/brands/deepseek-whale.svg` 提取自 [DeepSeek 官方 DeepSeek-LLM 仓库的 images/logo.svg](https://github.com/deepseek-ai/DeepSeek-LLM/blob/main/images/logo.svg)，取得时间 2026-10-18。保留小鲸原始路径与蓝色，去除字标，调整 viewBox 以独立显示。运行时使用本地素材。

新增动画通过互补 clipPath 将图形分为身体和尾部，表现摆尾。巡游、水面和鲸跃代码为本项目新增。DeepSeek 名称和图形归相应权利人所有，此处不额外授予品牌图形使用许可。

## 品牌说明

Claude、Gemini、Duolingo 等名称和图形归各自权利人所有。此项目用于展示和学习动画实现，不表示官方合作或背书。外部来源链接为原项目保存的出处记录；运行页面仅使用本地素材。
