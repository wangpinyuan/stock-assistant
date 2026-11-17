# 持仓模块

管理持仓记录与列表估值。`routes.ts` 处理 HTTP，`schema.ts` 校验输入，`service.ts` 处理读写，`valuation.ts` 为持仓和组合提供共同估值逻辑。

## 接口

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/holdings` | 持仓及最新行情估值列表 |
| GET | `/holdings/:id` | 单条持仓，缺失返回 404 |
| POST | `/holdings` | 新增，返回 201 及行情更新结果 |
| PUT | `/holdings/:id` | 修改数量、成本、买入日期、标签或备注 |
| DELETE | `/holdings/:id` | 删除持仓 |

新增要求六位证券代码、正数量和非负成本。`assetType` 支持 stock/etf，`buyDate` 使用 `YYYY-MM-DD`，标签与备注可空。更新 schema 接受部分持仓输入，当前 service 实际写入上述五类可编辑信息。

## 数据与协作

读写 Holding、Stock、Quote。新增时复用 stocks 的 `catalog.ts` 查名称与建立主数据，证券及持仓写入同一事务。资产类型优先使用显式输入，其次沿用已有 ETF 分类，缺省为 stock。

创建记录后运行 `update_quotes.py --codes <code>`，结果通过 `update` 字段返回。记录已创建而行情更新失败时，客户端可据此提示并重试行情更新。

估值使用每只证券最新一条报价。价格缺失时市值和总盈亏为 null，涨跌额缺失时当日盈亏为 null。持仓权重在全部市值可用时计算，收益率分母为零时返回 null。

## 验证

从根目录运行 `npm test`。重点回归为 `valuation.test.ts`、`securityService.test.ts` 和 `contracts.test.ts`，页面编辑与汇总由 `npm run test:ui` 覆盖。模块索引见 [API README](../../../README.md)。
