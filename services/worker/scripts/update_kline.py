"""Refresh K-line (daily/weekly/monthly) for target stocks.

Pulls historical A-share K-line data from Tushare and upserts them into
the local SQLite database. Run from the project root or services/worker.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import datetime
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from worker import common


# ==================== Fetchers ====================

def fetch_sina_monthly(code: str, datalen: int = 120) -> list[dict]:
    """Fetch monthly K-line from Sina (no auth required)."""
    import urllib.request

    market = "sh" if code.startswith(("5", "6", "9")) else "sz"
    url = (
        f"http://money.finance.sina.com.cn/quotes_service/api/json_v2.php"
        f"/CN_MarketData.getKLineData?symbol={market}{code}"
        f"&scale=4800&ma=no&datalen={datalen}"
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
        import json as _json
        data = _json.loads(raw)
        if not isinstance(data, list):
            return []
        rows = []
        for item in data:
            rows.append({
                "trade_date": item.get("day", "")[:10],
                "open": float(item["open"]),
                "high": float(item["high"]),
                "low": float(item["low"]),
                "close": float(item["close"]),
                "vol": float(item["volume"]),
            })
        return rows
    except Exception:
        return []


def fetch_sina_daily(code: str, datalen: int = 1200) -> list[dict]:
    """Fetch recent daily K-line from Sina Finance (no auth required)."""
    import urllib.request

    market = "sh" if code.startswith(("5", "6", "9")) else "sz"
    url = (
        f"http://money.finance.sina.com.cn/quotes_service/api/json_v2.php"
        f"/CN_MarketData.getKLineData?symbol={market}{code}"
        f"&scale=240&ma=no&datalen={datalen}"
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
        import json as _json
        data = _json.loads(raw)
        if not isinstance(data, list):
            return []
        rows = []
        for item in data:
            rows.append({
                "trade_date": item.get("day", "")[:10],
                "open": float(item["open"]),
                "high": float(item["high"]),
                "low": float(item["low"]),
                "close": float(item["close"]),
                "vol": float(item["volume"]),
            })
        return rows
    except Exception:
        return []


def fetch_tushare_daily(code: str, start_date: str, end_date: str) -> list[dict]:
    """Fetch daily K-line from Tushare pro.daily()."""
    import tushare as ts

    token = os.environ.get("TUSHARE_TOKEN", "").strip()
    if not token:
        raise RuntimeError("TUSHARE_TOKEN is not configured")
    pro = ts.pro_api(token)

    market = "SH" if code.startswith(("5", "6", "9")) else "SZ"
    ts_code = f"{code}.{market}"

    df = pro.daily(ts_code=ts_code, start_date=start_date, end_date=end_date)
    if df is None or df.empty:
        return []
    return df.to_dict(orient="records")


def resample_to_weekly(daily_rows: list[dict]) -> list[dict]:
    """Resample daily rows to weekly (Friday close)."""
    import pandas as pd
    if not daily_rows:
        return []
    df = pd.DataFrame(daily_rows)
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    df = df.sort_values('trade_date')
    weekly = df.set_index('trade_date').resample('W-FRI').agg({
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
        'vol': 'sum'
    }).dropna()
    weekly = weekly.reset_index()
    weekly.columns = ['trade_date', 'open', 'high', 'low', 'close', 'vol']
    return weekly.to_dict(orient="records")


def resample_to_monthly(daily_rows: list[dict]) -> list[dict]:
    """Resample daily rows to monthly."""
    import pandas as pd
    if not daily_rows:
        return []
    df = pd.DataFrame(daily_rows)
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    df = df.sort_values('trade_date')
    monthly = df.set_index('trade_date').resample('ME').agg({
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
        'vol': 'sum'
    }).dropna()
    monthly = monthly.reset_index()
    monthly.columns = ['trade_date', 'open', 'high', 'low', 'close', 'vol']
    return monthly.to_dict(orient="records")


def fetch_tushare_monthly(code: str, start_date: str, end_date: str) -> list[dict]:
    """Fetch monthly K-line from Tushare pro_bar."""
    import tushare as ts

    token = os.environ.get("TUSHARE_TOKEN", "").strip()
    if not token:
        raise RuntimeError("TUSHARE_TOKEN is not configured")
    pro = ts.pro_api(token)

    market = "SH" if code.startswith(("5", "6", "9")) else "SZ"
    ts_code = f"{code}.{market}"

    df = pro.pro_bar(
        ts_code=ts_code,
        start_date=start_date.replace("-", ""),
        end_date=end_date.replace("-", ""),
        freq="M"
    )
    if df is None or df.empty:
        return []
    return df.to_dict(orient="records")


# ==================== MA calculation ====================

def calc_ma(values: list[float | None], window: int) -> list[float | None]:
    """Calculate moving average for a window. Returns None for insufficient data."""
    result: list[float | None] = []
    for i in range(len(values)):
        if i < window - 1 or values[i] is None:
            result.append(None)
        else:
            window_vals = [values[j] for j in range(i - window + 1, i + 1) if values[j] is not None]
            if len(window_vals) < window:
                result.append(None)
            else:
                result.append(sum(window_vals) / window)
    return result


# ==================== Persistence ====================

def upsert_daily(conn, payload: dict) -> None:
    columns = ["code", "tradeDate", "open", "high", "low", "close", "volume", "turnover", "ma5", "ma10", "ma20"]
    values = [payload.get(col) for col in columns]
    placeholders = ", ".join("?" for _ in columns)
    assignments = ", ".join(f"{col}=excluded.{col}" for col in columns if col not in ("code", "tradeDate"))
    sql = (
        f"INSERT INTO KlineDaily ({', '.join(columns)}) VALUES ({placeholders}) "
        f"ON CONFLICT(code, tradeDate) DO UPDATE SET {assignments}"
    )
    conn.execute(sql, values)


def upsert_weekly(conn, payload: dict) -> None:
    columns = ["code", "weekDate", "open", "high", "low", "close", "volume", "ma5", "ma10", "ma20"]
    values = [payload.get(col) for col in columns]
    placeholders = ", ".join("?" for _ in columns)
    assignments = ", ".join(f"{col}=excluded.{col}" for col in columns if col not in ("code", "weekDate"))
    sql = (
        f"INSERT INTO KlineWeekly ({', '.join(columns)}) VALUES ({placeholders}) "
        f"ON CONFLICT(code, weekDate) DO UPDATE SET {assignments}"
    )
    conn.execute(sql, values)


def upsert_monthly(conn, payload: dict) -> None:
    columns = ["code", "monthDate", "open", "high", "low", "close", "volume", "ma5", "ma10", "ma20"]
    values = [payload.get(col) for col in columns]
    placeholders = ", ".join("?" for _ in columns)
    assignments = ", ".join(f"{col}=excluded.{col}" for col in columns if col not in ("code", "monthDate"))
    sql = (
        f"INSERT INTO KlineMonthly ({', '.join(columns)}) VALUES ({placeholders}) "
        f"ON CONFLICT(code, monthDate) DO UPDATE SET {assignments}"
    )
    conn.execute(sql, values)


def process_daily(conn, code: str, start_date: str, end_date: str) -> dict:
    """Fetch and persist daily K-line with MA. Tries Sina first (free), falls back to Tushare."""
    rows = fetch_sina_daily(code)
    if not rows:
        rows = fetch_tushare_daily(code, start_date, end_date)
    if not rows:
        return {"code": code, "updated": 0, "skipped": 0, "daily_rows": []}

    closes = [common.to_decimal(r.get("close")) for r in rows]
    ma5_vals = calc_ma(closes, 5)
    ma10_vals = calc_ma(closes, 10)
    ma20_vals = calc_ma(closes, 20)

    updated = 0
    skipped = 0
    # rows come in descending order; reverse for ascending storage
    for i, row in enumerate(reversed(rows)):
        trade_date = row.get("trade_date", "")
        if not trade_date:
            skipped += 1
            continue
        mi = len(rows) - 1 - i
        payload = {
            "code": common.normalize_code(code),
            "tradeDate": f"{trade_date}T00:00:00.000Z",
            "open": common.to_decimal(row.get("open")),
            "high": common.to_decimal(row.get("high")),
            "low": common.to_decimal(row.get("low")),
            "close": common.to_decimal(row.get("close")),
            "volume": common.to_decimal(row.get("vol")),
            "turnover": None,
            "ma5": ma5_vals[mi] if mi < len(ma5_vals) and ma5_vals[mi] is not None else None,
            "ma10": ma10_vals[mi] if mi < len(ma10_vals) and ma10_vals[mi] is not None else None,
            "ma20": ma20_vals[mi] if mi < len(ma20_vals) and ma20_vals[mi] is not None else None,
        }
        try:
            upsert_daily(conn, payload)
            updated += 1
        except Exception as exc:
            common.log(f"failed to upsert daily {code} {trade_date}: {exc}")
            skipped += 1
    return {"code": code, "updated": updated, "skipped": skipped, "daily_rows": rows}


def process_weekly_from_daily(conn, code: str, daily_rows: list[dict]) -> dict:
    """Resample daily to weekly and persist with MA."""
    if not daily_rows:
        return {"code": code, "updated": 0, "skipped": 0}
    rows = resample_to_weekly(daily_rows)
    if not rows:
        return {"code": code, "updated": 0, "skipped": 0}

    closes = [common.to_decimal(r.get("close")) for r in rows]
    ma5_vals = calc_ma(closes, 5)
    ma10_vals = calc_ma(closes, 10)
    ma20_vals = calc_ma(closes, 20)

    updated = 0
    skipped = 0
    for i, row in enumerate(reversed(rows)):
        week_date = row.get("trade_date", "")
        if not week_date:
            skipped += 1
            continue
        mi = len(rows) - 1 - i
        payload = {
            "code": common.normalize_code(code),
            "weekDate": f"{str(week_date)[:10]}T00:00:00.000Z",
            "open": common.to_decimal(row.get("open")),
            "high": common.to_decimal(row.get("high")),
            "low": common.to_decimal(row.get("low")),
            "close": common.to_decimal(row.get("close")),
            "volume": common.to_decimal(row.get("vol")),
            "ma5": ma5_vals[mi] if mi < len(ma5_vals) and ma5_vals[mi] is not None else None,
            "ma10": ma10_vals[mi] if mi < len(ma10_vals) and ma10_vals[mi] is not None else None,
            "ma20": ma20_vals[mi] if mi < len(ma20_vals) and ma20_vals[mi] is not None else None,
        }
        try:
            upsert_weekly(conn, payload)
            updated += 1
        except Exception as exc:
            common.log(f"failed to upsert weekly {code} {week_date}: {exc}")
            skipped += 1
    return {"code": code, "updated": updated, "skipped": skipped}


def process_monthly_from_daily(conn, code: str, daily_rows: list[dict]) -> dict:
    """Resample daily to monthly and persist with MA."""
    if not daily_rows:
        return {"code": code, "updated": 0, "skipped": 0}
    rows = resample_to_monthly(daily_rows)
    if not rows:
        return {"code": code, "updated": 0, "skipped": 0}

    closes = [common.to_decimal(r.get("close")) for r in rows]
    ma5_vals = calc_ma(closes, 5)
    ma10_vals = calc_ma(closes, 10)
    ma20_vals = calc_ma(closes, 20)

    updated = 0
    skipped = 0
    for i, row in enumerate(reversed(rows)):
        month_date = row.get("trade_date", "")
        if not month_date:
            skipped += 1
            continue
        mi = len(rows) - 1 - i
        payload = {
            "code": common.normalize_code(code),
            "monthDate": f"{str(month_date)[:10]}T00:00:00.000Z",
            "open": common.to_decimal(row.get("open")),
            "high": common.to_decimal(row.get("high")),
            "low": common.to_decimal(row.get("low")),
            "close": common.to_decimal(row.get("close")),
            "volume": common.to_decimal(row.get("vol")),
            "ma5": ma5_vals[mi] if mi < len(ma5_vals) and ma5_vals[mi] is not None else None,
            "ma10": ma10_vals[mi] if mi < len(ma10_vals) and ma10_vals[mi] is not None else None,
            "ma20": ma20_vals[mi] if mi < len(ma20_vals) and ma20_vals[mi] is not None else None,
        }
        try:
            upsert_monthly(conn, payload)
            updated += 1
        except Exception as exc:
            common.log(f"failed to upsert monthly {code} {month_date}: {exc}")
            skipped += 1
    return {"code": code, "updated": updated, "skipped": skipped}


# ==================== Main ====================

def main() -> int:
    parser = argparse.ArgumentParser(description="Update K-line data for stocks.")
    parser.add_argument("--codes", help="Comma-separated stock codes (defaults to holdings+watchlist)")
    parser.add_argument("--start", default="20200101", help="Start date YYYYMMDD (default: 20200101)")
    parser.add_argument("--end", default="", help="End date YYYYMMDD (default: today)")
    args = parser.parse_args()

    targets = common.parse_codes_arg(args.codes) or common.load_target_codes()
    if not targets:
        print(json.dumps({"ok": True, "message": "no target codes"}))
        return 0

    end_date = args.end or datetime.utcnow().strftime("%Y%m%d")
    # Tushare uses YYYYMMDD format
    start_date = args.start.replace("-", "")

    results: list[dict] = []
    all_updated = 0
    all_skipped = 0

    with common.connect() as conn:
        for code in targets:
            try:
                r_daily = process_daily(conn, code, start_date, end_date)
                daily_rows = r_daily.get("daily_rows", [])
                r_weekly = process_weekly_from_daily(conn, code, daily_rows)
                r_monthly = process_monthly_from_daily(conn, code, daily_rows)
                total_updated = r_daily["updated"] + r_weekly["updated"] + r_monthly["updated"]
                total_skipped = r_daily["skipped"] + r_weekly["skipped"] + r_monthly["skipped"]
                results.append({
                    "code": code,
                    "daily": r_daily["updated"],
                    "weekly": r_weekly["updated"],
                    "monthly": r_monthly["updated"],
                    "skipped": total_skipped
                })
                all_updated += total_updated
                all_skipped += total_skipped
            except Exception as exc:
                common.log(f"failed to process {code}: {exc}")
                results.append({"code": code, "error": str(exc)})

    summary = {"ok": True, "updated": all_updated, "skipped": all_skipped, "codes": results}
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
