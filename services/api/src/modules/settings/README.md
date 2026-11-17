# 设置模块

提供数据库设置管理和外部服务连接测试。`schema.ts` 校验请求，`service.ts` 读写 Setting 并输出公开配置状态，内部密钥读取位于 `infrastructure/settings.ts`。

## 接口

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/settings` | 数据库设置列表 |
| GET | `/settings/value/:key` | 单条公开设置，缺失返回 404 |
| PUT | `/settings` | 通过 items 数组批量保存 key/value |
| POST | `/settings/rename` | 通过 from/to/value 更名普通设置 |
| DELETE | `/settings?key=...` | 删除数据库设置 |
| POST | `/settings/test-tushare` | 使用 token 测试 Tushare |
| POST | `/settings/test-claude` | 使用 apiKey、model 测试 Claude |

## 配置规则

`tushare.token` 与 `claude.apiKey` 是密钥项。公开接口将其 value 设为空字符串，返回 `configured` 与 `secret` 元数据。密钥输入留空时跳过更新，密钥键名固定。

内部读取优先使用非空数据库值，再使用环境变量 `TUSHARE_TOKEN`、`ANTHROPIC_API_KEY` 等。连接测试优先使用请求提供的值，空缺时读取内部配置。GET 列表反映数据库记录，环境变量配置由内部读取逻辑使用。

Tushare 测试请求 stock_basic，Claude 测试请求 Anthropic messages。连接测试访问外部服务，Claude 请求带有模型和少量输出额度。设置保存于本地数据库，密钥当前为明文存储。

默认与深度模型分别使用 `claude.defaultModel`、`claude.deepModel`。当前 AI 分析功能状态见 [ai](../ai/README.md)。

## 验证

从根目录运行 `npm test`，`settings.test.ts` 验证密钥状态、空值更新、内部读取及向 Worker 注入。`npm run test:ui` 覆盖页面保存与留空测试，连接上游在回归中使用受控响应。模块索引见 [API README](../../../README.md)。
