"""
TGX BOT — Drill-down feature tests.
Covers:
  - GET /api/transactions?symbol=... (uppercase normalisation)
  - GET /api/revenue/pair/{symbol}
  - GET /api/revenue/summary (by_symbol contract)
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASS = "Admin@12345"


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def seeded_sell(admin_token):
    """Force at least one SELL transaction on BTCUSDT for the admin user by
    injecting a bot position with a very low avg_price, then selling.
    Returns the symbol used ('BTCUSDT').
    """
    sym = "BTCUSDT"
    # Seed a cheap position so the SELL is profitable
    r = requests.post(
        f"{API}/bots/{sym}/position",
        headers=_headers(admin_token),
        json={"position_qty": 0.001, "avg_price": 1.0, "margin_call_count": 0},
        timeout=15,
    )
    assert r.status_code in (200, 201), f"seed position failed: {r.status_code} {r.text}"

    # Execute the SELL
    r2 = requests.post(
        f"{API}/trade/order",
        headers=_headers(admin_token),
        json={"symbol": sym, "side": "SELL"},
        timeout=20,
    )
    assert r2.status_code == 200, f"sell failed: {r2.status_code} {r2.text}"
    return sym


class TestTransactionsSymbolFilter:
    """GET /api/transactions?symbol=... — server-side filter."""

    def test_all_transactions_no_filter(self, admin_token):
        r = requests.get(f"{API}/transactions", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_filter_by_symbol_uppercase(self, admin_token, seeded_sell):
        sym = seeded_sell
        r = requests.get(
            f"{API}/transactions?symbol={sym}", headers=_headers(admin_token), timeout=15
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "expected at least one transaction after seeded SELL"
        for row in data:
            assert row["symbol"] == sym, f"unexpected symbol {row['symbol']} in filter={sym}"

    def test_filter_by_symbol_lowercase_normalized(self, admin_token, seeded_sell):
        """Server should uppercase the symbol query — 'btcusdt' must return BTCUSDT rows."""
        sym = seeded_sell.lower()
        r = requests.get(
            f"{API}/transactions?symbol={sym}", headers=_headers(admin_token), timeout=15
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        for row in data:
            assert row["symbol"] == seeded_sell

    def test_filter_unknown_symbol_returns_empty(self, admin_token):
        r = requests.get(
            f"{API}/transactions?symbol=ZZZUSDT",
            headers=_headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_unauth_filter_rejected(self):
        r = requests.get(f"{API}/transactions?symbol=BTCUSDT", timeout=10)
        assert r.status_code in (401, 403)


class TestRevenuePair:
    """GET /api/revenue/pair/{symbol}"""

    def test_pair_ok(self, admin_token, seeded_sell):
        r = requests.get(
            f"{API}/revenue/pair/{seeded_sell}", headers=_headers(admin_token), timeout=15
        )
        assert r.status_code == 200
        data = r.json()
        # Contract keys
        for key in ("symbol", "cumulative_profit", "today_profit", "sell_count"):
            assert key in data, f"missing key {key} in {data}"
        assert data["symbol"] == seeded_sell
        assert isinstance(data["sell_count"], int)
        assert data["sell_count"] >= 1
        assert isinstance(data["cumulative_profit"], (int, float))
        assert isinstance(data["today_profit"], (int, float))

    def test_pair_lowercase_normalized(self, admin_token, seeded_sell):
        r = requests.get(
            f"{API}/revenue/pair/{seeded_sell.lower()}",
            headers=_headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["symbol"] == seeded_sell

    def test_pair_unknown_symbol_returns_zero(self, admin_token):
        r = requests.get(
            f"{API}/revenue/pair/ZZZUSDT", headers=_headers(admin_token), timeout=15
        )
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "ZZZUSDT"
        assert d["sell_count"] == 0
        assert d["cumulative_profit"] == 0
        assert d["today_profit"] == 0

    def test_pair_unauth(self):
        r = requests.get(f"{API}/revenue/pair/BTCUSDT", timeout=10)
        assert r.status_code in (401, 403)


class TestRevenueSummaryContract:
    def test_summary_has_by_symbol(self, admin_token, seeded_sell):
        r = requests.get(f"{API}/revenue/summary", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "by_symbol" in d
        assert isinstance(d["by_symbol"], list)
        # ensure our seeded symbol is in the list
        symbols = {row["symbol"] for row in d["by_symbol"]}
        assert seeded_sell in symbols
        # per-symbol row schema
        row = next(row for row in d["by_symbol"] if row["symbol"] == seeded_sell)
        for key in ("symbol", "profit", "trades"):
            assert key in row
        assert row["trades"] >= 1
