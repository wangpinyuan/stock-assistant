"""East Money public market snapshots, amounts in CNY and volumes in shares.

Field mapping follows AKShare 1.18.88 stock_fund_em.py and stock_zh_a_spot_em.
"""
from __future__ import annotations
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

STOCKS = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048'
CONCEPTS = 'm:90+t:3'


def fetch_snapshot(scope: str) -> list[dict]:
    rows = {}
    page = 1
    while True:
        params = dict(pn=page, pz=100, po=1, np=1, fltt=2, invt=2, fid='f12', fs=scope,
                      fields='f12,f14,f2,f3,f62,f72,f124,f13')
        request = Request('https://push2.eastmoney.com/api/qt/clist/get?' + urlencode(params),
                          headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'})
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode())
        data = payload.get('data')
        if not isinstance(data, dict) or not isinstance(data.get('diff'), list):
            raise RuntimeError('East Money returned an invalid snapshot')
        batch = data['diff']
        previous_count = len(rows)
        for row in batch:
            rows[str(row['f12'])] = row
        total = int(data['total'])
        if len(rows) >= total:
            if not rows:
                raise RuntimeError('East Money returned an empty snapshot')
            return list(rows.values())
        if len(rows) == previous_count:
            raise RuntimeError('East Money pagination did not advance')
        page += 1
