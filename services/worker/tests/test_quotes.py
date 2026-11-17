from __future__ import annotations
import os
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'services/worker'))
sys.path.insert(0, str(ROOT / 'services/worker/scripts'))
from worker import common
import update_quotes
import lookup_stock

class QuoteTests(unittest.TestCase):
    def test_stock_and_exchange_prefixes_are_unambiguous(self):
        for code, prefix in [('000001', 'sz'), ('001001', 'sz'), ('002001', 'sz'), ('600000', 'sh'), ('300001', 'sz'), ('920001', 'bj'), ('830001', 'bj')]:
            self.assertEqual(lookup_stock.get_market_prefix(code), prefix)

    def test_snapshot_before_open_uses_prior_session(self):
        days = ['2026-11-13', '2026-11-16']
        self.assertEqual(common.snapshot_trade_date(days, datetime(2026, 11, 16, 1, 0, tzinfo=timezone.utc)), '2026-11-13')
        self.assertEqual(common.snapshot_trade_date(days, datetime(2026, 11, 16, 2, 0, tzinfo=timezone.utc)), '2026-11-16')

    def test_tushare_selects_etf_index_and_beijing_endpoints(self):
        calls = []
        def endpoint(kind):
            return lambda **kwargs: calls.append((kind, kwargs))
        pro = SimpleNamespace(daily=endpoint('stock'), fund_daily=endpoint('etf'), index_daily=endpoint('index'))
        for code in ['513130', '920001', 'sh000300']:
            common.fetch_daily_bars(pro, code, trade_date='20261113')
        self.assertEqual([row[0] for row in calls], ['etf', 'stock', 'index'])
        self.assertEqual([row[1]['ts_code'] for row in calls], ['513130.SH', '920001.BJ', '000300.SH'])

    def test_record_filter_accepts_data_rows(self):
        rows = [{'code': '000001'}, {'code': '600000'}]
        self.assertEqual(common.filter_codes(rows, ['000001']), rows[:1])
        self.assertEqual(common.filter_codes(rows, []), [])

    def test_nonfinite_values_are_missing(self):
        self.assertIsNone(common.to_decimal(float('nan')))
        self.assertIsNone(common.to_decimal(float('inf')))

    def test_tushare_units_and_source_date(self):
        class Frame:
            empty = False
            def iterrows(self):
                return iter([(0, dict(ts_code='000001.SZ', trade_date='20260703', close=10, vol=2, amount=3))])
        pro = SimpleNamespace(daily=lambda **kwargs: Frame())
        module = SimpleNamespace(pro_api=lambda token: pro)
        with patch.dict(sys.modules, {'tushare': module}), patch.dict(os.environ, {'TUSHARE_TOKEN': 'test'}):
            result = update_quotes.fetch_tushare_daily(['000001'], '20260703')[0]
        self.assertEqual(result['tradeDate'], '20260703')
        self.assertEqual(result['volume'], 200)
        self.assertEqual(result['turnover'], 3000)

    def test_akshare_units_and_last_calendar_session(self):
        frame = SimpleNamespace(to_dict=lambda **kwargs: [dict(代码='000001', 名称='示例', 最新价=10, 成交量=2, 成交额=3)])
        module = SimpleNamespace(tool_trade_date_hist_sina=lambda: {'trade_date': ['2000-01-03']}, stock_zh_a_spot_em=lambda: frame)
        with patch.dict(sys.modules, {'akshare': module}):
            result = update_quotes.fetch_akshare_spot()[0]
        self.assertEqual(result['tradeDate'], '2000-01-03')
        self.assertEqual(result['volume'], 200)
        self.assertEqual(result['turnover'], 3)

    def test_persist_uses_provider_trade_date(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'DATABASE_URL': f'file:{directory}/test.db'}):
                with common.connect() as conn:
                    conn.executescript((ROOT / 'prisma/migrations/20260630151412_init/migration.sql').read_text())
                result = update_quotes.persist([dict(code='000001', currentPrice=10, tradeDate='20260703')])
                self.assertEqual(result['updated'], 1)
                with common.connect() as conn:
                    self.assertEqual(conn.execute('SELECT tradeDate FROM Quote').fetchone()[0], common.date_to_millis('20260703'))

if __name__ == '__main__':
    unittest.main()
