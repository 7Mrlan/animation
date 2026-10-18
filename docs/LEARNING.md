# 动画学习指南

完整教程已按章节放在 [learning 目录](learning/README.md)。九个动画各有一章，包含源码对应关系、关键参数、修改练习和可复制的 AI coding 提示词。

## 选择一个入口

- 刚开始学习，先读[运行项目与基础概念](learning/00-foundations.md)，再做[信封动画](learning/09-floating-mail.md)。
- 想了解某张卡片，打开[章节目录](learning/README.md)，编号与页面卡片一致。
- 准备复制组件，先看[播放控制与工程检查](learning/10-playback-and-quality.md)。
- 需要把想法交给 AI，查[动画术语](learning/11-motion-vocabulary.md)，再选一份[动画生成或产品创意提示词](prompts/README.md)，从空目录创建已有款式或新的产品动画。

## 开始练习

在项目根目录运行 `npm ci` 和 `npm run dev`。打开终端给出的地址，选择一张卡片，对照源码修改一个参数，再观察变化。

动画内容、卡片外壳和播放控制分布在不同文件。仅复制动画组件及 CSS 可以获得图形和循环效果，离屏暂停等能力还需要对应的 Hook 与外壳样式。

安装与构建命令见[项目 README](../README.md)，素材使用说明见 [ATTRIBUTION](ATTRIBUTION.md)。
