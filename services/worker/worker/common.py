"""Shared helpers for the stock-assistant Python worker."""

from __future__ import annotations

import os
import sqlite3
import sys
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterable, Iterator, Optional, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def resolve_db_path() -> Path:
    """Locate the SQLite database file. Honors DATABASE_URL or falls back to data/stock.db."""
    raw = os.environ.get("DATABASE_URL", "").strip()
    if raw.startswith("file:"):
        raw = raw[len("file:"):]
    if raw:
        path = Path(raw)
        if not path.is_absolute():
            path = PROJECT_ROOT / raw
        return path.resolve()
    return (PROJECT_ROOT / "data" / "stock.db").resolve()


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    path = resolve_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
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
        return float(value)
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
    if not allowed:
        return list(codes)
    allowed_set = set(allowed)
    return [code for code in codes if code in allowed_set]


def log(message: str) -> None:
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{timestamp}] {message}", file=sys.stderr, flush=True)
