# 自选模块

管理自选证券、排序与备注。路由、输入校验和业务读写分别位于 `routes.ts`、`schema.ts`、`service.ts`。

## 接口

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/watchlist` | 按 sortOrder、id 升序读取自选和最新行情 |
| POST | `/watchlist` | 新增自选，已有代码返回 duplicate |
| PUT | `/watchlist/:id` | 修改 sortOrder、note |
| DELETE | `/watchlist/:id` | 删除记录 |

新增接受六位 `code`、可选名称、整数排序和可空备注，备注最大 500 字符。排序缺省取当前最大值加一。首次新增返回 201，已有记录返回 200 并带 `duplicate: true`。

## 数据与协作

读写 WatchlistItem、Stock，读取每只证券最新 Quote。名称及已有证券分类复用 stocks 的 `catalog.ts`，名称查询仅用于主数据补充。

新增后执行指定证券行情更新并在 `update` 字段返回结果，重复记录沿用已有自选。行情缺失时价格和涨跌幅为 null，信号标签为空。查询保留备注和排序信息。

## 验证

从根目录运行 `npm test`，重点检查 `watchlist.test.ts`。`npm run test:ui` 覆盖新增、自选备注及行情更新失败提示。模块索引见 [API README](../../../README.md)。
