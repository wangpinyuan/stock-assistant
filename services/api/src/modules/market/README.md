# 市场模块

组合库内市场统计、主要指数和概念板块表现，由 `routes.ts` 注册查询，`service.ts` 组装数据。

## 接口

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/market/breadth` | 涨跌、强弱、涨跌停估算及覆盖情况 |
| GET | `/market/indexes` | 六个主要指数 |
| GET | `/market/sectors` | 最新交易日概念板块涨幅前 20 |
| GET | `/market/overview` | 汇总 breadth、indexes、sectors、sentiment |

## 数据口径

涨跌家数以 Stock 中 assetType 为 stock 的最新公共报价交易日为范围，返回 `scope`、`tradeDate` 和 `missingCount`。强弱以涨跌幅超过正负 3% 计算，均价上涨/下跌当前按现价与开盘价比较。

涨跌停按昨收、证券代码和 ST 名称对应的 5%/10%/20%/30% 规则估算，并按分位四舍五入计算价格。sentiment 按上涨家数与下跌家数关系返回 bull、bear 或 neutral。

指数包括沪深300、中证500、创业板指、恒生指数、纳斯达克和标普500。通过 `lookup_stock.py` 请求外部行情，美股走 Yahoo，其余走新浪，缺失时尝试数据库报价。

板块表现复用 fund-flow 服务的 sector 数据，按最新交易日及涨跌幅降序读取。采集来源为东方财富概念板块，返回日期、涨跌幅、主力净流入。当前 `stockCount` 为 null。

## 验证

从根目录运行 `npm test`，重点检查 `marketBreadth.test.ts`、`marketSectors.test.ts`。页面统一刷新、板块间距和滚动高度由 `npm run test:ui` 覆盖。数据更新接口见 [updates](../updates/README.md)，模块索引见 [API README](../../../README.md)。
