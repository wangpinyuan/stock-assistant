# Web 前端

使用 Next.js App Router、React 18、Ant Design 和 lightweight-charts。浏览器通过 `lib/api.ts` 调用 Fastify API。

## 启动与配置

从仓库根目录执行以下命令。

```bash
npm run dev:web
npm --workspace apps/web run build
npm --workspace apps/web run start
```

`scripts/web.mjs` 加载根目录 `.env`，通过 `WEB_PORT` 指定端口，默认 3000。`NEXT_PUBLIC_API_BASE_URL` 默认为 `http://localhost:4000`，生产构建会将其写入客户端代码，修改后重新构建。

## 页面与文件

| 路径或目录 | 职责 |
| --- | --- |
| `app/page.tsx` | 首页持仓、自选与组合汇总 |
| `app/market/page.tsx` | 市场页及顶部统一刷新 |
| `app/stocks/[code]/page.tsx` | 个股详情入口 |
| `app/settings/page.tsx` | 设置保存、配置状态及连接测试 |
| `app/ai/page.tsx` | AI 功能占位说明 |
| `features/market` | 市场概览、资金流、资讯及更新 hook |
| `components` | 持仓、自选、估值和图表组件 |
| `hooks/useApiData.ts` | 请求状态、取消旧请求和数据重载 |
| `lib/api.ts` | 请求地址、HTTP 方法及错误处理 |

## 市场页

顶部刷新同时更新市场行情、资金流和资讯，完成后通过 `refreshVersion` 重载各模块，保留资金流和资讯当前标签。部分来源失败时保留错误提示并重载已更新数据。

MarketOverview 展示涨跌家数、主要指数与概念板块表现。行情每 30 分钟自动更新，统计以数据库中的股票和交易日为范围。板块上方间距为 24px，整卡最大高度 500px，内容可纵向滚动。

FundFlowPanel 展示流入、流出及板块榜单，大单净流入复用 `formatLargeNumber` 显示元、万元、亿元等单位。NewsPanel 展示全部资讯或持仓影响资讯。空缓存会尝试一次初始化更新，失败后可使用顶部按钮重试。

## 组件与数据行为

- 持仓、自选和市场共用 `StockKLineModal`。K 线初始化、数据更新与销毁由 `KLineChart` 管理。
- `useApiData` 通过 AbortController 和请求序号避免旧结果覆盖新结果，接收可选刷新版本。
- `useDataUpdate` 管理更新状态、首次加载和失败提示，可批量执行多个更新来源。
- 价格缺失时展示缺失状态，组合汇总保留 API 返回的覆盖率和交易日信息。
- 设置中的密钥输入框每次加载后留空，界面显示配置状态。留空测试由后端读取已保存配置，保存非空输入会更新密钥。

## 验证

```bash
npm run typecheck
npm run lint
npm run test:ui
```

页面回归从仓库根目录运行，使用临时数据库、随机端口与 Chrome。覆盖持仓编辑、自选、图表、设置、市场统一刷新、部分失败、空缓存加载、金额单位和布局。完整运行说明见 [项目 README](../../README.md)。
