# Agent 协作指南

## 项目与入口

Stock Assistant 是本地优先的 A 股研究工作台，使用 npm workspaces、Next.js、Fastify、Prisma/SQLite 和 Python。使用 Node 20+、npm 10+，Python 建议 3.10+。

- 项目安装、配置、迁移与启动见 [README.md](README.md)。
- 前端说明见 [apps/web/README.md](apps/web/README.md)。
- API 入口及业务模块索引见 [services/api/README.md](services/api/README.md)。
- 数据采集说明见 [services/worker/README.md](services/worker/README.md)。
- 公共类型与工具见 [packages/shared/README.md](packages/shared/README.md)。
- 已有整改与验收记录见 [TODO.md](TODO.md)。

## 常用命令

以下命令从仓库根目录执行。

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

首次运行前根据 `.env.example` 创建根目录 `.env`。默认 Web 端口为 3000，API 为 4000。`npm run build` 构建 Web 与 API，`npm start` 运行构建产物。

## 代码组织

- 页面入口位于 `apps/web/app`，市场功能位于 `apps/web/features/market`，共享图表和业务组件位于 `apps/web/components`。
- API 的 `src/app.ts` 注册路由、错误处理和响应序列化。`src/modules/<业务>` 保存路由、业务逻辑及需要的输入 schema。
- `src/infrastructure` 统一管理运行配置、Prisma、内部设置、Worker 调用和序列化。
- Worker 的 `scripts` 是执行入口，`worker/common.py` 管理数据库与通用转换，`worker/providers` 管理外部数据源。
- 跨 Web/API 的类型和纯工具由 `@stock-assistant/shared` 导出。

修改接口时同步核对共享类型与页面调用者。估值复用 holdings 的 `valuation.ts`，证券主数据复用 stocks 的 `catalog.ts`，个股资讯和资金流复用对应业务服务。

## 数据与配置约定

`DATABASE_URL` 的相对路径以仓库 `prisma/` 为基准，默认指向 `data/stock.db`。API 和 Worker 使用同一个解析后的数据库。结构变更通过 Prisma migration 表达，已有迁移包含历史时间归一化和孤立证券关联补建。

交易日使用 UTC 零点毫秒表示，资讯时间保留真实时间戳。成交量为股，成交额和资金流为元。缺失价格与盈亏使用 `null`，市场统计展示覆盖范围与交易日。保留真实资金流来源、交易日及单位。

Tushare/Claude 配置优先读取数据库，空缺时读取环境变量。公开设置接口返回密钥配置状态，Worker 在执行时读取内部密钥。`.env`、数据库、备份、个人持仓与构建缓存由 Git 忽略。

AI 分析、报告历史与组合快照当前返回 501。记录功能状态时以路由和运行结果为准。

## 验证与交付

```bash
npm test
npm run test:worker
npm run typecheck
npm run lint
npm run build
npm run test:ui
```

根据改动选择对应检查，交付时说明已运行的命令及结果。Node/Python 回归使用临时数据库。页面回归需要 Chrome，支持 `UI_MODE=production npm run test:ui` 验证构建产物。Next 开发服务与构建共用 `apps/web/.next`，同时验证时使用独立源码副本或先结束该开发服务。

提交前检查差异及暂存文件，确认文档描述、接口和实际运行行为一致。用户指定的提交、推送和部署范围分别执行。
