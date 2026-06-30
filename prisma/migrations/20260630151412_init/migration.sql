-- CreateTable
CREATE TABLE "Stock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" TEXT,
    "industry" TEXT,
    "sector" TEXT,
    "assetType" TEXT NOT NULL DEFAULT 'stock',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "averageCost" DECIMAL NOT NULL,
    "buyDate" DATETIME,
    "tags" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Holding_code_fkey" FOREIGN KEY ("code") REFERENCES "Stock" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchlistItem_code_fkey" FOREIGN KEY ("code") REFERENCES "Stock" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "currentPrice" DECIMAL NOT NULL,
    "open" DECIMAL,
    "high" DECIMAL,
    "low" DECIMAL,
    "close" DECIMAL,
    "preClose" DECIMAL,
    "changeAmount" DECIMAL,
    "changePercent" DECIMAL,
    "volume" DECIMAL,
    "turnover" DECIMAL,
    "turnoverRate" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_code_fkey" FOREIGN KEY ("code") REFERENCES "Stock" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KlineDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "open" DECIMAL NOT NULL,
    "high" DECIMAL NOT NULL,
    "low" DECIMAL NOT NULL,
    "close" DECIMAL NOT NULL,
    "volume" DECIMAL,
    "turnover" DECIMAL,
    "ma5" DECIMAL,
    "ma10" DECIMAL,
    "ma20" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KlineDaily_code_fkey" FOREIGN KEY ("code") REFERENCES "Stock" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KlineWeekly" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "weekDate" DATETIME NOT NULL,
    "open" DECIMAL NOT NULL,
    "high" DECIMAL NOT NULL,
    "low" DECIMAL NOT NULL,
    "close" DECIMAL NOT NULL,
    "volume" DECIMAL,
    "ma5" DECIMAL,
    "ma10" DECIMAL,
    "ma20" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KlineWeekly_code_fkey" FOREIGN KEY ("code") REFERENCES "Stock" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KlineMonthly" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "monthDate" DATETIME NOT NULL,
    "open" DECIMAL NOT NULL,
    "high" DECIMAL NOT NULL,
    "low" DECIMAL NOT NULL,
    "close" DECIMAL NOT NULL,
    "volume" DECIMAL,
    "ma5" DECIMAL,
    "ma10" DECIMAL,
    "ma20" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KlineMonthly_code_fkey" FOREIGN KEY ("code") REFERENCES "Stock" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntradayQuote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "time" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "volume" DECIMAL,
    "amount" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntradayQuote_code_fkey" FOREIGN KEY ("code") REFERENCES "Stock" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshotDate" DATETIME NOT NULL,
    "totalMarketValue" DECIMAL NOT NULL,
    "todayProfit" DECIMAL NOT NULL,
    "todayProfitRate" DECIMAL NOT NULL,
    "totalProfit" DECIMAL NOT NULL,
    "totalProfitRate" DECIMAL NOT NULL,
    "stockWeight" DECIMAL,
    "etfWeight" DECIMAL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FundFlow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT,
    "flowDate" DATETIME NOT NULL,
    "mainNetInflow" DECIMAL,
    "largeOrderNetInflow" DECIMAL,
    "changePercent" DECIMAL,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FundFlow_code_fkey" FOREIGN KEY ("code") REFERENCES "Stock" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "publishDate" DATETIME NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "impactOnHolding" BOOLEAN NOT NULL DEFAULT false,
    "impactSummary" TEXT,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsItem_code_fkey" FOREIGN KEY ("code") REFERENCES "Stock" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "targetCode" TEXT,
    "reportDate" DATETIME NOT NULL,
    "model" TEXT NOT NULL,
    "inputSnapshot" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "riskLevel" TEXT,
    "sentiment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiReport_targetCode_fkey" FOREIGN KEY ("targetCode") REFERENCES "Stock" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Stock_code_key" ON "Stock"("code");

-- CreateIndex
CREATE INDEX "Stock_assetType_idx" ON "Stock"("assetType");

-- CreateIndex
CREATE INDEX "Stock_industry_idx" ON "Stock"("industry");

-- CreateIndex
CREATE INDEX "Stock_sector_idx" ON "Stock"("sector");

-- CreateIndex
CREATE INDEX "Holding_code_idx" ON "Holding"("code");

-- CreateIndex
CREATE INDEX "Holding_assetType_idx" ON "Holding"("assetType");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_code_key" ON "WatchlistItem"("code");

-- CreateIndex
CREATE INDEX "WatchlistItem_sortOrder_idx" ON "WatchlistItem"("sortOrder");

-- CreateIndex
CREATE INDEX "Quote_tradeDate_idx" ON "Quote"("tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_code_tradeDate_key" ON "Quote"("code", "tradeDate");

-- CreateIndex
CREATE INDEX "KlineDaily_tradeDate_idx" ON "KlineDaily"("tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "KlineDaily_code_tradeDate_key" ON "KlineDaily"("code", "tradeDate");

-- CreateIndex
CREATE INDEX "KlineWeekly_weekDate_idx" ON "KlineWeekly"("weekDate");

-- CreateIndex
CREATE UNIQUE INDEX "KlineWeekly_code_weekDate_key" ON "KlineWeekly"("code", "weekDate");

-- CreateIndex
CREATE INDEX "KlineMonthly_monthDate_idx" ON "KlineMonthly"("monthDate");

-- CreateIndex
CREATE UNIQUE INDEX "KlineMonthly_code_monthDate_key" ON "KlineMonthly"("code", "monthDate");

-- CreateIndex
CREATE INDEX "IntradayQuote_tradeDate_idx" ON "IntradayQuote"("tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "IntradayQuote_code_tradeDate_time_key" ON "IntradayQuote"("code", "tradeDate", "time");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioSnapshot_snapshotDate_key" ON "PortfolioSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_snapshotDate_idx" ON "PortfolioSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "FundFlow_level_idx" ON "FundFlow"("level");

-- CreateIndex
CREATE INDEX "FundFlow_code_idx" ON "FundFlow"("code");

-- CreateIndex
CREATE INDEX "FundFlow_flowDate_idx" ON "FundFlow"("flowDate");

-- CreateIndex
CREATE INDEX "NewsItem_type_idx" ON "NewsItem"("type");

-- CreateIndex
CREATE INDEX "NewsItem_code_idx" ON "NewsItem"("code");

-- CreateIndex
CREATE INDEX "NewsItem_publishDate_idx" ON "NewsItem"("publishDate");

-- CreateIndex
CREATE INDEX "NewsItem_sentiment_idx" ON "NewsItem"("sentiment");

-- CreateIndex
CREATE INDEX "NewsItem_impactOnHolding_idx" ON "NewsItem"("impactOnHolding");

-- CreateIndex
CREATE INDEX "AiReport_type_idx" ON "AiReport"("type");

-- CreateIndex
CREATE INDEX "AiReport_targetCode_idx" ON "AiReport"("targetCode");

-- CreateIndex
CREATE INDEX "AiReport_reportDate_idx" ON "AiReport"("reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
