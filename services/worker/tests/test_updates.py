from __future__ import annotations
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'services/worker'))
sys.path.insert(0, str(ROOT / 'services/worker/scripts'))
from worker import common
import update_news
import update_kline

class UpdateTests(unittest.TestCase):
    def test_repeated_news_is_successful_and_does_not_duplicate(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'DATABASE_URL': f'file:{directory}/test.db'}):
                with common.connect() as conn:
                    conn.executescript((ROOT / 'prisma/migrations/20260630151412_init/migration.sql').read_text())
                item = dict(type='资讯', code='000001', title='测试新闻', source='test', publishDate=1794528000000, url='https://example.com/news', summary='测试')
                self.assertEqual(update_news.persist_news([item])['inserted'], 1)
                with patch.object(update_news, 'fetch_sina_news', return_value=[item]), contextlib.redirect_stdout(io.StringIO()) as output:
                    self.assertEqual(update_news.main(), 0)
                self.assertTrue(json.loads(output.getvalue().splitlines()[-1])['ok'])
                with common.connect() as conn:
                    self.assertEqual(conn.execute('SELECT COUNT(*) FROM NewsItem').fetchone()[0], 1)

    def test_kline_provider_failure_has_nonzero_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'DATABASE_URL': f'file:{directory}/test.db'}), patch.object(sys, 'argv', ['update_kline.py', '--codes', '000001']), patch.object(update_kline, 'fetch_tushare_daily', side_effect=RuntimeError('provider offline')), contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(update_kline.main(), 1)
                self.assertFalse(json.loads(output.getvalue().splitlines()[-1])['ok'])

if __name__ == '__main__':
    unittest.main()
