# 证券模块

提供证券主数据、报价、K 线及技术信号。`catalog.ts` 供持仓、自选复用证券名称查询和主数据建立。

## 接口

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/stocks/:code` | Stock 记录，缺失返回 404 |
| GET | `/stocks/:code/quote` | 最新 Quote，缺失返回 404 |
| GET | `/stocks/:code/kline?period=daily` | 对应周期的时间升序序列 |
| GET | `/stocks/:code/fund-flow` | 复用资金流服务 |
| GET | `/stocks/:code/news` | 复用资讯服务 |
| GET | `/stocks/:code/analysis-signals` | 基于日线计算技术信号 |

证券代码校验支持六位数字、sh/sz 加六位数字、hkHSI、usixic、usspx。K 线周期支持 daily、weekly、monthly、intraday，默认 daily，无效周期返回 400。

## 数据与协作

`service.ts` 读取 Stock、Quote、KlineDaily、KlineWeekly、KlineMonthly 和 IntradayQuote。K 线查询读取已有数据，采集由 updates 模块调度 Worker 完成。当前 Worker 更新日、周、月线。

技术信号包含 MA5/10/20 排列、收盘价偏离 MA20、连续涨跌和最近 5 日与此前 20 日成交量对比。少于 5 条日线时信号为空，summary 为 null。

`catalog.ts` 通过 `lookup_stock.py` 查询名称，已有有效名称优先保留，未知名称可暂用证券代码。`ensureStock` 支持事务客户端，名称占位可由查询结果补全。

## 验证

从根目录运行 `npm test`，重点检查 `securityService.test.ts`、`contracts.test.ts`、`workerStorage.test.ts`。`npm run test:ui` 覆盖个股详情和 K 线弹窗生命周期。模块索引见 [API README](../../../README.md)。
