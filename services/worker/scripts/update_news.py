"""Update news from AKShare with sector classification."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from worker import common


# Default sector keywords to search for news
DEFAULT_SECTORS = [
    "白酒", "半导体", "消费", "新能源", "医疗",
    "银行", "地产", "AI", "军工", "光伏",
    "锂电池", "汽车", "家电", "旅游", "零售"
]


def fetch_news_by_sector(sector: str) -> list[dict]:
    """Fetch news for a specific sector using AKShare."""
    import akshare as ak

    try:
        df = ak.stock_news_em(symbol=sector)
        items = []
        for _, row in df.iterrows():
            try:
                title = str(row.get('新闻标题', ''))
                if not title:
                    continue

                pub_date = str(row.get('发布时间', ''))
                if pub_date:
                    try:
                        pub_date = datetime.strptime(pub_date, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d %H:%M:%S")
                    except (ValueError, OSError):
                        pub_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                else:
                    pub_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                items.append({
                    "type": "资讯",
                    "code": None,
                    "title": title,
                    "source": str(row.get('文章来源', '')) or '东方财富',
                    "publishDate": pub_date,
                    "url": str(row.get('新闻链接', '')) or '',
                    "summary": str(row.get('新闻内容', ''))[:500] if row.get('新闻内容') else '',
                    "sectors": sector,
                })
            except Exception as exc:
                common.log(f"failed to parse news row: {exc}")
                continue
        return items
    except Exception as exc:
        common.log(f"fetch_news_by_sector({sector}) failed: {exc}")
        return []


def fetch_all_news() -> list[dict]:
    """Fetch news for all configured sectors."""
    sectors_str = os.environ.get("NEWS_SECTORS", "").strip()
    if sectors_str:
        sectors = [s.strip() for s in sectors_str.split(",") if s.strip()]
    else:
        sectors = DEFAULT_SECTORS

    all_items = []
    for sector in sectors:
        items = fetch_news_by_sector(sector)
        all_items.extend(items)
        common.log(f"fetched {len(items)} news for sector '{sector}'")

    return all_items


def persist_news(items: list[dict]) -> dict:
    """Insert news items into database."""
    # Load holding codes for impact matching
    holding_codes: set[str] = set()
    with common.connect() as conn:
        rows = conn.execute("SELECT code FROM Holding").fetchall()
        holding_codes = {row["code"] for row in rows}

    summary = {"total": 0, "inserted": 0, "skipped": 0, "impact": 0}
    sector_stats: dict[str, int] = {}

    with common.connect() as conn:
        for item in items:
            if not item.get("title"):
                summary["skipped"] += 1
                continue

            # Check if URL already exists
            url = item.get("url", "")
            if url:
                existing = conn.execute(
                    "SELECT id FROM NewsItem WHERE url = ?",
                    (url,)
                ).fetchone()
                if existing:
                    summary["skipped"] += 1
                    continue

            sectors = item.get("sectors", "")
            code = item.get("code")
            title = item["title"]

            # Mark as impact if code matches a holding
            impact = 1 if (code and code in holding_codes) else 0

            # Track sector stats
            if sectors:
                sector_stats[sectors] = sector_stats.get(sectors, 0) + 1

            try:
                conn.execute("""
                    INSERT INTO NewsItem (type, code, title, source, publishDate, url, summary, sentiment, impactOnHolding, sectors)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'neutral', ?, ?)
                """, (
                    item["type"],
                    code,
                    title,
                    item.get("source"),
                    item["publishDate"],
                    url,
                    item.get("summary"),
                    impact,
                    sectors,
                ))
                summary["inserted"] += 1
                if impact:
                    summary["impact"] += 1
            except Exception as exc:
                common.log(f"failed to insert news {title[:50]}: {exc}")
                summary["skipped"] += 1
            summary["total"] += 1

    return {**summary, "sector_stats": sector_stats}


def main() -> int:
    print("Fetching news from AKShare...")
    items = fetch_all_news()
    print(f"Fetched {len(items)} news items total")

    if not items:
        print(json.dumps({"ok": True, "message": "no news fetched"}))
        return 0

    # Deduplicate by URL
    seen_urls = set()
    unique_items = []
    for item in items:
        url = item.get("url", "")
        if url and url in seen_urls:
            continue
        seen_urls.add(url)
        unique_items.append(item)

    print(f"After deduplication: {len(unique_items)} unique items")

    summary = persist_news(unique_items)
    print(f"Inserted: {summary['inserted']}, Skipped: {summary['skipped']}, Impact on holdings: {summary['impact']}")
    print(f"Sector stats: {summary['sector_stats']}")
    summary["ok"] = True
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
