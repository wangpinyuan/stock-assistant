# 资金流模块

查询 FundFlow 中的资金流记录，`service.ts` 统一转换数值与交易日。采集由 Worker 的 `update_fund_flow.py` 完成。

## 接口

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/fund-flow/inflows` | 最新个股交易日主力净流入前 10，仅正值 |
| GET | `/fund-flow/outflows` | 最新个股交易日主力净流出前 10，仅负值 |
| GET | `/fund-flow/sectors` | 最新板块交易日按主力净流入降序前 20 |
| GET | `/fund-flow/stocks/:code` | 指定证券最近 30 条个股记录 |
| GET | `/fund-flow/portfolio` | 最新个股交易日中的持仓资金流，最多 20 条 |
| GET | `/fund-flow/watchlist` | 最新个股交易日中的自选资金流，最多 20 条 |
| GET | `/fund-flow/market` | level 为 market 的最近 20 条记录 |

## 数据口径

当前采集器写入 stock 和 sector，来源为东方财富，sector 对应概念板块。所有净流入金额以人民币元存储，API 保留原始数值，前端负责万、亿等展示单位转换。

榜单先确定对应 level 的最新日期，再排序取数。持仓、自选无代码时返回空数组。个股历史接口按日期降序读取。市场板块涨幅榜复用 `getSectorFundFlow`，指定按 changePercent 排序。

历史来源未知数据迁移为 `legacy_*`，当前查询按精确 level 选择记录。market 查询接口保留，当前采集器仅覆盖上述两个 level。

## 验证

从根目录运行 `npm test` 和 `npm run test:worker`，重点检查 `fundFlowService.test.ts`、`marketSectors.test.ts`、`test_fund_flow.py`。更新调度见 [updates](../updates/README.md)，模块索引见 [API README](../../../README.md)。
