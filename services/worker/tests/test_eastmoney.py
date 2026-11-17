from __future__ import annotations
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'services/worker'))
from worker.providers import eastmoney

class SnapshotTests(unittest.TestCase):
    def test_pagination_collects_complete_universe(self):
        pages = [dict(data=dict(total=3, diff=[{'f12': '000001'}, {'f12': '600000'}])), dict(data=dict(total=3, diff=[{'f12': '920001'}]))]
        with patch.object(eastmoney, 'urlopen', side_effect=[io.BytesIO(json.dumps(page).encode()) for page in pages]):
            self.assertEqual(len(eastmoney.fetch_snapshot(eastmoney.STOCKS)), 3)

    def test_repeated_page_fails_instead_of_silently_losing_rows(self):
        page = json.dumps(dict(data=dict(total=3, diff=[{'f12': '000001'}]))).encode()
        with patch.object(eastmoney, 'urlopen', side_effect=[io.BytesIO(page), io.BytesIO(page)]):
            with self.assertRaisesRegex(RuntimeError, 'did not advance'):
                eastmoney.fetch_snapshot(eastmoney.STOCKS)

if __name__ == '__main__':
    unittest.main()
