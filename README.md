# Stock Assistant

本项目是一个本地优先的 A 股股票研究工作台，用于管理持仓、自选股、市场数据、资金流、资讯和 Claude AI 辅助分析。

> 示例数据仅用于演示页面效果，不构成投资建议。

## 功能范围

- 投资组合总览
- 持仓管理
- 自选股列表
- 个股详情
- 市场概览
- 资金流分析
- 资讯、公告、财报、研报
- Claude AI 分析
- 本地 SQLite 数据库

## 技术栈

- Monorepo: npm workspaces
- Web: Next.js, Ant Design, ECharts, TradingView Lightweight Charts
- API: Fastify, Prisma, SQLite
- Worker: Python, AKShare, Tushare
- AI: Claude API via `@anthropic-ai/sdk`

## 目录结构

```text
apps/web              Next.js 前端
services/api          Fastify API 服务
services/worker       Python 数据脚本
packages/shared       共享类型和常量
prisma                Prisma schema 和 seed
data                  本地 SQLite 数据目录
```

## 本地启动

### 0. Node 版本

建议使用 Node 20：

```bash
nvm install 20
nvm use 20
```

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

按需填写：

```env
TUSHARE_TOKEN=""
ANTHROPIC_API_KEY=""
```

### 3. 初始化数据库

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
```

### 4. 启动服务

```bash
npm run dev
```

默认地址：

```text
Web: http://localhost:3000
API: http://localhost:4000
```

## Python worker

```bash
cd services/worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

第一版脚本会先提供占位入口，后续接入 AKShare / Tushare 数据更新。

## 安全说明

不要提交以下内容：

- `.env`
- Claude API Key
- Tushare Token
- SQLite 数据库
- 个人真实持仓
- AI 分析历史
- 本地缓存

## MVP 开发顺序

1. 项目骨架、Prisma schema、示例数据
2. Fastify API 和 Next.js 基础页面
3. 持仓录入、组合总览、行情更新
4. 自选股、个股详情、K 线和技术指标
5. 市场、资金流、资讯
6. Claude AI 分析和报告历史
