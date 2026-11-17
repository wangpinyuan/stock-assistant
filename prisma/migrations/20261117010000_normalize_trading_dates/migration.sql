-- Legacy local-midnight timestamps are interpreted in Asia/Shanghai.
BEGIN TRANSACTION;
-- Normalize legacy calendar dates to UTC epoch milliseconds.
-- Keep the canonical millisecond record when a legacy row duplicates it.

CREATE TEMP TABLE "normalized_Quote" (id INTEGER PRIMARY KEY, day INTEGER NOT NULL, rank INTEGER NOT NULL);
INSERT INTO "normalized_Quote"
SELECT id, day, ROW_NUMBER() OVER (
  PARTITION BY code, day
  ORDER BY canonical DESC, id DESC
) FROM (
  SELECT *, CASE
    WHEN typeof("tradeDate") IN ('integer', 'real') AND "tradeDate" > 100000000000 THEN CAST(strftime('%s', date("tradeDate" / 1000, 'unixepoch', '+8 hours')) AS INTEGER) * 1000
    WHEN length(CAST("tradeDate" AS TEXT)) = 8 THEN CAST(strftime('%s', substr("tradeDate", 1, 4) || '-' || substr("tradeDate", 5, 2) || '-' || substr("tradeDate", 7, 2)) AS INTEGER) * 1000
    ELSE CAST(strftime('%s', date("tradeDate", '+8 hours')) AS INTEGER) * 1000
  END AS day,
    (typeof("tradeDate") = 'integer' AND "tradeDate" > 100000000000 AND "tradeDate" % 86400000 = 0) AS canonical
  FROM "Quote"
);
DELETE FROM "Quote" WHERE id IN (SELECT id FROM "normalized_Quote" WHERE rank > 1);
UPDATE "Quote" SET "tradeDate" = (SELECT day FROM "normalized_Quote" WHERE id = "Quote".id);
DROP TABLE "normalized_Quote";

CREATE TEMP TABLE "normalized_KlineDaily" (id INTEGER PRIMARY KEY, day INTEGER NOT NULL, rank INTEGER NOT NULL);
INSERT INTO "normalized_KlineDaily"
SELECT id, day, ROW_NUMBER() OVER (
  PARTITION BY code, day
  ORDER BY canonical DESC, id DESC
) FROM (
  SELECT *, CASE
    WHEN typeof("tradeDate") IN ('integer', 'real') AND "tradeDate" > 100000000000 THEN CAST(strftime('%s', date("tradeDate" / 1000, 'unixepoch', '+8 hours')) AS INTEGER) * 1000
    WHEN length(CAST("tradeDate" AS TEXT)) = 8 THEN CAST(strftime('%s', substr("tradeDate", 1, 4) || '-' || substr("tradeDate", 5, 2) || '-' || substr("tradeDate", 7, 2)) AS INTEGER) * 1000
    ELSE CAST(strftime('%s', date("tradeDate", '+8 hours')) AS INTEGER) * 1000
  END AS day,
    (typeof("tradeDate") = 'integer' AND "tradeDate" > 100000000000 AND "tradeDate" % 86400000 = 0) AS canonical
  FROM "KlineDaily"
);
DELETE FROM "KlineDaily" WHERE id IN (SELECT id FROM "normalized_KlineDaily" WHERE rank > 1);
UPDATE "KlineDaily" SET "tradeDate" = (SELECT day FROM "normalized_KlineDaily" WHERE id = "KlineDaily".id);
DROP TABLE "normalized_KlineDaily";

CREATE TEMP TABLE "normalized_KlineWeekly" (id INTEGER PRIMARY KEY, day INTEGER NOT NULL, rank INTEGER NOT NULL);
INSERT INTO "normalized_KlineWeekly"
SELECT id, day, ROW_NUMBER() OVER (
  PARTITION BY code, day
  ORDER BY canonical DESC, id DESC
) FROM (
  SELECT *, CASE
    WHEN typeof("weekDate") IN ('integer', 'real') AND "weekDate" > 100000000000 THEN CAST(strftime('%s', date("weekDate" / 1000, 'unixepoch', '+8 hours')) AS INTEGER) * 1000
    WHEN length(CAST("weekDate" AS TEXT)) = 8 THEN CAST(strftime('%s', substr("weekDate", 1, 4) || '-' || substr("weekDate", 5, 2) || '-' || substr("weekDate", 7, 2)) AS INTEGER) * 1000
    ELSE CAST(strftime('%s', date("weekDate", '+8 hours')) AS INTEGER) * 1000
  END AS day,
    (typeof("weekDate") = 'integer' AND "weekDate" > 100000000000 AND "weekDate" % 86400000 = 0) AS canonical
  FROM "KlineWeekly"
);
DELETE FROM "KlineWeekly" WHERE id IN (SELECT id FROM "normalized_KlineWeekly" WHERE rank > 1);
UPDATE "KlineWeekly" SET "weekDate" = (SELECT day FROM "normalized_KlineWeekly" WHERE id = "KlineWeekly".id);
DROP TABLE "normalized_KlineWeekly";

CREATE TEMP TABLE "normalized_KlineMonthly" (id INTEGER PRIMARY KEY, day INTEGER NOT NULL, rank INTEGER NOT NULL);
INSERT INTO "normalized_KlineMonthly"
SELECT id, day, ROW_NUMBER() OVER (
  PARTITION BY code, day
  ORDER BY canonical DESC, id DESC
) FROM (
  SELECT *, CASE
    WHEN typeof("monthDate") IN ('integer', 'real') AND "monthDate" > 100000000000 THEN CAST(strftime('%s', date("monthDate" / 1000, 'unixepoch', '+8 hours')) AS INTEGER) * 1000
    WHEN length(CAST("monthDate" AS TEXT)) = 8 THEN CAST(strftime('%s', substr("monthDate", 1, 4) || '-' || substr("monthDate", 5, 2) || '-' || substr("monthDate", 7, 2)) AS INTEGER) * 1000
    ELSE CAST(strftime('%s', date("monthDate", '+8 hours')) AS INTEGER) * 1000
  END AS day,
    (typeof("monthDate") = 'integer' AND "monthDate" > 100000000000 AND "monthDate" % 86400000 = 0) AS canonical
  FROM "KlineMonthly"
);
DELETE FROM "KlineMonthly" WHERE id IN (SELECT id FROM "normalized_KlineMonthly" WHERE rank > 1);
UPDATE "KlineMonthly" SET "monthDate" = (SELECT day FROM "normalized_KlineMonthly" WHERE id = "KlineMonthly".id);
DROP TABLE "normalized_KlineMonthly";

CREATE TEMP TABLE "normalized_IntradayQuote" (id INTEGER PRIMARY KEY, day INTEGER NOT NULL, rank INTEGER NOT NULL);
INSERT INTO "normalized_IntradayQuote"
SELECT id, day, ROW_NUMBER() OVER (
  PARTITION BY code, day, time
  ORDER BY canonical DESC, id DESC
) FROM (
  SELECT *, CASE
    WHEN typeof("tradeDate") IN ('integer', 'real') AND "tradeDate" > 100000000000 THEN CAST(strftime('%s', date("tradeDate" / 1000, 'unixepoch', '+8 hours')) AS INTEGER) * 1000
    WHEN length(CAST("tradeDate" AS TEXT)) = 8 THEN CAST(strftime('%s', substr("tradeDate", 1, 4) || '-' || substr("tradeDate", 5, 2) || '-' || substr("tradeDate", 7, 2)) AS INTEGER) * 1000
    ELSE CAST(strftime('%s', date("tradeDate", '+8 hours')) AS INTEGER) * 1000
  END AS day,
    (typeof("tradeDate") = 'integer' AND "tradeDate" > 100000000000 AND "tradeDate" % 86400000 = 0) AS canonical
  FROM "IntradayQuote"
);
DELETE FROM "IntradayQuote" WHERE id IN (SELECT id FROM "normalized_IntradayQuote" WHERE rank > 1);
UPDATE "IntradayQuote" SET "tradeDate" = (SELECT day FROM "normalized_IntradayQuote" WHERE id = "IntradayQuote".id);
DROP TABLE "normalized_IntradayQuote";

COMMIT;
