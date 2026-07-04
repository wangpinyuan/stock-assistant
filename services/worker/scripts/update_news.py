"""Update news from Sina Finance API."""

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


def fetch_sina_news() -> list[dict]:
    """Fetch news from Sina Finance API."""
    # News list API - lid 2516 is A-share news
    url = "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&num=50&page=1"
    req = urllib.request.Request(url, headers={
        "Referer": "https://finance.sina.com.cn",
        "User-Agent": "Mozilla/5.0"
    })

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        common.log(f"failed to fetch Sina news: {exc}")
        return []

    items = []
    if data.get("result") and data["result"].get("data"):
        for item in data["result"]["data"]:
            # Parse timestamp
            ctime = item.get("ctime", "")
            try:
                pub_date = datetime.fromtimestamp(int(ctime)).strftime("%Y-%m-%d %H:%M:%S") if ctime else ""
            except (ValueError, OSError):
                pub_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Determine news type from URL or content
            url_str = item.get("url", "")
            if "announcement" in url_str or "report" in url_str:
                news_type = "公告"
            elif "research" in url_str or "broker" in url_str:
                news_type = "研报"
            elif "finance" in url_str and ("stock" in url_str or "market" in url_str):
                news_type = "财经"
            else:
                news_type = "资讯"

            # Extract stock code from URL if present (e.g., /stock/sz000001/)
            code = None
            for prefix in ["sz", "sh"]:
                if prefix in url_str:
                    start = url_str.find(prefix)
                    if start != -1:
                        code_candidate = url_str[start:start+8]
                        code = common.normalize_code(code_candidate[2:])
                        break

            items.append({
                "type": news_type,
                "code": code,
                "title": item.get("title", ""),
                "source": item.get("media_name", ""),
                "publishDate": pub_date,
                "url": item.get("url", ""),
                "summary": item.get("intro", ""),
            })

    return items


def persist_news(items: list[dict]) -> dict:
    """Insert news items into database."""
    summary = {"total": 0, "inserted": 0, "skipped": 0}
    with common.connect() as conn:
        for item in items:
            if not item.get("title"):
                summary["skipped"] += 1
                continue

            # Check if URL already exists
            existing = conn.execute(
                "SELECT id FROM NewsItem WHERE url = ?",
                (item["url"],)
            ).fetchone()

            if existing:
                summary["skipped"] += 1
                continue

            try:
                conn.execute("""
                    INSERT INTO NewsItem (type, code, title, source, publishDate, url, summary, sentiment, impactOnHolding)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'neutral', 0)
                """, (
                    item["type"],
                    item["code"],
                    item["title"],
                    item["source"],
                    item["publishDate"],
                    item["url"],
                    item["summary"]
                ))
                summary["inserted"] += 1
            except Exception as exc:
                common.log(f"failed to insert news {item.get('title', '')[:50]}: {exc}")
                summary["skipped"] += 1
            summary["total"] += 1

    return summary


def main() -> int:
    print("Fetching news from Sina...")
    items = fetch_sina_news()
    print(f"Fetched {len(items)} news items")

    if not items:
        print(json.dumps({"ok": True, "message": "no news fetched"}))
        return 0

    summary = persist_news(items)
    summary["ok"] = True
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
