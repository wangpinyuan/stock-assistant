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
from datetime import datetime, timedelta, timezone
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from worker import common  # noqa: E402  (path adjusted above)


def load_a_share_codes() -> list[str]:
    """Load listed security codes from the provider universe."""
    from worker.providers.eastmoney import fetch_snapshot, STOCKS
    return [str(row['f12']) for row in fetch_snapshot(STOCKS)]


def fetch_sina_spot(codes: list[str] | None = None) -> list[dict]:
    """Return Sina real-time snapshot for all A-shares in batches."""
    import re
    import urllib.request
    from lookup_stock import get_market_prefix

    all_codes = load_a_share_codes() if codes is None else codes
    batch_size = 200
    all_records = []

    for i in range(0, len(all_codes), batch_size):
        batch = all_codes[i:i + batch_size]
        # Sina needs sh/sz prefix based on code range
        prefixed = []
        for code in batch:
            prefixed.append(f"{get_market_prefix(code)}{code}")

        codes_str = ",".join(prefixed)
        url = f"https://hq.sinajs.cn/list={codes_str}"
        req = urllib.request.Request(url, headers={
            "Referer": "https://finance.sina.com.cn",
            "User-Agent": "Mozilla/5.0"
        })

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read().decode("gbk", errors="replace")

            for line in data.strip().split("\n"):
                m = re.search(r'hq_str_(sh|sz|bj)(\w+)="([^"]*)"', line)
                if not m:
                    continue
                prefix = m.group(1)
                code = m.group(2)
                fields = m.group(3).split(",")

                if len(fields) < 10:
                    continue

                name = fields[0]
                if not name or name == "-":
                    continue

                # Fields: name, open, pre_close, current, high, low, ...
                # For indices: pre_close is fields[1], current is fields[3]
                # For stocks: pre_close is fields[2], current is fields[3]
                is_index = False
                try:
                    pre_close = float(fields[1]) if is_index else float(fields[2])
                except (ValueError, IndexError):
                    pre_close = 0
                try:
                    current = float(fields[3]) if fields[3] and fields[3] != "-" else None
                except (ValueError, IndexError):
                    current = None

                if current is None:
                    continue

                change = current - pre_close if pre_close and pre_close != 0 else 0
                change_pct = (change / pre_close * 100) if pre_close and pre_close != 0 else 0

                try:
                    volume = float(fields[8]) if fields[8] and fields[8] != "-" else 0
                except (ValueError, IndexError):
                    volume = 0

                all_records.append({
                    "code": code,
                    "name": name,
                    "tradeDate": fields[30] if len(fields) > 30 else None,
                    "currentPrice": current,
                    "open": float(fields[1]) if not is_index and fields[1] and fields[1] != "-" else None,
                    "high": float(fields[4]) if fields[4] and fields[4] != "-" else None,
                    "low": float(fields[5]) if fields[5] and fields[5] != "-" else None,
                    "preClose": pre_close if pre_close else None,
                    "changeAmount": change,
                    "changePercent": change_pct,
                    "volume": volume,
                    "turnover": common.to_decimal(fields[9]),
                    "turnoverRate": None,
                })
        except Exception as exc:
            raise RuntimeError(f"failed to fetch Sina batch {i // batch_size + 1}: {exc}") from exc

    return all_records


def fetch_akshare_spot() -> list[dict]:
    """Return the AKShare real-time snapshot as a list of plain dicts."""
    import akshare as ak  # type: ignore

    calendar = ak.tool_trade_date_hist_sina()
    snapshot_date = common.snapshot_trade_date(calendar['trade_date'])
    df = ak.stock_zh_a_spot_em()
    records = df.to_dict(orient="records")
    return [
        {
            "code": common.normalize_code(row.get("代码")),
            "tradeDate": row.get("日期") or snapshot_date,
            "name": (row.get("名称") or "").strip(),
            "currentPrice": common.to_decimal(row.get("最新价")),
            "open": common.to_decimal(row.get("今开")),
            "high": common.to_decimal(row.get("最高")),
            "low": common.to_decimal(row.get("最低")),
            "preClose": common.to_decimal(row.get("昨收")),
            "changeAmount": common.to_decimal(row.get("涨跌额")),
            "changePercent": common.to_decimal(row.get("涨跌幅")),
            "volume": common.scaled_decimal(row.get("成交量"), 100),
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
        df = common.fetch_daily_bars(pro, code, trade_date=trade_date)
        if df is None or df.empty:
            continue
        for _, row in df.iterrows():
            out.append({
                "code": common.normalize_code(str(row.get("ts_code", "")).split(".")[0]),
                "tradeDate": row.get("trade_date"),
                "currentPrice": common.to_decimal(row.get("close")),
                "open": common.to_decimal(row.get("open")),
                "high": common.to_decimal(row.get("high")),
                "low": common.to_decimal(row.get("low")),
                "preClose": common.to_decimal(row.get("pre_close")),
                "changeAmount": common.to_decimal(row.get("change")),
                "changePercent": common.to_decimal(row.get("pct_chg")),
                "volume": common.scaled_decimal(row.get("vol"), 100),
                "turnover": common.scaled_decimal(row.get("amount"), 1000),
                "turnoverRate": None,
            })
    return out


def persist(records: list[dict]) -> dict:
    """Upsert quote records. Returns a summary dict."""
    summary = {"total": 0, "updated": 0, "skipped": 0}
    with common.connect() as conn:
        for record in records:
            if not record.get("code") or record.get("currentPrice") is None:
                summary["skipped"] += 1
                continue
            payload = {
                "code": record["code"],
                "name": record.get("name"),
                "tradeDate": record.get("tradeDate"),
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
                if payload["tradeDate"] is None:
                    raise ValueError("Provider did not supply a trading date")
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
    parser.add_argument("--source", choices=["akshare", "tushare", "sina"], default="sina")
    parser.add_argument("--market", action="store_true", help="Refresh full market instead of selected securities")
    args = parser.parse_args()

    overrides = common.parse_codes_arg(args.codes)
    targets = overrides or ([] if args.market else common.load_target_codes())
    if not targets and not args.market:
        print(json.dumps({"ok": True, "updated": 0, "message": "no target codes"}))
        return 0

    try:
        if args.source == "tushare":
            today = datetime.utcnow().strftime("%Y%m%d")
            records = fetch_tushare_daily(targets, today)
        elif args.source == "sina":
            records = fetch_sina_spot(None if args.market else targets)
        else:
            records = fetch_akshare_spot()
            records = common.filter_codes(records, None if args.market else targets)
    except Exception as exc:  # noqa: BLE001
        common.log(f"fetch failed: {exc}")
        print(json.dumps({"ok": false, "error": str(exc)}))
        return 1

    if not records:
        print(json.dumps({"ok": True, "updated": 0, "message": "no records fetched"}))
        return 0

    summary = persist(records)
    summary["ok"] = summary["skipped"] == 0
    summary["targets"] = targets
    summary["source"] = args.source
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
