# Python Worker

API 通过异步子进程调用以下入口，stdout 最后一行为 JSON 结果，日志写 stderr。

- `update_quotes.py --codes 000001,600000 --source sina` 更新指定证券；缺省使用持仓和自选。
- `update_quotes.py --market --source sina` 获取证券列表后更新全市场。
- `update_kline.py --codes 000001 --start 20200101` 获取日线并生成周/月线及均线，需要 Tushare Token。
- `update_fund_flow.py` 获取东方财富分页快照，保存真实主力/大单净流入，单位为元。
- `update_news.py` 获取新浪资讯并按 URL 去重。
- `lookup_stock.py 000001` 查询证券信息；指数使用显式代码，如 `sh000300`。

数据源公开接口可能限流或不可用，失败会返回非零退出码及失败结果。更新通过 API 时，设置页保存的 Tushare Token 优先于环境变量。直接运行 Python 时需自行设置 `TUSHARE_TOKEN` 和可选的 `DATABASE_URL`。

数据库路径与 Prisma 保持一致，默认仓库 `data/stock.db`。交易日以 UTC 零点毫秒编码，成交量为股、成交额和资金流为元。数据库连接启用外键，写入先建立证券父记录。同一资金流更新使用事务，抓取不完整时保留既有数据。

运行回归检查。

```bash
python3 -B -m unittest discover -s services/worker/tests -v
```

完整安装、迁移和启动方式见仓库根目录 README。
