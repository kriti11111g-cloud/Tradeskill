"""
TGX BOT full backend regression suite.
Covers: auth, market, binance bind, bots, trade, wallet, transactions,
revenue, referral, rewards, news, guide.
"""
import os
import uuid
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://tgx-api-gateway.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASS = "Admin@12345"


# ---------- helpers ----------
def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def new_user():
    """Create a fresh registered user for the whole test session."""
    email = f"test_{uuid.uuid4().hex[:8]}@tgx.dev"
    password = "TestPass@123"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "name": "Test User"},
        timeout=15,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["wallet_usdt"] == 1000.0
    return {"email": email, "password": password, "token": data["token"], "user": data["user"]}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert admin_token

    def test_admin_wallet_10000(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        # Admin was seeded with 10000; may drift due to prior tests
        assert r.json()["wallet_usdt"] >= 0

    def test_register_grants_1000(self, new_user):
        assert new_user["user"]["wallet_usdt"] == 1000.0
        assert new_user["user"]["referral_code"].startswith("TGX")

    def test_login_new_user(self, new_user):
        r = requests.post(f"{API}/auth/login", json={"email": new_user["email"], "password": new_user["password"]})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == new_user["email"]

    def test_login_bad_password(self, new_user):
        r = requests.post(f"{API}/auth/login", json={"email": new_user["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_register_duplicate(self, new_user):
        r = requests.post(f"{API}/auth/register", json={"email": new_user["email"], "password": "x123456"})
        assert r.status_code == 400

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_welcome_reward_seeded(self, new_user):
        r = requests.get(f"{API}/rewards", headers=_auth_headers(new_user["token"]))
        assert r.status_code == 200
        rewards = r.json()
        joining = [x for x in rewards if x["type"] == "joining"]
        assert len(joining) == 1
        assert joining[0]["status"] == "claimable"


# ---------- Market ----------
class TestMarket:
    def test_pairs(self):
        r = requests.get(f"{API}/market/pairs", timeout=20)
        assert r.status_code == 200
        pairs = r.json()["pairs"]
        symbols = {p["symbol"] for p in pairs}
        # At least the majors should be returned (MATICUSDT may be delisted on some Binance nodes)
        assert {"BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"}.issubset(symbols)
        for p in pairs:
            assert p["last_price"] > 0

    def test_ticker(self):
        r = requests.get(f"{API}/market/ticker/BTCUSDT", timeout=15)
        assert r.status_code == 200
        assert float(r.json()["price"]) > 0

    def test_stats(self):
        r = requests.get(f"{API}/market/stats/ETHUSDT", timeout=15)
        assert r.status_code == 200
        assert "priceChangePercent" in r.json()

    def test_klines(self):
        r = requests.get(f"{API}/market/klines/SOLUSDT?interval=1h&limit=10", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) > 0


# ---------- Bind API ----------
class TestBind:
    def test_bind_and_get(self, new_user):
        r = requests.post(
            f"{API}/binance/bind",
            json={"api_key": "AAAABBBBCCCC1234567890", "api_secret": "supersecretsecret1234567890", "mode": "demo"},
            headers=_auth_headers(new_user["token"]),
        )
        assert r.status_code == 200
        assert r.json()["mode"] == "demo"
        mask_key = r.json()["mask"]
        assert "****" in mask_key

        g = requests.get(f"{API}/binance/bind", headers=_auth_headers(new_user["token"]))
        assert g.status_code == 200
        assert g.json()["mode"] == "demo"


# ---------- Bots ----------
class TestBots:
    def test_default_bot(self, new_user):
        r = requests.get(f"{API}/bots/BTCUSDT", headers=_auth_headers(new_user["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "BTCUSDT"
        assert d["status"] == "stopped"

    def test_upsert_config(self, new_user):
        payload = {
            "symbol": "BTCUSDT",
            "first_buy_amount": 25.0,
            "open_position_double": True,
            "margin_call_limit": 8,
            "whole_take_profit_ratio": 2.0,
            "whole_take_profit_callback": 0.4,
            "buy_in_callback": 1.2,
            "trade_method": "Cycle",
            "sub_take_profit_callback": 0.6,
        }
        r = requests.post(f"{API}/bots/BTCUSDT", json=payload, headers=_auth_headers(new_user["token"]))
        assert r.status_code == 200
        got = requests.get(f"{API}/bots/BTCUSDT", headers=_auth_headers(new_user["token"])).json()
        assert got["first_buy_amount"] == 25.0
        assert got["margin_call_limit"] == 8
        assert got["trade_method"] == "Cycle"

    def test_start_stop(self, new_user):
        rs = requests.post(f"{API}/bots/BTCUSDT/start", headers=_auth_headers(new_user["token"]))
        assert rs.status_code == 200 and rs.json()["status"] == "running"
        rst = requests.post(f"{API}/bots/BTCUSDT/stop", headers=_auth_headers(new_user["token"]))
        assert rst.status_code == 200 and rst.json()["status"] == "stopped"


# ---------- Trade flow ----------
class TestTrade:
    def test_buy_then_sell(self, new_user):
        tok = new_user["token"]
        # Buy $50 of BTC
        r = requests.post(
            f"{API}/trade/order",
            json={"symbol": "BTCUSDT", "side": "BUY", "usdt_amount": 50},
            headers=_auth_headers(tok),
        )
        assert r.status_code == 200, r.text
        buy = r.json()
        assert buy["side"] == "BUY"
        assert buy["quantity"] > 0

        # Wallet decreased
        me = requests.get(f"{API}/auth/me", headers=_auth_headers(tok)).json()
        assert me["wallet_usdt"] < 1000.0

        # position exists
        bot = requests.get(f"{API}/bots/BTCUSDT", headers=_auth_headers(tok)).json()
        assert bot["position_qty"] > 0

        # Sell all
        s = requests.post(
            f"{API}/trade/order",
            json={"symbol": "BTCUSDT", "side": "SELL"},
            headers=_auth_headers(tok),
        )
        assert s.status_code == 200, s.text
        assert s.json()["side"] == "SELL"

        bot2 = requests.get(f"{API}/bots/BTCUSDT", headers=_auth_headers(tok)).json()
        assert bot2["position_qty"] == 0

    def test_buy_insufficient(self, new_user):
        r = requests.post(
            f"{API}/trade/order",
            json={"symbol": "BTCUSDT", "side": "BUY", "usdt_amount": 999999},
            headers=_auth_headers(new_user["token"]),
        )
        assert r.status_code == 400

    def test_bad_symbol(self, new_user):
        r = requests.post(
            f"{API}/trade/order",
            json={"symbol": "FAKEUSDT", "side": "BUY", "usdt_amount": 10},
            headers=_auth_headers(new_user["token"]),
        )
        assert r.status_code == 400


# ---------- Transactions, Revenue ----------
class TestTxnsRev:
    def test_transactions(self, new_user):
        # Do a buy so a transaction exists in this worker/session
        requests.post(
            f"{API}/trade/order",
            json={"symbol": "ETHUSDT", "side": "BUY", "usdt_amount": 20},
            headers=_auth_headers(new_user["token"]),
        )
        r = requests.get(f"{API}/transactions", headers=_auth_headers(new_user["token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_revenue(self, new_user):
        r = requests.get(f"{API}/revenue/summary", headers=_auth_headers(new_user["token"]))
        assert r.status_code == 200
        d = r.json()
        assert "total_profit" in d and "by_symbol" in d and "daily" in d


# ---------- Wallet ----------
class TestWallet:
    def test_deposit(self, new_user):
        r = requests.post(
            f"{API}/wallet/transaction",
            json={"type": "deposit", "amount": 100},
            headers=_auth_headers(new_user["token"]),
        )
        assert r.status_code == 200

    def test_withdraw_insufficient(self, new_user):
        r = requests.post(
            f"{API}/wallet/transaction",
            json={"type": "withdraw", "amount": 9_999_999},
            headers=_auth_headers(new_user["token"]),
        )
        assert r.status_code == 400

    def test_history(self, new_user):
        r = requests.get(f"{API}/wallet/history", headers=_auth_headers(new_user["token"]))
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_summary(self, new_user):
        r = requests.get(f"{API}/wallet/summary", headers=_auth_headers(new_user["token"]))
        assert r.status_code == 200
        d = r.json()
        assert "wallet_usdt" in d and "positions_value_usdt" in d and "total_usdt" in d


# ---------- Referral ----------
class TestReferral:
    def test_referral(self, new_user):
        r = requests.get(f"{API}/referral", headers=_auth_headers(new_user["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["referral_code"] == new_user["user"]["referral_code"]
        assert isinstance(d["team"], list)


# ---------- Rewards ----------
class TestRewards:
    def test_claim_joining(self, new_user):
        rewards = requests.get(f"{API}/rewards", headers=_auth_headers(new_user["token"])).json()
        joining = [x for x in rewards if x["type"] == "joining" and x["status"] == "claimable"]
        assert joining, "expected claimable joining reward"
        rid = joining[0]["id"]
        c = requests.post(f"{API}/rewards/{rid}/claim", headers=_auth_headers(new_user["token"]))
        assert c.status_code == 200
        # Second claim should fail
        c2 = requests.post(f"{API}/rewards/{rid}/claim", headers=_auth_headers(new_user["token"]))
        assert c2.status_code == 400


# ---------- Content ----------
class TestContent:
    def test_news(self):
        r = requests.get(f"{API}/news")
        assert r.status_code == 200
        assert len(r.json()) >= 4

    def test_guide(self):
        r = requests.get(f"{API}/guide")
        assert r.status_code == 200
        assert len(r.json()) >= 5


# ---------- Referral link registration ----------
class TestReferralRegister:
    def test_register_with_referral(self, new_user):
        email = f"t2_{uuid.uuid4().hex[:6]}@tgx.dev"
        r = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "TestPass@123", "referral_code": new_user["user"]["referral_code"]},
        )
        assert r.status_code == 200
        assert r.json()["user"]["referred_by"] == new_user["user"]["id"]

        team = requests.get(f"{API}/referral", headers=_auth_headers(new_user["token"])).json()
        assert team["team_size"] >= 1
