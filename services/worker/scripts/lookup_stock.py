"""Look up stock info by code from Sina Finance."""

import argparse
import json
import re
import sys
import urllib.request


def lookup(code: str) -> dict:
    try:
        normalized = code.strip().zfill(6)
        market = "sh" if normalized.startswith(("6", "5")) else "sz"
        url = f"https://hq.sinajs.cn/list={market}{normalized}"
        req = urllib.request.Request(url, headers={
            "Referer": "https://finance.sina.com.cn",
            "User-Agent": "Mozilla/5.0"
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode("gbk", errors="replace")
        m = re.search(r'"([^"]*)"', data)
        if not m or not m.group(1):
            return {"ok": False, "error": "股票代码不存在"}
        fields = m.group(1).split(",")
        if len(fields) < 10:
            return {"ok": False, "error": "股票数据格式错误"}
        name = fields[0]
        current_price = float(fields[3]) if fields[3] else None
        prev_close = float(fields[2]) if fields[2] else None
        change = None
        change_pct = None
        if current_price is not None and prev_close is not None and prev_close != 0:
            change = current_price - prev_close
            change_pct = round(change / prev_close * 100, 2)
        return {
            "ok": True,
            "code": normalized,
            "name": name,
            "currentPrice": current_price,
            "changePercent": change_pct,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Look up stock info by code")
    parser.add_argument("code", help="Stock code")
    args = parser.parse_args()
    result = lookup(args.code)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
