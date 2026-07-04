"""Update news from East Money announcement API with stock code extraction."""

from __future__ import annotations

import json
import re
import sys
import subprocess
from datetime import datetime
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from worker import common


# East Money announcement API
EAST_MONEY_NEWS_URL = (
    "https://np-anotice-stock.eastmoney.com/api/security/ann"
    "?sr=-1&page_size=50&page_index=1&ann_type=SHA,CYB,SZA,BEA,BJA"
    "&client_source=web"
)


def fetch_eastmoney_news() -> list[dict]:
    """Fetch news from East Money announcement API."""
    try:
        result = subprocess.run(
            ["curl", "-s", "--noproxy", "*", EAST_MONEY_NEWS_URL,
             "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
             "-H", "Referer: https://data.eastmoney.com/",
             "-H", "Accept: application/json"],
            capture_output=True, text=True, timeout=30
        )
        data = json.loads(result.stdout)
    except Exception as exc:
        common.log(f"failed to fetch East Money news: {exc}")
        return []

    items = []
    result_data = data.get("data", [])

    # Handle both list and dict formats
    if isinstance(result_data, dict):
        result_data = result_data.get("list", [])

    for item in result_data:
        try:
            title = item.get("title", "") or item.get("title_ch", "")
            if not title:
                continue

            # Parse notice date
            notice_date = item.get("notice_date", "") or ""
            if notice_date:
                try:
                    pub_date = datetime.fromisoformat(notice_date.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M:%S")
                except (ValueError, OSError):
                    pub_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            else:
                pub_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Extract stock codes from the codes array
            codes_info = item.get("codes", []) or []
            code = None
            stock_name = None
            if codes_info:
                first_code = codes_info[0] if isinstance(codes_info, list) else {}
                code = common.normalize_code(first_code.get("stock_code", ""))
                stock_name = first_code.get("short_name", "")

            # Extract announcement type from column_name
            columns = item.get("columns", []) or []
            column_names = []
            for col in columns:
                if isinstance(col, dict):
                    column_names.append(col.get("column_name", ""))

            # Source is column names or "东方财富"
            source = ",".join(column_names) if column_names else "东方财富"

            # Extract URL
            url = item.get("art_url", "") or ""

            # Extract summary from title (for now, use title as summary is not available)
            summary = ""

            # Determine news type from column names
            news_type = "公告"
            type_keywords = {
                "业绩": "业绩",
                "分红": "分红",
                "增持": "增持",
                "减持": "减持",
                "发行": "增发",
                "收购": "收购",
                "重大": "重大事项",
            }
            for kw, label in type_keywords.items():
                if kw in source or kw in title:
                    news_type = label
                    break

            items.append({
                "type": news_type,
                "code": code if code else None,
                "title": title,
                "source": source,
                "publishDate": pub_date,
                "url": url,
                "summary": summary,
                "sectors": None,  # Will be filled by impact matching
            })
        except Exception as exc:
            common.log(f"failed to parse news item: {exc}")
            continue

    return items


def persist_news(items: list[dict]) -> dict:
    """Insert news items into database."""
    # Load holding codes for impact matching
    holding_codes: set[str] = set()
    with common.connect() as conn:
        rows = conn.execute("SELECT code FROM Holding").fetchall()
        holding_codes = {row["code"] for row in rows}

    summary = {"total": 0, "inserted": 0, "skipped": 0, "impact": 0}
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

            # Mark as impact if code matches a holding
            code = item.get("code")
            impact = 1 if code and code in holding_codes else 0

            try:
                conn.execute("""
                    INSERT INTO NewsItem (type, code, title, source, publishDate, url, summary, sentiment, impactOnHolding, sectors)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'neutral', ?, NULL)
                """, (
                    item["type"],
                    code,
                    item["title"],
                    item.get("source"),
                    item["publishDate"],
                    url,
                    item.get("summary"),
                    impact,
                ))
                summary["inserted"] += 1
                if impact:
                    summary["impact"] += 1
            except Exception as exc:
                common.log(f"failed to insert news {item.get('title', '')[:50]}: {exc}")
                summary["skipped"] += 1
            summary["total"] += 1

    return summary


def main() -> int:
    print("Fetching news from East Money...")
    items = fetch_eastmoney_news()
    print(f"Fetched {len(items)} news items")

    if not items:
        print(json.dumps({"ok": True, "message": "no news fetched"}))
        return 0

    # Show code distribution
    code_count = sum(1 for item in items if item.get("code"))
    print(f"Items with stock code: {code_count}")

    summary = persist_news(items)
    print(f"Inserted: {summary['inserted']}, Skipped: {summary['skipped']}, Impact on holdings: {summary['impact']}")
    summary["ok"] = True
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
