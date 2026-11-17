# 组合模块

汇总所有持仓的估值、收益及行情覆盖情况。`service.ts` 复用 holdings 的 `loadValuedHoldings`。

## 接口

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/portfolio/summary` | 当前组合估值与覆盖情况 |
| GET | `/portfolio/snapshots` | 返回 501，组合快照尚未实现 |

## 汇总口径

- `knownMarketValue` 汇总已有价格的持仓市值。
- `totalMarketValue`、`totalProfit` 在全部持仓市值可用时返回数值。
- `todayProfit` 需要全部持仓的行情完整且交易日一致，并具备涨跌额与昨收。
- `missingQuoteCount`、`quoteCoverage` 表示市值可用情况，`mixedQuoteDates` 表示日期混用。
- `updatedAt` 是参与汇总的最新报价交易日。
- 股票、ETF 数量按持仓记录关联的证券分类统计。

收益率使用对应成本或昨日市值作为分母，分母为零时返回 null。数据来自当前 Holding、Stock 和每只证券最新 Quote，当前收益计算基于数量与平均成本。

## 验证

从根目录运行 `npm test`，估值和汇总回归位于 `valuation.test.ts`，覆盖正常、缺失报价、零成本及混合交易日。首页汇总交互由 `npm run test:ui` 覆盖。模块索引见 [API README](../../../README.md)。
