# 数据更新模块

将 HTTP 更新请求转换为 Worker 调用。当前逻辑位于 `routes.ts`，公共进程管理由 `infrastructure/workerRunner.ts` 提供。

## 接口

| 方法 | 路径 | 执行内容 |
| --- | --- | --- |
| POST | `/update/quotes` | 指定证券或缺省持仓、自选行情 |
| POST | `/update/market` | 带 --market 的全市场行情 |
| POST | `/update/kline` | 日、周、月 K 线 |
| POST | `/update/fund-flow` | 个股和概念板块资金流 |
| POST | `/update/news` | 新浪资讯 |
| POST | `/update/holdings` | 行情更新入口别名 |
| POST | `/update/watchlist` | 行情更新入口别名 |
| POST | `/update/all` | 依次执行 quotes、kline、fund-flow、news |

## 参数与结果

请求体接受可选 codes 数组与 source，codes 为非空六位代码数组，source 支持 sina、akshare、tushare。行情与 K 线步骤使用 codes，行情步骤使用 source。缺省行情来源为 sina，K 线使用 Tushare。

holdings/watchlist 别名沿用 quotes 的缺省目标逻辑，即持仓和自选代码并集。market 的新浪与 AKShare 分支按全市场采集，Tushare 分支按显式 codes 逐只抓取。

K 线超时为 300 秒，其他更新入口为 120 秒。单项响应返回 Worker 的 ok、exitCode、durationMs、stdout、stderr、parsed 和可选 error。失败使用 HTTP 502。

all 按顺序尝试全部步骤，汇总在 steps 中，资金流结果键为 fundFlow。任一步失败时整体 ok 为 false，其他步骤仍继续。市场页顶部刷新分别调用 market、fund-flow、news，完成后重取各模块数据。

同一 Worker 脚本、参数和运行配置的并发调用共享进程。子进程异常、超时、非零退出码或 JSON 中的失败状态都会反映在响应中。

## 验证

从根目录运行 `npm test`，重点检查 `updateRoutes.test.ts` 和 `workerRunner.test.ts`，覆盖参数、部分失败、超时及并发合并。脚本参数和来源见 [Worker README](../../../../worker/README.md)，模块索引见 [API README](../../../README.md)。
