"""Shared helpers for the stock-assistant Python worker."""

from __future__ import annotations

import os
import math
import sqlite3
import sys
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Iterable, Iterator, Optional, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def resolve_db_path() -> Path:
    """Locate the SQLite database file. Honors DATABASE_URL or falls back to data/stock.db."""
    raw = os.environ.get("DATABASE_URL", "").strip()
    if raw.startswith("file:"):
        raw = raw[len("file:"):]
    if raw:
        path = Path(raw)
        if not path.is_absolute():
            path = PROJECT_ROOT / "prisma" / raw
        return path.resolve()
    return (PROJECT_ROOT / "data" / "stock.db").resolve()


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    path = resolve_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def load_target_codes(include_holdings: bool = True, include_watchlist: bool = True) -> list[str]:
    """Collect stock codes that should be refreshed, optionally filtered by user-provided codes."""
    codes: set[str] = set()
    with connect() as conn:
        if include_holdings:
            rows = conn.execute("SELECT DISTINCT code FROM Holding").fetchall()
            codes.update(row["code"] for row in rows)
        if include_watchlist:
            rows = conn.execute("SELECT DISTINCT code FROM WatchlistItem").fetchall()
            codes.update(row["code"] for row in rows)
    return sorted(codes)


def upsert_quote(conn: sqlite3.Connection, payload: dict) -> None:
    """Insert or update a single Quote row keyed by (code, tradeDate)."""
    columns = [
        "code",
        "tradeDate",
        "currentPrice",
        "open",
        "high",
        "low",
        "close",
        "preClose",
        "changeAmount",
        "changePercent",
        "volume",
        "turnover",
        "turnoverRate",
    ]
    ensure_stock(conn, payload["code"], payload.get("name"))
    payload = {**payload, "tradeDate": date_to_millis(payload["tradeDate"])}
    values = [payload.get(col) for col in columns]

    placeholders = ", ".join("?" for _ in columns)
    assignments = ", ".join(f"{col}=excluded.{col}" for col in columns if col not in ("code", "tradeDate"))

    sql = (
        f"INSERT INTO Quote ({', '.join(columns)}) VALUES ({placeholders}) "
        f"ON CONFLICT(code, tradeDate) DO UPDATE SET {assignments}"
    )
    conn.execute(sql, values)


def to_decimal(value) -> Optional[float]:
    if value is None or value == "" or value == "-":
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def normalize_code(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text.zfill(6) if text.isdigit() and len(text) <= 6 else text


def parse_codes_arg(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    return [normalize_code(item) for item in raw.split(",") if item.strip()]


def filter_codes(codes: Iterable[str], allowed: Optional[Sequence[str]]) -> list[str]:
    if allowed is None:
        return list(codes)
    allowed_set = set(allowed)
    return [item for item in codes if (item.get("code") if isinstance(item, dict) else item) in allowed_set]


def log(message: str) -> None:
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{timestamp}] {message}", file=sys.stderr, flush=True)


def date_to_millis(value) -> int:
    """Encode a calendar trading date at UTC midnight for Prisma SQLite."""
    if isinstance(value, (int, float)) and abs(value) > 100_000_000_000:
        return int(value)
    text = str(value).strip()
    if len(text) == 8 and text.isdigit():
        date = datetime.strptime(text, '%Y%m%d')
    else:
        date = datetime.strptime(text[:10], '%Y-%m-%d')
    return int(date.replace(tzinfo=timezone.utc).timestamp() * 1000)


def ensure_stock(conn: sqlite3.Connection, code: str, name: str | None = None) -> None:
    """Create the parent security before writing its market observations."""
    now = int(datetime.now(timezone.utc).timestamp() * 1000)
    conn.execute(
        'INSERT INTO Stock (code, name, updatedAt) VALUES (?, ?, ?) '
        'ON CONFLICT(code) DO UPDATE SET name = CASE '
        'WHEN Stock.name = Stock.code THEN excluded.name ELSE Stock.name END',
        (code, name or code, now),
    )


def scaled_decimal(value, factor: float) -> Optional[float]:
    number = to_decimal(value)
    return None if number is None else number * factor


def tushare_symbol(code: str) -> str:
    if code.startswith(('4', '8', '92')):
        return f'{code}.BJ'
    market = 'SH' if code.startswith(('5', '6', '9')) else 'SZ'
    return f'{code}.{market}'


def fetch_daily_bars(pro, code: str, **query):
    """Select the provider endpoint for the instrument rather than treating ETFs as stocks."""
    if code.startswith(('sh', 'sz')):
        market, symbol = code[:2].upper(), code[2:]
        return pro.index_daily(ts_code=f'{symbol}.{market}', **query)
    endpoint = pro.fund_daily if code.startswith(('5', '15', '16')) else pro.daily
    return endpoint(ts_code=tushare_symbol(code), **query)


def snapshot_trade_date(calendar, now: datetime | None = None) -> str:
    """Use the previous session before continuous trading begins in Shanghai."""
    local = (now or datetime.now(timezone.utc)).astimezone(timezone(timedelta(hours=8)))
    today = local.strftime('%Y-%m-%d')
    eligible = [str(day)[:10] for day in calendar
                if str(day)[:10] < today or (str(day)[:10] == today and (local.hour, local.minute) >= (9, 30))]
    if not eligible:
        raise RuntimeError('No trading date available')
    return max(eligible)
