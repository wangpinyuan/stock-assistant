# 共享类型与工具

`@stock-assistant/shared` 供 Web 和 API 共用请求、响应类型、常量及纯工具。包入口为 `src/index.ts`，当前直接导出 TypeScript 源码。

## 文件职责

| 文件 | 内容 |
| --- | --- |
| `src/types/index.ts` | 证券、持仓、自选、组合和技术信号等业务类型 |
| `src/types/contracts.ts` | 设置、持仓、自选请求与信号响应契约 |
| `src/types/market.ts` | 涨跌家数、指数、板块、资金流和 K 线类型 |
| `src/constants/index.ts` | 默认模型名称与指数名称 |
| `src/utils/number.ts` | 数值转换与可空数值转换 |
| `src/utils/validation.ts` | 六位证券代码校验、过滤与金额格式化 |

## 使用方式

```ts
import type { HoldingInput, FundFlowRow } from '@stock-assistant/shared';
import { formatLargeNumber, toNumberOrNull } from '@stock-assistant/shared';
```

`toNumberOrNull` 保留缺失状态，`toNumber` 对空值使用零。根据业务含义选择转换方式。`formatLargeNumber` 按绝对值输出数值及万、亿等单位，调用方负责正负号和“元”后缀。

类型中的 `number | null` 表达数据缺失。行情交易日和资金流日期由 API 输出日期字符串，资讯输出 ISO 时间。部分兼容类型仍允许字符串价格，API 的全局序列化将 Prisma Decimal 转为 number。

新增或修改契约时检查 Web 与 API 调用者。API 构建会内联此包，Web 通过 Next 编译使用该源码。

## 验证

从仓库根目录执行 `npm --workspace packages/shared run typecheck`，跨工作区检查使用 `npm run typecheck`。工具与契约的业务行为由 API 回归及页面回归覆盖。项目运行说明见 [项目 README](../../README.md)。
