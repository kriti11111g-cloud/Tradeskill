"""Tests for /api/wallet/summary and /api/wallet/spot behavior in real mode.

Regression around the geo-restricted Binance case: when the admin's key is
bound in real/testnet mode and Binance is unreachable from this server region,
the endpoint MUST NOT leak the demo wallet balance. Instead it should return
0 with a wallet_error message. It must also correctly report the demo balance
when the admin flips back to demo mode.
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASSWORD = "Admin@12345"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("token")
    assert token, f"no token in login response: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def bind_info(admin_session):
    r = admin_session.get(f"{API}/binance/bind")
    assert r.status_code == 200, f"binance/bind failed: {r.status_code} {r.text[:200]}"
    return r.json()


class TestWalletRealMode:
    def test_admin_is_in_real_mode(self, bind_info):
        # Sanity check: user's current mode should be real
        assert bind_info.get("mode") in ("real", "testnet"), (
            f"admin is not in real/testnet mode: {bind_info}"
        )

    def test_wallet_summary_real_mode_no_demo_leak(self, admin_session, bind_info):
        r = admin_session.get(f"{API}/wallet/summary")
        assert r.status_code == 200, r.text
        data = r.json()
        # Required new fields must be present
        for k in ("wallet_usdt", "wallet_mode", "wallet_connected", "wallet_error", "demo_wallet_usdt", "positions_value_usdt", "total_usdt", "positions"):
            assert k in data, f"missing key {k} in {data}"
        assert data["wallet_mode"] == bind_info["mode"]
        # If not connected, wallet_usdt must be 0 (never leak demo)
        if not data["wallet_connected"]:
            assert data["wallet_usdt"] == 0.0, f"wallet_usdt leaked demo? {data}"
            assert data["wallet_error"], "wallet_error should be present when not connected"
            # Should reflect our friendly geo-restriction copy
            assert "unreachable" in data["wallet_error"].lower() or "failed" in data["wallet_error"].lower()
        # demo_wallet_usdt is exposed for reference (~10357.6271 for this admin)
        assert isinstance(data["demo_wallet_usdt"], (int, float))
        # Positions still computed normally (list of dicts, numeric total)
        assert isinstance(data["positions"], list)
        assert isinstance(data["positions_value_usdt"], (int, float))

    def test_wallet_spot_real_mode_no_demo_leak(self, admin_session, bind_info):
        r = admin_session.get(f"{API}/wallet/spot")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mode"] == bind_info["mode"]
        if not data["connected"]:
            assert data["usdt_balance"] == 0.0, f"spot leaked demo? {data}"
            assert "error" in data and data["error"], "error field missing"

    def test_total_usdt_equals_wallet_plus_positions(self, admin_session):
        r = admin_session.get(f"{API}/wallet/summary")
        data = r.json()
        expected = round(data["wallet_usdt"] + data["positions_value_usdt"], 4)
        assert abs(data["total_usdt"] - expected) < 1e-4


class TestWalletDemoRegression:
    """Flip admin back to demo mode via DB, verify demo balance shows, then restore.

    Uses a direct MongoDB update because the app has no admin endpoint to
    toggle mode. We ALWAYS restore back to real at the end.
    """

    @pytest.fixture(scope="class")
    def db(self):
        from motor.motor_asyncio import AsyncIOMotorClient
        # Load backend/.env for MONGO_URL/DB_NAME
        import pathlib
        be_env = pathlib.Path(__file__).resolve().parents[1] / ".env"
        if be_env.exists():
            for line in be_env.read_text().splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        return client[os.environ["DB_NAME"]]

    @pytest.mark.asyncio
    async def test_demo_mode_shows_demo_balance(self, admin_session, db):
        # Find admin user
        admin = await db.users.find_one({"email": ADMIN_EMAIL})
        assert admin, "admin user not found"
        user_id = admin["id"]

        # Snapshot current binance_keys
        original = await db.binance_keys.find_one({"user_id": user_id})
        assert original, "admin binance_keys not found — cannot run regression"
        original_mode = original.get("mode")

        try:
            # Flip to demo
            await db.binance_keys.update_one({"user_id": user_id}, {"$set": {"mode": "demo"}})

            r = admin_session.get(f"{API}/wallet/summary")
            assert r.status_code == 200
            data = r.json()
            assert data["wallet_mode"] == "demo", data
            assert data["wallet_connected"] is False
            assert data["wallet_error"] is None, data
            # Should now expose the demo balance as wallet_usdt
            assert data["wallet_usdt"] > 0, f"demo balance not returned: {data}"
            assert abs(data["wallet_usdt"] - data["demo_wallet_usdt"]) < 1e-4
        finally:
            # Always restore original mode (real)
            await db.binance_keys.update_one(
                {"user_id": user_id}, {"$set": {"mode": original_mode}}
            )
            # Verify restore
            check = await db.binance_keys.find_one({"user_id": user_id})
            assert check.get("mode") == original_mode
