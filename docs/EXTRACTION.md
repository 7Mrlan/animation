# 抽离记录

提取日期：2026-10-18。来源：`7Mrlan/digital-tools-store` 当前工作区；原仓库 HEAD 为 `a5f30bc`。原工作区存在尚未提交的其他修改，本次没有写入、暂存或提交原仓库。

| 原文件                                                     | 新文件                                     | 调整                                                                   |
| ---------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `frontend/src/components/product-catalog.tsx` 的 ClaudeArt | `src/animations/ClaudeField.tsx`           | 独立导出，取消商品紧凑模式，保留指针位置与绘制结构                     |
| 同文件的 GptCodeArt                                        | `src/animations/CodeWorkspace.tsx`         | 移除点数和业务文案，保留光圈、准星、终端与 RAF 合帧                    |
| 同文件的 AccountArt                                        | `src/animations/ProfileWindow.tsx`         | 移除账号商品文案，保留窗口和光标跟随                                   |
| 同文件的 TelegramArt                                       | `src/animations/TelegramSignal.tsx`        | 独立导出                                                               |
| 同文件的 GenericArt                                        | `src/animations/OrbitCore.tsx`             | 用纯展示字符替代商品类别与编号                                         |
| `frontend/src/components/subscription-deck.tsx`            | `src/animations/CardDeck.tsx`              | 移除商品 plans、价格和国际化依赖；保留四层布局，增加播放控制、触摸交互 |
| `frontend/src/lib/subscription-motion.ts`                  | `src/lib/subscription-motion.ts`           | 算法保持原样，仅统一代码格式                                           |
| `frontend/src/components/membership-scene.tsx`             | `src/animations/Membership.tsx`            | 去掉商品参数、时长文案和国际化；拆成 GeminiOrbit 与 DuoScene           |
| `frontend/src/components/duo-animation.tsx`                | `src/animations/DuoPlayer.tsx`             | 名称调整，本地素材路径适配子目录部署                                   |
| `frontend/src/styles/storefront-home.css`                  | 各独立动画 CSS                             | 按选择器和关键帧筛选，保留必要层叠；去除商品布局                       |
| 同文件中保留的信封样式                                     | `src/animations/FloatingMail.tsx` / `.css` | 恢复最小 DOM；这是原首页样式中的附加示例，不是当前目录中的商品         |
| `frontend/src/styles/membership-products.css`              | `src/animations/Membership.css`            | 只保留动画区域与相关关键帧                                             |
| `frontend/public/brands/`                                  | `public/brands/`                           | 仅复制 Claude SVG、Duo JSON/海报和 LobeHub 许可                        |

新写的 `App`、`AnimationCard`、`SourceDialog` 和 `styles.css` 仅服务于学习画廊。卡片使用白色边缘、柔和内阴影、分层外阴影与独立浅色舞台。动画采用原来的形状、配色和关键帧，舞台高度为 258–276px，为观看和指针交互留出空间。

不包含商店后端、数据库、API、订单、支付、用户状态、访问统计、生产配置或环境变量。
