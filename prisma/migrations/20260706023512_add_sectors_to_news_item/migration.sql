-- AlterTable
ALTER TABLE "NewsItem" ADD COLUMN "sectors" TEXT;

-- CreateIndex
CREATE INDEX "NewsItem_sectors_idx" ON "NewsItem"("sectors");
