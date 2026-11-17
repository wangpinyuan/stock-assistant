# AI 与报告模块

当前模块保留 AI 分析与报告查询入口，以下接口统一返回 HTTP 501，响应包含 `ok: false` 和未实现说明。

| 方法 | 路径 |
| --- | --- |
| POST | `/ai/analyze/stock/:code` |
| POST | `/ai/analyze/portfolio` |
| POST | `/ai/analyze/market` |
| GET | `/ai/reports` |
| GET | `/ai/reports/:id` |

实现位于 `routes.ts`。前端 `/ai` 页面展示功能占位说明，当前这些路由返回固定状态。

Claude 密钥保存与连接测试由 [settings 模块](../settings/README.md) 提供，测试会请求 Anthropic 服务。报告生成、持久化与查询仍待实现。

从根目录运行 `npm test` 和 `npm run typecheck` 检查 API 与契约。模块索引见 [API README](../../../README.md)。
