from __future__ import annotations
import os
import io
import contextlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'services/worker'))
sys.path.insert(0, str(ROOT / 'services/worker/scripts'))
from worker import common
import update_fund_flow

class FundFlowTests(unittest.TestCase):
    def test_normalization_uses_provider_amount_and_preserves_missing(self):
        item = update_fund_flow.normalize_flow({'f12': '000001', 'f14': '示例', 'f62': -1200, 'f72': '-', 'f3': 2, 'f124': 1794556800}, 'stock')
        self.assertEqual(item['mainNetInflow'], -1200)
        self.assertIsNone(item['largeOrderNetInflow'])
        self.assertEqual(item['flowDate'], common.date_to_millis('2026-11-13'))

    def test_repeated_writes_are_atomic_and_use_one_stock_level(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'DATABASE_URL': f'file:{directory}/test.db'}):
                with common.connect() as conn:
                    conn.executescript((ROOT / 'prisma/migrations/20260630151412_init/migration.sql').read_text())
                rows = [update_fund_flow.normalize_flow({'f12': '000001', 'f14': '示例', 'f62': -1200, 'f124': 1794556800}, 'stock')]
                update_fund_flow.persist_fund_flow(rows)
                update_fund_flow.persist_fund_flow(rows)
                with common.connect() as conn:
                    self.assertEqual(conn.execute('SELECT level, COUNT(*) FROM FundFlow').fetchall()[0][0], 'stock')
                    self.assertEqual(conn.execute('SELECT COUNT(*) FROM FundFlow').fetchone()[0], 1)
                with self.assertRaises(ValueError):
                    update_fund_flow.persist_fund_flow([dict(rows[0], mainNetInflow=999), dict(rows[0], flowDate='bad')])
                with common.connect() as conn:
                    self.assertEqual(conn.execute('SELECT mainNetInflow FROM FundFlow').fetchone()[0], -1200)

    def test_sector_rename_keeps_one_source_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'DATABASE_URL': f'file:{directory}/test.db'}):
                with common.connect() as conn:
                    conn.executescript((ROOT / 'prisma/migrations/20260630151412_init/migration.sql').read_text())
                original = update_fund_flow.normalize_flow({'f12': 'BK001', 'f14': '旧名称', 'f62': 100, 'f124': 1794556800}, 'sector')
                update_fund_flow.persist_fund_flow([original])
                renamed = update_fund_flow.normalize_flow({'f12': 'BK001', 'f14': '新名称', 'f62': 200, 'f124': 1794556800}, 'sector')
                update_fund_flow.persist_fund_flow([renamed])
                with common.connect() as conn:
                    self.assertEqual(conn.execute('SELECT COUNT(*), name, mainNetInflow FROM FundFlow').fetchone()[:], (1, '新名称', 200))

    def test_failed_fetch_returns_failure_before_any_write(self):
        with patch.object(update_fund_flow, 'fetch_snapshot', side_effect=RuntimeError('upstream failed')), patch.object(update_fund_flow, 'persist_fund_flow') as persist, contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(update_fund_flow.main(), 1)
            self.assertIn('upstream failed', output.getvalue())
            persist.assert_not_called()

if __name__ == '__main__':
    unittest.main()
