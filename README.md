# Stock Assistant

本地优先的 A 股研究工作台，使用 npm workspaces 管理 Next.js 前端、Fastify API 和 Python 数据脚本，数据保存在 SQLite。

## 当前功能

持仓与自选增删改、组合估值、个股日/周/月 K 线与技术信号、库内股票市场统计、资金流和资讯查询/更新、服务连接测试已接通。行情缺失时显示不可用及覆盖情况；不同交易日的持仓行情不会合并计算当日盈亏。

AI 分析、报告历史与组合历史快照尚未实现，对应 API 返回 501。连接测试会请求外部服务，Claude 测试可能产生少量 API 用量。当前模型支持股票与 ETF，交易流水、卖出、分红等历史收益口径仍待建设。

示例数据仅用于演示页面效果。演示数据和真实行情没有来源标记的历史记录，应在使用前重新采集核对。涨跌停数量按板块规则估算，页面已标注，新股等例外可能影响估算。

## 目录

```text
apps/web/app                    页面路由
apps/web/features/market        市场概览、资金流、资讯及更新 hook
apps/web/components              业务表格、图表与共享组件
services/api/src/modules        按业务组织的 routes / schema / service
services/api/src/infrastructure  数据库、运行配置、Worker、响应序列化
services/worker/worker           Python 数据库与数据源公共逻辑
services/worker/scripts          数据抓取和更新入口
packages/shared                 请求、响应类型与公共工具
prisma                          数据模型、迁移和演示 seed
data                            本地数据文件，Git 忽略
scripts                         Web 启动和隔离页面检查
TODO.md                         整改清单与逐项验收记录
```

## 开发文档

- [Agent 协作指南](AGENTS.md) 汇总项目入口、代码组织、数据约定与验证命令。
- [Web 前端](apps/web/README.md) 说明页面、组件、统一刷新和设置显示行为。
- [API 服务](services/api/README.md) 提供基础设施说明与 10 个业务模块的独立 README 索引。
- [Python Worker](services/worker/README.md) 说明采集脚本、数据源和存储单位。
- [共享包](packages/shared/README.md) 说明跨端类型、常量和公共工具。

## 安装与初始化

使用 Node 20、npm 10 或更高版本；Python 建议 3.10 或更高。安装 Node 依赖使用唯一的 npm 锁文件。

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:deploy
```

`DATABASE_URL="file:../data/stock.db"` 相对于 `prisma/` 解析，API 与 Python 最终使用同一绝对路径。既有数据库先复制备份再执行迁移。迁移会统一旧行情和新闻日期格式，无时区旧新闻文本及旧本地零点按 Asia/Shanghai 解释，保留同日已有毫秒记录，并将来源不明的旧资金流标记为 `legacy_*`，这些记录保留在库中并退出新榜单。旧写入未开启外键时产生的行情孤立记录会补建证券主记录；已有名称和分类优先保留，未知名称暂以代码显示。

按需建立 Python 环境。

```bash
python3 -m venv services/worker/.venv
services/worker/.venv/bin/pip install -r services/worker/requirements.txt
```

在 `.env` 中设置 `WORKER_PYTHON` 为该虚拟环境解释器的绝对路径。AKShare 用于行情及交易日历，Tushare 用于历史 K 线；Tushare 数据权限由账户决定。新浪和东方财富接口为公开接口，可用性受数据源影响。API 获取更新结果后再刷新页面，相同的并发任务会合并。

可选演示数据由下面的命令创建。

```bash
npm run seed
```

此命令会写入当前配置的数据库，请在专用演示库中使用。

## 运行

```bash
npm run dev
```

默认 Web 为 `http://localhost:3000`，API 为 `http://127.0.0.1:4000`。根目录 `.env` 同时供 Web 启动入口和 API 使用。自定义端口时同步调整 `WEB_PORT`、`API_PORT` 与 `NEXT_PUBLIC_API_BASE_URL`。`WEB_ORIGIN` 可用逗号列出精确的浏览器来源，未设置时允许 localhost/127.0.0.1 的 `WEB_PORT`。API 默认监听回环地址。`NEXT_PUBLIC_API_BASE_URL` 在构建时写入前端，生产模式下修改该值后需要重新构建。

构建与运行构建产物。

```bash
npm run build
npm start
```

Tushare/Claude 密钥可在设置页保存。数据库值优先，缺失时回退 `.env`。密钥接口只返回配置状态；连接测试在服务端读取已保存的密钥。密钥在本地数据库中以明文存储，请妥善保管数据库。`.env`、数据库、备份、真实持仓和构建缓存均应留在本地。

## 验证

```bash
npm test
npm run test:worker
npm run typecheck
npm run lint
npm run build
npm run test:ui
```

页面检查使用临时数据库、随机本地端口和独立 Chrome，不使用日常数据。需要本机安装 Google Chrome；也可将 `UI_BROWSER_CHANNEL` 设置为 Playwright 支持的浏览器通道。设置页连接测试使用固定响应，避免发送 fixture 密钥给外部服务。验证构建产物时运行 `UI_MODE=production npm run test:ui`，此前需完成构建。

Python 与 Node 回归包含实际子进程、超时/重试、Python 写入后 Prisma 读取、行情缺失、资金流事务回滚、密钥状态和 HTTP 响应类型。实时数据源字段另外做只读抽查；测试通过无法保证第三方服务持续可用。
