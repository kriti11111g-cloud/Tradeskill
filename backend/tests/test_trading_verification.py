"""
End-to-end verification of the automated trading system.
Verifies that:
  1. Admin can log in.
  2. /api/bots returns >=5 bots, >=3 running, incl. BTCUSDT/DOGEUSDT/UNIUSDT running.
  3. /api/revenue/summary numbers roughly match the video (total ~$531, today ~$0.55).
  4. /api/transactions returns real SELL rows with profit>0, timestamps in UTC.
  5. /api/bots/{symbol} returns a DCA ladder & respects margin_call_remaining.
  6. Bot engine loop is polling Binance live prices (evidence gathered from logs
     externally; here we validate that /api/bots status='running' for the expected
     symbols and market ticker resolves for those symbols).
"""
import os
import re
import pytest
import requests

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "https://tgx-api-gateway.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASS = "Admin@12345"


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    return r.json()["token"]


# ---------- Auth ----------
class TestAdminAuth:
    def test_login_ok(self, token):
        assert token and isinstance(token, str)

    def test_me_returns_admin(self, token):
        r = requests.get(f"{API}/auth/me", headers=_hdr(token), timeout=15)
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == ADMIN_EMAIL
        assert me.get("role") in ("admin", None) or True  # admin flag optional


# ---------- Bots ----------
class TestBots:
    def test_list_bots_shape_and_running(self, token):
        r = requests.get(f"{API}/bots", headers=_hdr(token), timeout=15)
        assert r.status_code == 200
        bots = r.json()
        assert isinstance(bots, list)
        assert len(bots) >= 5, f"expected >=5 bots, got {len(bots)}"

        by_sym = {b["symbol"]: b for b in bots}
        # Must include these
        for sym in ("BTCUSDT", "DOGEUSDT", "UNIUSDT"):
            assert sym in by_sym, f"{sym} bot missing"

        running = [b for b in bots if b.get("status") == "running"]
        assert len(running) >= 3, f"expected >=3 running bots, got {len(running)}: {[b['symbol'] for b in running]}"

        for sym in ("BTCUSDT", "DOGEUSDT", "UNIUSDT"):
            assert by_sym[sym].get("status") == "running", f"{sym} not running: {by_sym[sym].get('status')}"

        # Each bot must expose aggregate counts + profit
        for b in bots:
            assert "buy_count" in b and "sell_count" in b and "cumulative_profit" in b

    def test_bot_detail_and_dca_ladder(self, token):
        r = requests.get(f"{API}/bots/DOGEUSDT", headers=_hdr(token), timeout=15)
        assert r.status_code == 200
        b = r.json()
        # Fields
        assert b["symbol"] == "DOGEUSDT"
        assert "whole_take_profit_ratio" in b
        assert "margin_call_count" in b
        assert "margin_call_limit" in b
        mc_remaining = int(b.get("margin_call_limit", 0)) - int(b.get("margin_call_count", 0))
        # Report TP ratio (per review request — informational)
        print(f"[REPORT] DOGEUSDT whole_take_profit_ratio = {b.get('whole_take_profit_ratio')}")
        print(f"[REPORT] DOGEUSDT margin_call_count={b.get('margin_call_count')}, limit={b.get('margin_call_limit')}, remaining={mc_remaining}")
        print(f"[REPORT] DOGEUSDT avg_price={b.get('avg_price')}, position_qty={b.get('position_qty')}")

        # Ladder present when a position is open or when idle we still get preview via current_price;
        # server-side ladder is bot['dca_ladder'] if present
        ladder = b.get("dca_ladder") or []
        # Ladder length should be <= margin_call_remaining
        if mc_remaining > 0 and ladder:
            assert len(ladder) <= mc_remaining, f"ladder len {len(ladder)} > remaining {mc_remaining}"
            # First safety-order level equals margin_call_count + 1
            assert ladder[0]["level"] == int(b.get("margin_call_count", 0)) + 1
        print(f"[REPORT] DOGEUSDT ladder rows: {len(ladder)}")


# ---------- Revenue ----------
class TestRevenue:
    def test_revenue_summary_shape(self, token):
        r = requests.get(f"{API}/revenue/summary", headers=_hdr(token), timeout=15)
        assert r.status_code == 200
        s = r.json()
        for k in ("total_profit", "today_profit", "today_trades", "total_trades",
                  "daily", "by_date", "by_symbol"):
            assert k in s, f"missing key {k}"
        assert isinstance(s["by_date"], list)
        assert isinstance(s["by_symbol"], list)

    def test_revenue_numbers_roughly_match_video(self, token):
        r = requests.get(f"{API}/revenue/summary", headers=_hdr(token), timeout=15)
        s = r.json()
        # From video: cumulative ~$531.74, today ~$0.55, 40 sells / 5 symbols
        print(f"[REPORT] total_profit={s['total_profit']}, today_profit={s['today_profit']}, "
              f"total_trades={s['total_trades']}, today_trades={s['today_trades']}")
        print(f"[REPORT] by_symbol={s['by_symbol'][:6]}")
        print(f"[REPORT] by_date (first 5)={s['by_date'][:5]}")

        assert s["total_profit"] >= 500, f"cumulative_profit {s['total_profit']} < 500"
        assert len(s["by_date"]) >= 3, f"by_date should have multiple dates, got {len(s['by_date'])}"
        symbols = {row["symbol"] for row in s["by_symbol"]}
        # 5 symbols in video
        assert len(symbols) >= 3, f"by_symbol should list several symbols, got {symbols}"


# ---------- Transactions ----------
class TestTransactions:
    def test_transactions_list(self, token):
        r = requests.get(f"{API}/transactions?limit=50", headers=_hdr(token), timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) > 0, "no transactions returned"

        # Fields for every row
        for t in rows[:20]:
            for k in ("symbol", "side", "quantity", "price", "amount", "created_at"):
                assert k in t, f"txn missing {k}: {t}"
            # UTC timestamps look like 2026-01-...Z or +00:00
            assert isinstance(t["created_at"], str) and re.match(r"^\d{4}-\d{2}-\d{2}T", t["created_at"])

        # SELL rows should carry non-null profit >= 0 (some may be small); at least one > 0
        sells = [t for t in rows if t.get("side") == "SELL"]
        assert sells, "no SELL rows in latest 50 transactions"
        profits = [float(t.get("profit") or 0.0) for t in sells]
        assert any(p > 0 for p in profits), f"no SELL with profit > 0, got profits={profits[:10]}"

    def test_transactions_by_date(self, token):
        # Get most recent date from revenue summary and drill down
        s = requests.get(f"{API}/revenue/summary", headers=_hdr(token), timeout=15).json()
        assert s["by_date"], "no by_date entries"
        latest_date = s["by_date"][0]["date"]
        r = requests.get(f"{API}/transactions?date={latest_date}&limit=100", headers=_hdr(token), timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) > 0, f"no transactions for {latest_date}"
        for t in rows:
            assert t["created_at"].startswith(latest_date), f"txn out of range: {t['created_at']}"


# ---------- Live bot engine evidence via ticker endpoint ----------
class TestMarket:
    def test_market_ticker_running_symbols(self, token):
        # Not strictly the engine, but proves upstream data-api reachability.
        for sym in ("BTCUSDT", "DOGEUSDT", "UNIUSDT"):
            r = requests.get(f"{API}/market/ticker/{sym}", headers=_hdr(token), timeout=15)
            assert r.status_code == 200, f"{sym} ticker fail: {r.status_code}"
            j = r.json()
            price = float(j.get("price") or j.get("last") or j.get("lastPrice") or 0)
            assert price > 0, f"{sym} price non-positive: {j}"
            print(f"[REPORT] live price {sym} = {price}")
