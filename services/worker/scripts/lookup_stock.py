"""Look up stock info by code from Sina Finance or Yahoo Finance."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from typing import Optional


# Yahoo Finance symbol mapping for US indices
YAHOO_SYMBOLS = {
    "usixic": "^IXIC",   # 纳斯达克综合指数
    "usspx": "^SPX",     # 标普500
    "usndx": "^NDX",     # 纳斯达克100
    "usdji": "^DJI",     # 道琼斯
}

# Sina market prefix mapping
SINA_PREFIXES = {
    "hk": "hk",          # 香港
}


def get_market_prefix(code: str) -> str:
    """Determine Sina market prefix for a code."""
    normalized = code.strip()
    # Special prefixes for non-A-share indices (check before digit logic)
    if normalized.startswith("hk"):
        return "hk"
    if normalized.startswith("us"):
        return "us"  # US indices handled separately
    # Pad numeric codes to 6 digits
    normalized = normalized.zfill(6)
    # Shanghai: 6xxxx, 5xxxx, 9xxxx (stocks) OR 000xxx (indices like 000300, 000905)
    # Shenzhen: 001xxx, 002xxx, 300xxx (stocks) OR 399xxx (indices like 399006)
    if normalized.startswith(("6", "5", "9")):
        return "sh"
    if normalized.startswith("000") or normalized.startswith("399"):
        return "sh"
    return "sz"


def fetch_from_yahoo(symbol: str) -> Optional[dict]:
    """Fetch index data from Yahoo Finance."""
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        result = data.get("chart", {}).get("result", [])
        if not result:
            return None
        timestamps = result[0].get("timestamp", [])
        quotes = result[0].get("indicators", {}).get("quote", [{}])[0]
        closes = quotes.get("close", [])
        if len(closes) >= 2:
            prev_close = closes[-2]
            current = closes[-1]
            if current is not None and prev_close is not None and prev_close != 0:
                change = current - prev_close
                pct = round(change / prev_close * 100, 2)
                return {"price": round(current, 2), "change": round(change, 2), "pct": pct}
        return None
    except Exception:
        return None


def lookup(code: str) -> dict:
    try:
        normalized = code.strip().zfill(6)
        market = get_market_prefix(normalized)
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
        # For indices: field[1] is prevClose, field[3] is current price
        # For stocks: field[2] is prevClose, field[3] is current price
        is_index = normalized.startswith(("000", "399"))
        prev_close = float(fields[1]) if is_index else float(fields[2])
        current_price = float(fields[3]) if fields[3] and fields[3] != "-" else None
        change = None
        change_pct = None
        if current_price is not None and prev_close is not None and prev_close != 0:
            change = current_price - prev_close
            change_pct = round(change / prev_close * 100, 2)
        return {
            "ok": True,
            "code": normalized,
            "name": name,
            "price": current_price,
            "change": round(change, 2) if change is not None else None,
            "pct": change_pct,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def lookup_batch(codes: list[str]) -> dict:
    try:
        items = []
        for code in codes:
            original_code = code.strip()
            if not original_code:
                continue

            # Handle US indices via Yahoo Finance (no zfill needed)
            if original_code.startswith("us"):
                yahoo_sym = YAHOO_SYMBOLS.get(original_code)
                if not yahoo_sym:
                    continue
                time.sleep(0.5)  # Rate limit delay before Yahoo request
                data = fetch_from_yahoo(yahoo_sym)
                if data:
                    # Get display name from mapping
                    name_map = {"usixic": "纳斯达克", "usspx": "标普500", "usndx": "纳斯达克100", "usdji": "道琼斯"}
                    items.append({
                        "code": original_code,
                        "name": name_map.get(original_code, yahoo_sym),
                        "price": data["price"],
                        "change": data["change"],
                        "pct": data["pct"],
                    })
                continue

            # Detect market prefix before stripping
            market_prefix = ""
            normalized = original_code
            if normalized.startswith(("sh", "sz", "hk")):
                market_prefix = normalized[:2]
                normalized = normalized[2:]

            # Pad to 6 digits for A-shares (numeric codes only)
            if normalized.isdigit():
                normalized = normalized.zfill(6)

            # Use detected prefix if available, otherwise determine from code
            if not market_prefix:
                market = get_market_prefix(normalized)
            else:
                market = market_prefix

            if market == "hk":
                url = f"https://hq.sinajs.cn/list={market_prefix}{normalized}"
            else:
                url = f"https://hq.sinajs.cn/list={market}{normalized}"
            req = urllib.request.Request(url, headers={
                "Referer": "https://finance.sina.com.cn",
                "User-Agent": "Mozilla/5.0"
            })
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = resp.read().decode("gbk", errors="replace")
            except:
                continue
            m = re.search(r'"([^"]*)"', data)
            if not m or not m.group(1):
                continue
            fields = m.group(1).split(",")
            if len(fields) < 10:
                continue
            name = fields[0]
            is_hk_index = market_prefix == "hk"
            is_a_index = normalized.startswith(("000", "399"))
            if is_hk_index:
                # HK index format: fields[0]=symbol, fields[1]=name, fields[2]=current, fields[3]=prev_close
                prev_close = float(fields[3]) if fields[3] and fields[3] != "-" else None
                current_price = float(fields[2]) if fields[2] and fields[2] != "-" else None
                name = fields[1]  # Use Chinese name from fields[1]
            elif is_a_index:
                # A-share index: fields[1]=prev_close, fields[3]=current
                prev_close = float(fields[1]) if fields[1] and fields[1] != "-" else None
                current_price = float(fields[3]) if fields[3] and fields[3] != "-" else None
            else:
                # Stocks: fields[2]=prev_close, fields[3]=current
                prev_close = float(fields[2]) if fields[2] and fields[2] != "-" else None
                current_price = float(fields[3]) if fields[3] and fields[3] != "-" else None
            change = None
            change_pct = None
            if current_price is not None and prev_close is not None and prev_close != 0:
                change = current_price - prev_close
                change_pct = round(change / prev_close * 100, 2)
            items.append({
                "code": original_code,
                "name": name,
                "price": current_price,
                "change": round(change, 2) if change is not None else None,
                "pct": change_pct,
            })
        return {"ok": True, "items": items}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Look up stock info by code")
    parser.add_argument("code", help="Stock code or comma-separated codes")
    parser.add_argument("--batch", action="store_true", help="Batch mode for multiple codes")
    args = parser.parse_args()

    if args.batch:
        codes = [c.strip() for c in args.code.split(",") if c.strip()]
        result = lookup_batch(codes)
    else:
        codes = [c.strip() for c in args.code.split(",") if c.strip()]
        if len(codes) == 1:
            result = lookup(codes[0])
        else:
            result = lookup_batch(codes)

    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
