"""Update detailed fund flow data with stock-level inflows and outflows.

Calculates net inflow/outflow based on:
- Inflow: price up + volume above average
- Outflow: price down + volume above average

Also fetches concept board (theme sector) fund flow from East Money.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from worker import common


def fetch_concept_board_flow() -> list[dict]:
    """Fetch concept board (theme sector) fund flow from East Money API."""
    import subprocess
    # East Money concept board API - sorted by net inflow (f62)
    # Use push2delay.eastmoney.com to avoid connection issues
    url = (
        "https://push2delay.eastmoney.com/api/qt/clist/get"
        "?pn=1&pz=100&po=1&np=1"
        "&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f62"
        "&fs=m:90+t:3+f:!50"
        "&fields=f12,f14,f62,f184,f3,f66"
    )
    try:
        result = subprocess.run(
            ["curl", "-s", "--noproxy", "*", url,
             "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
             "-H", "Referer: https://quote.eastmoney.com/"],
            capture_output=True, text=True, timeout=20
        )
        data = json.loads(result.stdout)
        diff = data.get("data", {}).get("diff", [])
        results = []
        for item in diff:
            name = item.get("f14", "")
            if not name:
                continue
            results.append({
                "code": item.get("f12", ""),
                "name": name,
                "mainNetInflow": item.get("f62", 0) or 0,
                "upCount": item.get("f184", 0) or 0,
                "downCount": item.get("f66", 0) or 0,
                "changePercent": item.get("f3", 0) or 0,
            })
        return results
    except Exception as exc:
        common.log(f"fetch_concept_board_flow failed: {exc}")
        return []


def fetch_concept_board_outflows() -> list[dict]:
    """Fetch concept board (theme sector) fund outflows - sorted by negative net inflow."""
    import subprocess
    # East Money concept board API - sorted by net inflow ascending (po=0 for ascending)
    # Use push2delay.eastmoney.com to avoid connection issues
    url = (
        "https://push2delay.eastmoney.com/api/qt/clist/get"
        "?pn=1&pz=100&po=0&np=1"
        "&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f62"
        "&fs=m:90+t:3+f:!50"
        "&fields=f12,f14,f62,f184,f3,f66"
    )
    try:
        result = subprocess.run(
            ["curl", "-s", "--noproxy", "*", url,
             "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
             "-H", "Referer: https://quote.eastmoney.com/"],
            capture_output=True, text=True, timeout=20
        )
        data = json.loads(result.stdout)
        diff = data.get("data", {}).get("diff", [])
        results = []
        for item in diff:
            name = item.get("f14", "")
            if not name:
                continue
            main_net_inflow = item.get("f62", 0) or 0
            # Only include sectors with negative net inflow (outflows)
            if main_net_inflow < 0:
                results.append({
                    "code": item.get("f12", ""),
                    "name": name,
                    "mainNetInflow": main_net_inflow,
                    "upCount": item.get("f184", 0) or 0,
                    "downCount": item.get("f66", 0) or 0,
                    "changePercent": item.get("f3", 0) or 0,
                })
        return results[:20]  # Return top 20 outflows
    except Exception as exc:
        common.log(f"fetch_concept_board_outflows failed: {exc}")
        return []


# Sector mapping based on stock code prefixes
SECTOR_MAPPING = {
    "主板（沪）": lambda code: code.startswith(("600", "601", "603")),
    "科创板": lambda code: code.startswith(("688",)),
    "主板（深）": lambda code: code.startswith(("000", "001")),
    "中小板": lambda code: code.startswith(("002",)),
    "创业板": lambda code: code.startswith(("300",)),
    "北交所": lambda code: code.startswith(("8",)),
}


def get_sector_by_code(code: str) -> str | None:
    for sector_name, matcher in SECTOR_MAPPING.items():
        if matcher(code):
            return sector_name
    return None


def generate_a_share_codes() -> list[str]:
    codes = []
    for i in range(600000, 604000):
        codes.append(f"{i:06d}")
    for i in range(688000, 689000):
        codes.append(f"{i:06d}")
    for i in range(1, 2000):
        codes.append(f"{i:06d}")
    for i in range(2000, 3000):
        codes.append(f"{i:06d}")
    for i in range(3000, 4000):
        codes.append(f"{i:06d}")
    for i in range(800000, 804000):
        codes.append(f"{i:06d}")
    return codes


def fetch_sina_spot_batch(codes: list[str]) -> list[dict]:
    """Fetch Sina real-time data for a batch of codes."""
    prefixed = []
    for code in codes:
        if code.startswith(("5", "6", "9", "8")):
            prefixed.append(f"sh{code}")
        else:
            prefixed.append(f"sz{code}")

    codes_str = ",".join(prefixed)
    url = f"https://hq.sinajs.cn/list={codes_str}"
    req = urllib.request.Request(url, headers={
        "Referer": "https://finance.sina.com.cn",
        "User-Agent": "Mozilla/5.0"
    })

    results = []
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read().decode("gbk", errors="replace")

        for line in data.strip().split("\n"):
            if 'hq_str' not in line:
                continue
            try:
                parts = line.split('"')
                if len(parts) < 2:
                    continue
                code_part = line.split('hq_str_')[1].split('=')[0]
                code = code_part[2:] if code_part.startswith(('sh', 'sz')) else code_part
                fields = parts[1].split(",")
                if len(fields) < 10:
                    continue

                name = fields[0]
                if not name or name == "-":
                    continue

                is_index = code.startswith(("000", "399"))
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

                try:
                    volume = float(fields[8]) if fields[8] and fields[8] != "-" else 0
                    turnover = float(fields[9]) if fields[9] and fields[9] != "-" else 0
                except (ValueError, IndexError):
                    volume, turnover = 0, 0

                change = current - pre_close if pre_close and pre_close != 0 else 0
                change_pct = (change / pre_close * 100) if pre_close and pre_close != 0 else 0

                # Calculate net inflow based on price change direction and volume
                # Positive change = buying pressure (inflow)
                # Negative change = selling pressure (outflow)
                # Volume indicates magnitude
                net_inflow = change_pct * volume if volume > 0 else 0

                sector = get_sector_by_code(code)

                results.append({
                    "code": code,
                    "name": name,
                    "currentPrice": current,
                    "changePercent": change_pct,
                    "volume": volume,
                    "turnover": turnover,
                    "netInflow": net_inflow,
                    "sector": sector
                })
            except Exception:
                continue
    except Exception:
        pass

    return results


def calculate_fund_flow() -> tuple[list[dict], list[dict]]:
    """Calculate top inflows and outflows for all stocks."""
    all_codes = generate_a_share_codes()
    batch_size = 100
    all_stocks = []

    for i in range(0, len(all_codes), batch_size):
        batch = all_codes[i:i + batch_size]
        results = fetch_sina_spot_batch(batch)
        all_stocks.extend(results)

    # Sort by net inflow
    sorted_stocks = sorted(all_stocks, key=lambda x: x.get("netInflow") or 0, reverse=True)

    # Top 10 inflows
    top_inflows = [s for s in sorted_stocks if (s.get("netInflow") or 0) > 0][:10]

    # Top 10 outflows
    sorted_by_outflow = sorted(all_stocks, key=lambda x: x.get("netInflow") or 0)
    top_outflows = [s for s in sorted_by_outflow if (s.get("netInflow") or 0) < 0][:10]

    return top_inflows, top_outflows


def persist_fund_flow(top_inflows: list[dict], top_outflows: list[dict], concept_boards: list[dict], sector_outflows: list[dict]) -> dict:
    """Store fund flow data in database."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    today_ts = int(datetime.strptime(today, "%Y-%m-%d").timestamp() * 1000)

    summary = {"inflows": 0, "outflows": 0, "sectors": 0}
    with common.connect() as conn:
        # Delete today's fund flow data
        conn.execute("DELETE FROM FundFlow WHERE flowDate = ?", (today_ts,))

        # Insert top inflows
        for stock in top_inflows:
            conn.execute("""
                INSERT INTO FundFlow (level, code, name, flowDate, mainNetInflow, largeOrderNetInflow, changePercent)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                "stock_inflow",
                stock["code"],
                stock["name"],
                today_ts,
                stock.get("netInflow", 0),
                stock.get("volume", 0),
                stock.get("changePercent", 0)
            ))
            summary["inflows"] += 1

        # Insert top outflows
        for stock in top_outflows:
            conn.execute("""
                INSERT INTO FundFlow (level, code, name, flowDate, mainNetInflow, largeOrderNetInflow, changePercent)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                "stock_outflow",
                stock["code"],
                stock["name"],
                today_ts,
                stock.get("netInflow", 0),
                stock.get("volume", 0),
                stock.get("changePercent", 0)
            ))
            summary["outflows"] += 1

        # Insert concept board (theme sector) fund flow (inflows)
        for board in concept_boards:
            conn.execute("""
                INSERT INTO FundFlow (level, code, name, flowDate, mainNetInflow, largeOrderNetInflow, changePercent)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                "sector",
                board.get("code"),
                board.get("name"),
                today_ts,
                board.get("mainNetInflow", 0),
                board.get("upCount", 0),
                board.get("changePercent", 0)
            ))
            summary["sectors"] += 1

        # Insert sector outflows
        for board in sector_outflows:
            conn.execute("""
                INSERT INTO FundFlow (level, code, name, flowDate, mainNetInflow, largeOrderNetInflow, changePercent)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                "sector_outflow",
                board.get("code"),
                board.get("name"),
                today_ts,
                board.get("mainNetInflow", 0),
                board.get("downCount", 0),
                board.get("changePercent", 0)
            ))
            summary["sectors"] += 1

    return summary


def main() -> int:
    print("Calculating fund flow (top inflows/outflows)...")
    top_inflows, top_outflows = calculate_fund_flow()

    print(f"\nTop 10 Inflows:")
    for i, s in enumerate(top_inflows, 1):
        print(f"  {i}. {s['name']}({s['code']}): +{s['netInflow']:.2f}万手 涨跌:{s['changePercent']:.2f}%")

    print(f"\nTop 10 Outflows:")
    for i, s in enumerate(top_outflows, 1):
        print(f"  {i}. {s['name']}({s['code']}): {s['netInflow']:.2f}万手 涨跌:{s['changePercent']:.2f}%")

    print("\nFetching concept board (theme sector) fund flow...")
    concept_boards = fetch_concept_board_flow()
    print(f"Got {len(concept_boards)} concept boards (inflows)")
    for board in concept_boards[:5]:
        print(f"  {board['name']}: 净流入={board['mainNetInflow']}万 涨跌={board['changePercent']}%")

    print("\nFetching sector outflows...")
    sector_outflows = fetch_concept_board_outflows()
    print(f"Got {len(sector_outflows)} sector outflows")
    for board in sector_outflows[:5]:
        print(f"  {board['name']}: 净流出={board['mainNetInflow']}万 涨跌={board['changePercent']}%")

    summary = persist_fund_flow(top_inflows, top_outflows, concept_boards, sector_outflows)
    print(f"\nPersisted {summary['inflows']} inflows, {summary['outflows']} outflows, {summary['sectors']} sectors")
    print(json.dumps({"ok": True, **summary}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
