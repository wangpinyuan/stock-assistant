# 资讯模块

查询资讯、类型和持仓影响，`service.ts` 同时供 stocks 模块复用个股资讯查询。

## 接口

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/news` | 按发布时间降序，默认最多 100 条 |
| GET | `/news?type=财经&limit=50` | 类型筛选，limit 支持 1 至 500 |
| GET | `/news/types` | 已有资讯类型 |
| GET | `/news/holdings-impact` | 当前持仓相关且已标记影响的资讯，最多 50 条 |
| GET | `/news/stocks/:code` | 指定证券资讯，最多 50 条 |

## 数据与采集

读取 NewsItem，持仓影响查询同时读取 Holding 的证券代码。输出的 publishDate 为 ISO 时间，其他字段包含标题、来源、URL、摘要及已有情绪/影响标记。

更新由 `update_news.py` 从新浪获取最近 50 条内容，按 URL 去重，跳过缺少标题或发布时间的内容。证券代码从 URL 中提取。当前采集默认写入 neutral 情绪和 false 影响标记，因此持仓影响标签可能为空。

市场页当前展示标题、类型、来源和发布时间。旧文本资讯时间由迁移归一化，以支持新旧数据统一排序。

## 验证

从根目录运行 `npm test`、`npm run test:worker`，重点检查 `newsMigration.test.ts` 和 `test_updates.py`。`npm run test:ui` 覆盖资讯标签、首次加载、统一刷新与重试。模块索引见 [API README](../../../README.md)。
