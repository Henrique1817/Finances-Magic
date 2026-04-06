#!/usr/bin/env python3
import json
import sys
from datetime import datetime, timezone


def print_json(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))


def normalize_symbol(symbol: str) -> str:
    s = symbol.strip().upper()
    if s.endswith(".SA"):
        return s
    # Tickers brasileiros no formato PETR4 -> PETR4.SA
    if s.isalnum() and any(ch.isdigit() for ch in s) and len(s) <= 8:
        return f"{s}.SA"
    return s


def main():
    if len(sys.argv) < 2:
        print_json({"ok": False, "error": "missing_symbol"})
        return 1

    raw_symbol = sys.argv[1].strip()
    symbol = normalize_symbol(raw_symbol)
    period = sys.argv[2].strip() if len(sys.argv) >= 3 else "2y"

    try:
        import yfinance as yf  # type: ignore
    except Exception:
        print_json({"ok": False, "error": "yfinance_not_installed"})
        return 2

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval="1d", auto_adjust=False)
        if hist is None or hist.empty:
            print_json({"ok": True, "rows": []})
            return 0

        rows = []
        for idx, row in hist.iterrows():
            close = row.get("Close")
            if close is None:
                continue
            close_num = float(close)
            if not close_num or close_num <= 0:
                continue

            if hasattr(idx, "to_pydatetime"):
                dt = idx.to_pydatetime()
            elif isinstance(idx, datetime):
                dt = idx
            else:
                continue

            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)

            rows.append(
                {
                    "date": dt.date().isoformat(),
                    "close": f"{close_num:.8f}",
                }
            )

        rows.sort(key=lambda x: x["date"], reverse=True)
        print_json({"ok": True, "rows": rows})
        return 0
    except Exception as exc:
        print_json({"ok": False, "error": f"runtime_error:{str(exc)}"})
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
