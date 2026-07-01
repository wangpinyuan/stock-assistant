"""Refresh Quote rows for holdings and watchlist stocks.

Pulls real-time A-share snapshots from AKShare and upserts them into the
local SQLite database. Tushare is used as a fallback when a token is
available. Run from the project root or the services/worker directory.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from worker import common  # noqa: E402  (path adjusted above)


def fetch_akshare_spot() -> list[dict]:
    """Return the AKShare real-time snapshot as a list of plain dicts."""
    import akshare as ak  # type: ignore

    df = ak.stock_zh_a_spot_em()
    records = df.to_dict(orient="records")
    return [
        {
            "code": common.normalize_code(row.get("代码")),
            "name": (row.get("名称") or "").strip(),
            "currentPrice": common.to_decimal(row.get("最新价")),
            "open": common.to_decimal(row.get("今开")),
            "high": common.to_decimal(row.get("最高")),
            "low": common.to_decimal(row.get("最低")),
            "preClose": common.to_decimal(row.get("昨收")),
            "changeAmount": common.to_decimal(row.get("涨跌额")),
            "changePercent": common.to_decimal(row.get("涨跌幅")),
            "volume": common.to_decimal(row.get("成交量")),
            "turnover": common.to_decimal(row.get("成交额")),
            "turnoverRate": common.to_decimal(row.get("换手率")),
        }
        for row in records
    ]


def fetch_tushare_daily(codes: list[str], trade_date: str) -> list[dict]:
    """Return Tushare daily bars for the given codes and trade date."""
    import tushare as ts  # type: ignore

    token = os.environ.get("TUSHARE_TOKEN", "").strip()
    if not token:
        raise RuntimeError("TUSHARE_TOKEN is not configured")
    pro = ts.pro_api(token)

    out: list[dict] = []
    for code in codes:
        market = "SH" if code.startswith(("5", "6", "9")) else "SZ"
        df = pro.daily(ts_code=f"{code}.{market}", trade_date=trade_date)
        if df is None or df.empty:
            continue
        for _, row in df.iterrows():
            out.append({
                "code": common.normalize_code(str(row.get("ts_code", "")).split(".")[0]),
                "currentPrice": common.to_decimal(row.get("close")),
                "open": common.to_decimal(row.get("open")),
                "high": common.to_decimal(row.get("high")),
                "low": common.to_decimal(row.get("low")),
                "preClose": common.to_decimal(row.get("pre_close")),
                "changeAmount": common.to_decimal(row.get("change")),
                "changePercent": common.to_decimal(row.get("pct_chg")),
                "volume": common.to_decimal(row.get("vol")),
                "turnover": common.to_decimal(row.get("amount")),
                "turnoverRate": None,
            })
    return out


def persist(records: list[dict]) -> dict:
    """Upsert quote records. Returns a summary dict."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    summary = {"total": 0, "updated": 0, "skipped": 0}
    with common.connect() as conn:
        for record in records:
            if not record.get("code") or record.get("currentPrice") is None:
                summary["skipped"] += 1
                continue
            payload = {
                "code": record["code"],
                "tradeDate": today,
                "currentPrice": record.get("currentPrice"),
                "open": record.get("open"),
                "high": record.get("high"),
                "low": record.get("low"),
                "close": record.get("currentPrice"),
                "preClose": record.get("preClose"),
                "changeAmount": record.get("changeAmount"),
                "changePercent": record.get("changePercent"),
                "volume": record.get("volume"),
                "turnover": record.get("turnover"),
                "turnoverRate": record.get("turnoverRate"),
            }
            try:
                common.upsert_quote(conn, payload)
                summary["updated"] += 1
            except Exception as exc:  # noqa: BLE001
                common.log(f"failed to upsert {record.get('code')}: {exc}")
                summary["skipped"] += 1
            summary["total"] += 1
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Update stock quote snapshots.")
    parser.add_argument("--codes", help="Comma-separated stock codes to refresh (defaults to holdings+watchlist)")
    parser.add_argument("--source", choices=["akshare", "tushare"], default="akshare")
    args = parser.parse_args()

    overrides = common.parse_codes_arg(args.codes)
    targets = overrides or common.load_target_codes()
    if not targets:
        print(json.dumps({"ok": True, "updated": 0, "message": "no target codes"}))
        return 0

    try:
        if args.source == "tushare":
            today = datetime.utcnow().strftime("%Y%m%d")
            records = fetch_tushare_daily(targets, today)
        else:
            records = fetch_akshare_spot()
            records = common.filter_codes(records, targets)
    except Exception as exc:  # noqa: BLE001
        common.log(f"fetch failed: {exc}")
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1

    summary = persist(records)
    summary["ok"] = True
    summary["targets"] = targets
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
