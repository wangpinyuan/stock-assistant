"""Refresh provider-reported stock and concept fund flows in CNY."""
from __future__ import annotations
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))
from worker import common
from worker.providers.eastmoney import fetch_snapshot, STOCKS, CONCEPTS


def normalize_flow(row: dict, level: str) -> dict:
    timestamp = common.to_decimal(row.get('f124'))
    if timestamp is None:
        raise ValueError('Fund flow snapshot is missing its source timestamp')
    date = datetime.fromtimestamp(timestamp, timezone(timedelta(hours=8))).strftime('%Y-%m-%d')
    return dict(level=level, code=str(row['f12']) if level == 'stock' else None,
                name=row.get('f14'), flowDate=common.date_to_millis(date),
                mainNetInflow=common.to_decimal(row.get('f62')),
                largeOrderNetInflow=common.to_decimal(row.get('f72')),
                changePercent=common.to_decimal(row.get('f3')),
                rawJson=json.dumps({'source': 'eastmoney', 'unit': 'CNY', 'record': row}, ensure_ascii=False))


def persist_fund_flow(records: list[dict]) -> dict:
    summary = {'stock': 0, 'sector': 0}
    with common.connect() as conn:
        for row in records:
            date = common.date_to_millis(row['flowDate'])
            if row['level'] == 'stock':
                common.ensure_stock(conn, row['code'], row.get('name'))
            if row['level'] == 'stock':
                conn.execute('DELETE FROM FundFlow WHERE level = ? AND flowDate = ? AND code = ?',
                             (row['level'], date, row['code']))
            else:
                conn.execute("DELETE FROM FundFlow WHERE level = ? AND flowDate = ? AND json_extract(CASE WHEN json_valid(rawJson) THEN rawJson ELSE '{}' END, '$.record.f12') = ?",
                             (row['level'], date, json.loads(row['rawJson'])['record']['f12']))
            conn.execute('''INSERT INTO FundFlow
                (level, code, name, flowDate, mainNetInflow, largeOrderNetInflow, changePercent, rawJson)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                         (row['level'], row['code'], row['name'], date, row['mainNetInflow'],
                          row['largeOrderNetInflow'], row['changePercent'], row['rawJson']))
            summary[row['level']] += 1
    return summary


def main() -> int:
    try:
        stocks = [normalize_flow(row, 'stock') for row in fetch_snapshot(STOCKS)]
        sectors = [normalize_flow(row, 'sector') for row in fetch_snapshot(CONCEPTS)]
        summary = persist_fund_flow(stocks + sectors)
        print(json.dumps({'ok': True, **summary}))
        return 0
    except Exception as exc:
        common.log(f'Fund flow update failed: {exc}')
        print(json.dumps({'ok': False, 'error': str(exc)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
