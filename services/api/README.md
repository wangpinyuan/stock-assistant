# Fastify API

为 Web 提供持仓、自选、组合估值、证券行情、市场统计、资金流、资讯、设置与更新任务接口。

## 运行

从仓库根目录执行以下命令。

```bash
npm run dev:api
npm --workspace services/api run build
npm --workspace services/api run start
```

`src/index.ts` 加载配置并启动服务，`src/app.ts` 导出可供测试调用的 `buildApp`。默认监听 `127.0.0.1:4000`，`GET /health` 返回健康状态。生产构建使用 esbuild 内联共享 TypeScript 代码，运行产物为 `dist/index.js`，第三方依赖保留在 node_modules。

## 目录与模块

每个业务目录包含 `routes.ts` 和需要的 service、schema 或公共业务逻辑。完整路径前缀在 `src/app.ts` 注册。

| 模块 | 接口前缀 | 说明 |
| --- | --- | --- |
| [holdings](src/modules/holdings/README.md) | `/holdings` | 持仓与估值 |
| [watchlist](src/modules/watchlist/README.md) | `/watchlist` | 自选与排序备注 |
| [portfolio](src/modules/portfolio/README.md) | `/portfolio` | 组合汇总 |
| [stocks](src/modules/stocks/README.md) | `/stocks` | 证券、行情、K 线与技术信号 |
| [market](src/modules/market/README.md) | `/market` | 市场统计、指数与概念板块 |
| [fund-flow](src/modules/fund-flow/README.md) | `/fund-flow` | 资金流查询 |
| [news](src/modules/news/README.md) | `/news` | 资讯查询 |
| [settings](src/modules/settings/README.md) | `/settings` | 设置与连接测试 |
| [updates](src/modules/updates/README.md) | `/update` | 数据抓取任务 |
| [ai](src/modules/ai/README.md) | `/ai` | AI 与报告占位接口 |

## 公共基础设施

| 文件 | 职责 |
| --- | --- |
| `infrastructure/config.ts` | 根目录定位、`.env`、数据库路径、Python、端口与来源配置 |
| `infrastructure/prisma.ts` | Prisma Client |
| `infrastructure/settings.ts` | 内部设置与环境变量回退 |
| `infrastructure/workerRunner.ts` | 异步 Python 子进程、超时、结果解析及同任务并发合并 |
| `infrastructure/serialize.ts` | Decimal 转 number，Date 转 ISO 字符串 |

API 使用根目录 `.env`。相对 SQLite 路径以 `prisma/` 为基准，`WORKER_PYTHON` 指定解释器。浏览器允许来源由 `WEB_ORIGIN` 配置，默认允许 localhost/127.0.0.1 的 Web 端口。

## HTTP 行为

Zod 输入错误返回 400，记录不存在返回 404，唯一键冲突返回 409，关联记录错误返回 400。未处理服务错误返回 500。更新 Worker 失败返回 502，未实现功能返回 501。具体成功结构由各业务路由定义。

Worker 的 stdout 最后一行为 JSON，stderr 保留执行日志。更新响应包含 `ok`、退出码、耗时、输出与解析结果。相同执行参数的并发任务共享进程，成功与失败均释放任务记录。

## 验证

```bash
npm test
npm --workspace services/api run typecheck
```

测试位于 `tests/`，涵盖 HTTP 契约、估值、设置、更新、真实子进程和 Python 写入后读取。测试数据库使用临时目录。跨端交互使用根目录的 `npm run test:ui`。安装与迁移见 [项目 README](../../README.md)。
