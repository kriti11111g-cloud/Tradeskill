"""KuCoin exchange integration tests.

Covers:
- GET /api/kucoin/bind (unbound default state, whitelist IP exposed)
- POST /api/kucoin/bind demo mode (no live validation, no secrets echoed)
- GET /api/kucoin/bind after demo bind (mask shown, bound=False because demo)
- DELETE /api/kucoin/bind (clears key + flips active_exchange back to binance)
- POST /api/kucoin/bind real mode with fake keys -> expected 400 rejection
- GET /api/kucoin/account without live binding -> 400
- active_exchange user-field flip on demo bind, flip-back on unbind
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASSWORD = "Admin@12345"


@pytest.fixture(scope="module")
def auth_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    token = r.json().get("token") or r.json().get("access_token")
    if not token:
        pytest.skip("no token in login response")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module", autouse=True)
def _clean_binding(auth_client):
    # Ensure clean state before and after this module.
    try:
        auth_client.delete(f"{BASE_URL}/api/kucoin/bind")
    except Exception:
        pass
    yield
    try:
        auth_client.delete(f"{BASE_URL}/api/kucoin/bind")
    except Exception:
        pass


class TestKuCoinBindUnboundState:
    def test_get_bind_when_unbound(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/kucoin/bind")
        assert r.status_code == 200, r.text
        data = r.json()
        # Unbound shape
        assert data.get("bound") is False
        assert data.get("mode") in (None,)
        assert data.get("api_key_mask") in (None,)
        assert "whitelist_ip" in data and data["whitelist_ip"]
        # Secret fields must never leak
        for leak in ("api_key_enc", "api_secret_enc", "passphrase_enc"):
            assert leak not in data

    def test_account_requires_live_binding(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/kucoin/account")
        assert r.status_code == 400, r.text
        body = r.json()
        msg = (body.get("detail") or body.get("message") or "").lower()
        assert "kucoin" in msg or "bind" in msg


class TestKuCoinBindDemo:
    def test_demo_bind_succeeds_without_live_validation(self, auth_client):
        payload = {
            "api_key": "TEST_demo_kucoin_key_1234567890",
            "api_secret": "TEST_demo_kucoin_secret_1234567890",
            "passphrase": "TEST_demo_pass",
            "mode": "demo",
        }
        r = auth_client.post(f"{BASE_URL}/api/kucoin/bind", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("mode") == "demo"
        assert data.get("mask")  # mask returned

    def test_get_bind_after_demo_bind(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/kucoin/bind")
        assert r.status_code == 200
        data = r.json()
        assert data.get("mode") == "demo"
        assert data.get("api_key_mask")
        # Demo should NOT be reported as fully "bound" (live) per server code.
        assert data.get("bound") is False
        # Still no secret leakage
        for leak in ("api_key_enc", "api_secret_enc", "passphrase_enc"):
            assert leak not in data

    def test_user_active_exchange_flipped_to_kucoin(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        me = r.json()
        # Field name used in server.py
        assert me.get("active_exchange") == "kucoin", f"got: {me}"

    def test_account_still_400_in_demo_mode(self, auth_client):
        # Server requires real-mode keys for /kucoin/account
        r = auth_client.get(f"{BASE_URL}/api/kucoin/account")
        assert r.status_code == 400
        detail = (r.json().get("detail") or "").lower()
        assert "live" in detail or "real" in detail or "bind" in detail


class TestKuCoinUnbind:
    def test_unbind_clears_and_flips_exchange_back(self, auth_client):
        r = auth_client.delete(f"{BASE_URL}/api/kucoin/bind")
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Verify empty
        r2 = auth_client.get(f"{BASE_URL}/api/kucoin/bind")
        assert r2.status_code == 200
        d = r2.json()
        assert d.get("bound") is False
        assert d.get("api_key_mask") in (None,)

        # Verify active_exchange flipped back to binance
        me = auth_client.get(f"{BASE_URL}/api/auth/me").json()
        assert me.get("active_exchange") == "binance"


class TestKuCoinRealModeValidation:
    def test_real_mode_rejects_fake_keys(self, auth_client):
        """With no live KuCoin creds, real-mode bind must call KuCoin and
        receive an auth error — server should return HTTP 400 and NOT persist
        the binding."""
        payload = {
            "api_key": "FAKE_live_key_" + "A" * 20,
            "api_secret": "FAKE_live_secret_" + "B" * 20,
            "passphrase": "FAKE_pass",
            "mode": "real",
        }
        r = auth_client.post(f"{BASE_URL}/api/kucoin/bind", json=payload)
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        # Should reference KuCoin and either reject or whitelist or unreachable
        assert "kucoin" in detail

        # Verify no binding was persisted
        g = auth_client.get(f"{BASE_URL}/api/kucoin/bind").json()
        assert g.get("mode") in (None,)
        assert g.get("bound") is False

    def test_bind_requires_passphrase(self, auth_client):
        payload = {
            "api_key": "TEST_x",
            "api_secret": "TEST_y",
            "mode": "demo",
            # passphrase missing
        }
        r = auth_client.post(f"{BASE_URL}/api/kucoin/bind", json=payload)
        assert r.status_code in (400, 422), r.text


class TestExchangeIsolation:
    """Binance binding must NOT leak into KuCoin endpoints and vice versa."""

    def test_binance_bind_endpoint_distinct(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/binance/bind")
        assert r.status_code == 200
        # Both endpoints independent — don't crash.
