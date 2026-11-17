from __future__ import annotations
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'services/worker'))
sys.path.insert(0, str(ROOT / 'services/worker/scripts'))
from worker import common
import update_kline

class StorageTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(':memory:')
        self.conn.execute('PRAGMA foreign_keys = ON')
        self.conn.executescript((ROOT / 'prisma/migrations/20260630151412_init/migration.sql').read_text())

    def tearDown(self):
        self.conn.close()

    def test_weekly_monthly_write_matches_migration(self):
        payload = dict(code='000001', open=1, high=2, low=1, close=2, volume=100)
        for fn, key, table in [(update_kline.upsert_weekly, 'weekDate', 'KlineWeekly'), (update_kline.upsert_monthly, 'monthDate', 'KlineMonthly')]:
            row = dict(payload, **{key: 1794528000000})
            fn(self.conn, row)
            fn(self.conn, row)
            self.assertEqual(self.conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0], 1)

    def test_daily_ma_uses_chronological_prices(self):
        rows = [dict(trade_date=f'202611{day:02d}', open=day, high=day, low=day, close=day, vol=100) for day in range(6, 0, -1)]
        with patch.object(update_kline, 'fetch_tushare_daily', return_value=rows):
            result = update_kline.process_daily(self.conn, '000001', '20261101', '20261106')
        self.assertEqual(result['updated'], 6)
        values = self.conn.execute('SELECT close, ma5 FROM KlineDaily ORDER BY tradeDate').fetchall()
        self.assertEqual(values[-1], (6, 4))
        self.assertIsNone(values[0][1])

    def test_dates_use_utc_milliseconds(self):
        self.assertEqual(common.date_to_millis('20261113'), 1794528000000)
        self.assertEqual(common.date_to_millis('2026-11-13'), 1794528000000)
        self.assertEqual(common.date_to_millis(1794528000000), 1794528000000)

    def test_quote_creates_parent_and_updates_idempotently(self):
        payload = dict(code='000001', name='示例证券', tradeDate='20261113', currentPrice=10)
        common.upsert_quote(self.conn, payload)
        common.upsert_quote(self.conn, dict(payload, currentPrice=11))
        self.assertEqual(self.conn.execute('SELECT name FROM Stock').fetchone()[0], '示例证券')
        self.assertEqual(self.conn.execute('SELECT COUNT(*), currentPrice FROM Quote').fetchone(), (1, 11))
        self.assertEqual(self.conn.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_legacy_date_migration_merges_same_trading_day(self):
        common.ensure_stock(self.conn, '000001')
        for date, price in [('2026-11-13', 1), ('20261113', 2), (1794528000000, 3)]:
            self.conn.execute('INSERT INTO Quote (code, tradeDate, currentPrice) VALUES (?, ?, ?)', ('000001', date, price))
        migration = (ROOT / 'prisma/migrations/20261117010000_normalize_trading_dates/migration.sql').read_text()
        self.conn.executescript(migration)
        self.assertEqual(self.conn.execute('SELECT tradeDate, currentPrice FROM Quote').fetchall(), [(1794528000000, 3)])
        self.conn.executescript(migration)
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM Quote').fetchone()[0], 1)

    def test_legacy_shanghai_midnight_merges_with_canonical_day(self):
        common.ensure_stock(self.conn, '000001')
        self.conn.execute('INSERT INTO Quote (code, tradeDate, currentPrice) VALUES (?, ?, ?)', ('000001', 1794499200000, 1))
        self.conn.execute('INSERT INTO Quote (code, tradeDate, currentPrice) VALUES (?, ?, ?)', ('000001', 1794528000000, 2))
        migration = (ROOT / 'prisma/migrations/20261117010000_normalize_trading_dates/migration.sql').read_text()
        self.conn.executescript(migration)
        self.assertEqual(self.conn.execute('SELECT tradeDate, currentPrice FROM Quote').fetchall(), [(1794528000000, 2)])

    def test_legacy_observations_keep_values_and_gain_missing_parent(self):
        self.conn.execute('PRAGMA foreign_keys = OFF')
        self.conn.execute('INSERT INTO Quote (code, tradeDate, currentPrice) VALUES (?, ?, ?)', ('000905', 1794528000000, 10))
        self.conn.commit()
        self.conn.execute('PRAGMA foreign_keys = ON')
        migration = (ROOT / 'prisma/migrations/20261117040000_backfill_required_stock_relations/migration.sql').read_text()
        self.conn.executescript(migration)
        self.assertEqual(self.conn.execute('PRAGMA foreign_key_check').fetchall(), [])
        self.assertEqual(self.conn.execute('SELECT currentPrice FROM Quote').fetchone()[0], 10)
        self.conn.executescript(migration)
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM Stock').fetchone()[0], 1)

    def test_default_database_is_project_data(self):
        with patch.dict(os.environ, {'DATABASE_URL': ''}):
            self.assertEqual(common.resolve_db_path(), ROOT / 'data/stock.db')

    def test_connection_enforces_foreign_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'DATABASE_URL': f'file:{directory}/test.db'}):
                with common.connect() as conn:
                    self.assertEqual(conn.execute('PRAGMA foreign_keys').fetchone()[0], 1)

if __name__ == '__main__':
    unittest.main()
