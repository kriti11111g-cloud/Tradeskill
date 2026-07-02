"""Backend tests for GET /api/wallet/spot (Binance Spot Wallet card).

Ensures the endpoint:
  * responds 200 for authenticated admin
  * returns JSON shape {mode, connected, usdt_balance}
  * falls back to demo when no Binance keys are bound
  * never returns 5xx (even if binance is geo-blocked/unreachable)
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tgx-api-gateway.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASSWORD = "Admin@12345"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json().get("token")
    assert token
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# --- Auth guard ---
class TestWalletSpotAuth:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/wallet/spot", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# --- Shape + demo fallback for admin (no binance bind) ---
class TestWalletSpotDemo:
    def test_admin_wallet_spot_returns_200(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/wallet/spot", timeout=15)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"

    def test_admin_wallet_spot_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/wallet/spot", timeout=15)
        data = r.json()
        assert set(["mode", "connected", "usdt_balance"]).issubset(data.keys()), f"missing keys: {data}"
        assert isinstance(data["connected"], bool)
        assert isinstance(data["usdt_balance"], (int, float))
        assert data["mode"] in ("demo", "real", "testnet")

    def test_admin_demo_mode_when_no_binance_bind(self, admin_client):
        # Ensure no bind is present before test
        try:
            admin_client.delete(f"{BASE_URL}/api/binance/bind", timeout=15)
        except Exception:
            pass
        r = admin_client.get(f"{BASE_URL}/api/wallet/spot", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["mode"] == "demo", f"expected demo, got {data}"
        assert data["connected"] is False
        # Should reflect the user's demo wallet_usdt
        assert data["usdt_balance"] > 0, f"expected positive demo balance, got {data['usdt_balance']}"

    def test_admin_balance_matches_wallet_summary(self, admin_client):
        """/wallet/spot demo balance should match /wallet/summary.wallet_usdt within a small tolerance."""
        spot = admin_client.get(f"{BASE_URL}/api/wallet/spot", timeout=15).json()
        summary = admin_client.get(f"{BASE_URL}/api/wallet/summary", timeout=15).json()
        # Allow tiny epsilon because summary rounds
        assert abs(spot["usdt_balance"] - summary["wallet_usdt"]) < 1.0, \
            f"spot={spot['usdt_balance']} vs summary={summary['wallet_usdt']}"


# --- Regression: revenue + transactions endpoints still healthy ---
class TestRegression:
    def test_revenue_summary_ok(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/revenue/summary", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "today_profit" in d and "total_profit" in d

    def test_transactions_ok(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/transactions", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_transactions_with_date_ok(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/transactions", params={"date": "2026-07-02"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_wallet_spot_never_5xx(self, admin_client):
        """Even if backend fails to reach binance, endpoint must not return 5xx."""
        r = admin_client.get(f"{BASE_URL}/api/wallet/spot", timeout=15)
        assert r.status_code < 500
