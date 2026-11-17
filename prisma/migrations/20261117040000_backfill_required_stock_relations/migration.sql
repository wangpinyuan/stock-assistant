-- The old Python connection did not enforce foreign keys. Preserve observations
-- while creating missing master records; existing user metadata wins.
BEGIN TRANSACTION;
INSERT OR IGNORE INTO Stock (code, name, assetType, updatedAt)
SELECT code, name, assetType, CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM Holding;
INSERT OR IGNORE INTO Stock (code, name, updatedAt)
SELECT code, name, CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM WatchlistItem;
INSERT OR IGNORE INTO Stock (code, name, updatedAt)
SELECT code, code, CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM (
  SELECT code FROM Quote
  UNION SELECT code FROM KlineDaily
  UNION SELECT code FROM KlineWeekly
  UNION SELECT code FROM KlineMonthly
  UNION SELECT code FROM IntradayQuote
);
COMMIT;
