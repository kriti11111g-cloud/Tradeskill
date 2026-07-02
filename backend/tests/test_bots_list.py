"""
Tests for GET /api/bots — verifies the newly-added aggregation fields
(buy_count, sell_count, cumulative_profit) attached to each bot doc
from the underlying db.transactions collection.
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASSWORD = "Admin@12345"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


class TestBotsList:
    """GET /api/bots aggregation"""

    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/bots")
        assert r.status_code == 401

    def test_returns_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/bots")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_each_bot_has_aggregate_fields(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/bots")
        assert r.status_code == 200
        bots = r.json()
        for b in bots:
            assert "symbol" in b
            assert "buy_count" in b, f"missing buy_count on {b.get('symbol')}"
            assert "sell_count" in b, f"missing sell_count on {b.get('symbol')}"
            assert "cumulative_profit" in b, f"missing cumulative_profit on {b.get('symbol')}"
            assert isinstance(b["buy_count"], int)
            assert isinstance(b["sell_count"], int)
            assert isinstance(b["cumulative_profit"], (int, float))

    def test_admin_expected_bots_present(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/bots")
        bots = {b["symbol"]: b for b in r.json()}
        # Admin should have BTCUSDT, DOGEUSDT, SOLUSDT, XRPUSDT
        for sym in ["BTCUSDT", "DOGEUSDT", "SOLUSDT", "XRPUSDT"]:
            assert sym in bots, f"expected bot for {sym} missing. Got: {list(bots.keys())}"

    def test_btcusdt_expected_counts_and_profit(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/bots")
        bots = {b["symbol"]: b for b in r.json()}
        btc = bots.get("BTCUSDT")
        assert btc is not None
        # Spec: buys=8 sells=9 profit≈443.39
        assert btc["buy_count"] == 8, f"BTC buy_count expected 8, got {btc['buy_count']}"
        assert btc["sell_count"] == 9, f"BTC sell_count expected 9, got {btc['sell_count']}"
        assert abs(btc["cumulative_profit"] - 443.39) < 1.0, (
            f"BTC cumulative_profit expected ~443.39, got {btc['cumulative_profit']}"
        )

    def test_dogeusdt_expected(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/bots")
        bots = {b["symbol"]: b for b in r.json()}
        doge = bots.get("DOGEUSDT")
        assert doge is not None
        assert doge["buy_count"] == 1, f"DOGE buy_count expected 1, got {doge['buy_count']}"
        assert doge["sell_count"] == 0, f"DOGE sell_count expected 0, got {doge['sell_count']}"
        assert doge["cumulative_profit"] == 0, f"DOGE profit expected 0, got {doge['cumulative_profit']}"

    def test_solusdt_expected(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/bots")
        bots = {b["symbol"]: b for b in r.json()}
        sol = bots.get("SOLUSDT")
        assert sol is not None
        assert sol["buy_count"] == 2, f"SOL buy_count expected 2, got {sol['buy_count']}"
        assert sol["sell_count"] == 2, f"SOL sell_count expected 2, got {sol['sell_count']}"
        assert abs(sol["cumulative_profit"] - 29.17) < 1.0, (
            f"SOL cumulative_profit expected ~29.17, got {sol['cumulative_profit']}"
        )

    def test_xrpusdt_expected(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/bots")
        bots = {b["symbol"]: b for b in r.json()}
        xrp = bots.get("XRPUSDT")
        assert xrp is not None
        assert xrp["buy_count"] == 1, f"XRP buy_count expected 1, got {xrp['buy_count']}"
        assert xrp["sell_count"] == 2, f"XRP sell_count expected 2, got {xrp['sell_count']}"
        assert abs(xrp["cumulative_profit"] - 6.12) < 1.0, (
            f"XRP cumulative_profit expected ~6.12, got {xrp['cumulative_profit']}"
        )

    def test_bot_docs_include_position_fields(self, admin_client):
        """BTC/DOGE should have position_qty>0 (open positions), SOL/XRP position_qty==0."""
        r = admin_client.get(f"{BASE_URL}/api/bots")
        bots = {b["symbol"]: b for b in r.json()}
        assert bots["BTCUSDT"].get("position_qty", 0) > 0
        assert bots["SOLUSDT"].get("position_qty", 0) == 0
        assert bots["XRPUSDT"].get("position_qty", 0) == 0

    def test_no_mongo_oid_leak(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/bots")
        for b in r.json():
            assert "_id" not in b


class TestRegressions:
    """Regressions for revenue/transactions endpoints touched by the previous iterations."""

    def test_revenue_summary_ok(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/revenue/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_profit", "today_profit", "daily", "by_date", "by_symbol"]:
            assert k in d

    def test_transactions_date_filter(self, admin_client):
        # Use a date returned by revenue summary
        summ = admin_client.get(f"{BASE_URL}/api/revenue/summary").json()
        if summ["by_date"]:
            some_date = summ["by_date"][0]["date"]
            r = admin_client.get(f"{BASE_URL}/api/transactions", params={"date": some_date})
            assert r.status_code == 200
            rows = r.json()
            assert isinstance(rows, list)
            for row in rows:
                assert row["created_at"][:10] == some_date

    def test_transactions_symbol_filter(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/transactions", params={"symbol": "BTCUSDT"})
        assert r.status_code == 200
        rows = r.json()
        for row in rows:
            assert row["symbol"] == "BTCUSDT"

    def test_revenue_pair_btc(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/revenue/pair/BTCUSDT")
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "BTCUSDT"
        for k in ["cumulative_profit", "buy_count", "sell_count"]:
            assert k in d
