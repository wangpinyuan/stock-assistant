-- The legacy Python writer used local datetime text (Asia/Shanghai).
-- Explicit-offset ISO strings and canonical epoch milliseconds keep their instant.
BEGIN TRANSACTION;
CREATE TEMP TABLE normalized_news_dates (id INTEGER PRIMARY KEY, instant INTEGER NOT NULL);
INSERT INTO normalized_news_dates
SELECT id, CASE
  WHEN typeof(publishDate) IN ('integer', 'real') THEN CAST(publishDate AS INTEGER)
  WHEN length(publishDate) = 19 AND substr(publishDate, 11, 1) = ' '
    THEN CAST(strftime('%s', publishDate, '-8 hours') AS INTEGER) * 1000
  ELSE CAST(strftime('%s', publishDate) AS INTEGER) * 1000
END FROM NewsItem;
UPDATE NewsItem SET publishDate = (SELECT instant FROM normalized_news_dates WHERE id = NewsItem.id);
DROP TABLE normalized_news_dates;
COMMIT;
