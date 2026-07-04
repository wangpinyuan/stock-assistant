"""Generate sample K-line data for demo/testing purposes.

This script creates realistic-looking historical K-line data for all stocks
in the database. It does NOT require external API access.
"""

from __future__ import annotations

import json
import math
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def resolve_db_path():
    import os
    raw = os.environ.get("DATABASE_URL", "").strip()
    if raw.startswith("file:"):
        raw = raw[len("file:"):]
    if raw:
        path = Path(raw)
        if not path.is_absolute():
            path = PROJECT_ROOT / raw
        resolved = path.resolve()
        if resolved.exists():
            return resolved
    # Fallback: check relative to current working dir
    default = Path("data/stock.db").resolve()
    if default.exists():
        return default
    return (PROJECT_ROOT / "data" / "stock.db").resolve()


def normalize_code(value):
    if value is None:
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text.zfill(6) if text.isdigit() and len(text) <= 6 else text


def calc_ma(values, window):
    result = []
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


def seed_kline():
    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Get all stocks
    stocks = conn.execute("SELECT code FROM Stock").fetchall()
    print(f"Found {len(stocks)} stocks")

    # Generate 365 days of data ending yesterday
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=365)
    dates = []
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:  # Skip weekends
            dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)

    for stock_row in stocks:
        code = normalize_code(stock_row["code"])
        # Get a base price from existing quote or use default
        quote = conn.execute(
            "SELECT currentPrice FROM Quote WHERE code = ? ORDER BY tradeDate DESC LIMIT 1",
            (code,)
        ).fetchone()
        base_price = float(quote["currentPrice"]) if quote else (100 + random.random() * 400)
        base_price = base_price or 100.0

        # Generate realistic OHLCV
        closes = []
        opens = []
        highs = []
        lows = []
        volumes = []

        price = base_price * (0.85 + random.random() * 0.3)  # Start ~15% off current

        for d in dates:
            daily_return = random.gauss(0.001, 0.02)  # Mean 0.1%, std 2%
            open_price = price * (1 + random.gauss(0, 0.005))
            close_price = open_price * (1 + daily_return)
            high_price = max(open_price, close_price) * (1 + abs(random.gauss(0, 0.01)))
            low_price = min(open_price, close_price) * (1 - abs(random.gauss(0, 0.01)))
            volume = int(random.gauss(5_000_000, 2_000_000) * (1 + abs(daily_return) * 10))

            opens.append(round(open_price, 2))
            closes.append(round(close_price, 2))
            highs.append(round(high_price, 2))
            lows.append(round(low_price, 2))
            volumes.append(max(100_000, volume))
            price = close_price

        ma5 = calc_ma(closes, 5)
        ma10 = calc_ma(closes, 10)
        ma20 = calc_ma(closes, 20)

        # Insert daily
        daily_inserted = 0
        for i, d in enumerate(dates):
            try:
                conn.execute("""
                    INSERT INTO KlineDaily (code, tradeDate, open, high, low, close, volume, turnover, ma5, ma10, ma20)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
                    ON CONFLICT(code, tradeDate) DO UPDATE SET
                        open=excluded.open, high=excluded.high, low=excluded.low,
                        close=excluded.close, volume=excluded.volume,
                        ma5=excluded.ma5, ma10=excluded.ma10, ma20=excluded.ma20
                """, (code, d, opens[i], highs[i], lows[i], closes[i], volumes[i],
                      ma5[i], ma10[i], ma20[i]))
                daily_inserted += 1
            except Exception as e:
                pass

        # Resample to weekly
        weekly_data = {}
        for i, d in enumerate(dates):
            week_start = (date.fromisoformat(d) - timedelta(days=date.fromisoformat(d).weekday())).strftime("%Y-%m-%d")
            if week_start not in weekly_data:
                weekly_data[week_start] = {"opens": [], "highs": [], "lows": [], "closes": [], "volumes": []}
            weekly_data[week_start]["opens"].append(opens[i])
            weekly_data[week_start]["highs"].append(highs[i])
            weekly_data[week_start]["lows"].append(lows[i])
            weekly_data[week_start]["closes"].append(closes[i])
            weekly_data[week_start]["volumes"].append(volumes[i])

        weekly_dates = sorted(weekly_data.keys())
        weekly_closes = [weekly_data[w]["closes"][-1] for w in weekly_dates]
        weekly_ma5 = calc_ma(weekly_closes, 5)
        weekly_ma10 = calc_ma(weekly_closes, 10)
        weekly_ma20 = calc_ma(weekly_closes, 20)

        for i, w in enumerate(weekly_dates):
            wd = weekly_data[w]
            try:
                conn.execute("""
                    INSERT INTO KlineWeekly (code, weekDate, open, high, low, close, volume, turnover, ma5, ma10, ma20)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
                    ON CONFLICT(code, weekDate) DO UPDATE SET
                        open=excluded.open, high=excluded.high, low=excluded.low,
                        close=excluded.close, volume=excluded.volume,
                        ma5=excluded.ma5, ma10=excluded.ma10, ma20=excluded.ma20
                """, (code, w,
                      wd["opens"][0], max(wd["highs"]), min(wd["lows"]), wd["closes"][-1], sum(wd["volumes"]),
                      weekly_ma5[i], weekly_ma10[i], weekly_ma20[i]))
            except Exception:
                pass

        # Resample to monthly
        monthly_data = {}
        for i, d in enumerate(dates):
            month_start = d[:7] + "-01"
            if month_start not in monthly_data:
                monthly_data[month_start] = {"opens": [], "highs": [], "lows": [], "closes": [], "volumes": []}
            monthly_data[month_start]["opens"].append(opens[i])
            monthly_data[month_start]["highs"].append(highs[i])
            monthly_data[month_start]["lows"].append(lows[i])
            monthly_data[month_start]["closes"].append(closes[i])
            monthly_data[month_start]["volumes"].append(volumes[i])

        monthly_dates = sorted(monthly_data.keys())
        monthly_closes = [monthly_data[m]["closes"][-1] for m in monthly_dates]
        monthly_ma5 = calc_ma(monthly_closes, 5)
        monthly_ma10 = calc_ma(monthly_closes, 10)
        monthly_ma20 = calc_ma(monthly_closes, 20)

        for i, m in enumerate(monthly_dates):
            md = monthly_data[m]
            try:
                conn.execute("""
                    INSERT INTO KlineMonthly (code, monthDate, open, high, low, close, volume, turnover, ma5, ma10, ma20)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
                    ON CONFLICT(code, monthDate) DO UPDATE SET
                        open=excluded.open, high=excluded.high, low=excluded.low,
                        close=excluded.close, volume=excluded.volume,
                        ma5=excluded.ma5, ma10=excluded.ma10, ma20=excluded.ma20
                """, (code, m,
                      md["opens"][0], max(md["highs"]), min(md["lows"]), md["closes"][-1], sum(md["volumes"]),
                      monthly_ma5[i], monthly_ma10[i], monthly_ma20[i]))
            except Exception:
                pass

        print(f"  {code}: {daily_inserted} daily rows")

    conn.commit()
    conn.close()
    print("Done!")


if __name__ == "__main__":
    seed_kline()
