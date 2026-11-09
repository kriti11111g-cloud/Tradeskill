# Hyperliquid SPOT integration tests: bind/unbind, validation, pairs, demo trade cycle, one-exchange rule
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "demo.team1@tgxbot.com"
PASSWORD = "Test@12345"
ADDR = "0x" + "a1" * 20


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    # Pre-state: ensure no other exchange bound
    for ex in ("binance", "kucoin", "lbank"):
        b = s.get(f"{BASE_URL}/api/{ex}/bind").json()
        print(ex, "pre-state:", b)
    yield s
    s.delete(f"{BASE_URL}/api/hyperliquid/bind")


# --- Pairs (public market data)
def test_pairs(client):
    r = client.get(f"{BASE_URL}/api/hyperliquid/pairs", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    syms = {p["symbol"] for p in d["pairs"]}
    assert syms == {"BTCUSDT", "ETHUSDT", "SOLUSDT", "HYPEUSDT", "FARTUSDT", "PUMPUSDT"}, d
    for p in d["pairs"]:
        assert p["price"] > 0, p
        assert p["coin"].startswith("@"), p
    print(d)


# --- Validation
def test_invalid_address_real(client):
    r = client.post(f"{BASE_URL}/api/hyperliquid/bind",
                    json={"account_address": "notanaddress", "agent_private_key": "", "mode": "real"})
    assert r.status_code == 400
    assert "0x" in r.json()["detail"]


def test_invalid_agent_key_real(client):
    r = client.post(f"{BASE_URL}/api/hyperliquid/bind",
                    json={"account_address": ADDR, "agent_private_key": "bad", "mode": "real"})
    assert r.status_code == 400
    assert "agent" in r.json()["detail"].lower()


# --- Demo bind / get / unbind
def test_demo_bind_get_unbind(client):
    r = client.post(f"{BASE_URL}/api/hyperliquid/bind",
                    json={"account_address": ADDR, "agent_private_key": "", "mode": "demo"})
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True and r.json()["mode"] == "demo"
    g = client.get(f"{BASE_URL}/api/hyperliquid/bind").json()
    assert g["mode"] == "demo"
    assert g["api_key_mask"] == ADDR[:6] + "…" + ADDR[-4:]
    assert "agent_key_enc" not in g
    me = client.get(f"{BASE_URL}/api/auth/me").json()
    assert me.get("active_exchange") == "hyperliquid", me
    d = client.delete(f"{BASE_URL}/api/hyperliquid/bind")
    assert d.status_code == 200
    g2 = client.get(f"{BASE_URL}/api/hyperliquid/bind").json()
    assert g2["mode"] is None
    me = client.get(f"{BASE_URL}/api/auth/me").json()
    assert me.get("active_exchange") == "binance"


# --- Demo trade cycle routed through HL
def test_demo_trade_cycle(client):
    r = client.post(f"{BASE_URL}/api/hyperliquid/bind",
                    json={"account_address": ADDR, "agent_private_key": "", "mode": "demo"})
    assert r.status_code == 200
    try:
        b = client.post(f"{BASE_URL}/api/trade/order",
                        json={"symbol": "SOLUSDT", "side": "BUY", "usdt_amount": 20}, timeout=30)
        assert b.status_code == 200, b.text
        bt = b.json()
        print("BUY", bt)
        assert bt["side"] == "BUY" and bt["mode"] == "demo" and bt["price"] > 0 and bt["quantity"] > 0
        s = client.post(f"{BASE_URL}/api/trade/order",
                        json={"symbol": "SOLUSDT", "side": "SELL"}, timeout=30)
        assert s.status_code == 200, s.text
        st = s.json()
        print("SELL", st)
        assert st["side"] == "SELL" and st["quantity"] > 0
        txs = client.get(f"{BASE_URL}/api/transactions").json()
        items = txs if isinstance(txs, list) else txs.get("items", txs.get("transactions", []))
        ids = {t.get("id") for t in items}
        assert bt["id"] in ids and st["id"] in ids
        bot = client.get(f"{BASE_URL}/api/bots/SOLUSDT").json()
        print("BOT exchange:", bot.get("exchange"), "qty:", bot.get("position_qty"))
        assert bot.get("exchange") == "hyperliquid"
    finally:
        client.delete(f"{BASE_URL}/api/hyperliquid/bind")


# --- One exchange per account: HL blocked when Binance bound
def test_hl_blocked_when_binance_bound(client):
    pre = client.get(f"{BASE_URL}/api/binance/bind").json()
    if pre.get("api_key_mask"):
        pytest.skip("binance already bound on this account; not touching user data")
    r = client.post(f"{BASE_URL}/api/binance/bind",
                    json={"api_key": "TEST_key_123456", "api_secret": "TEST_secret_123456", "mode": "demo"})
    assert r.status_code == 200, r.text
    try:
        h = client.post(f"{BASE_URL}/api/hyperliquid/bind",
                        json={"account_address": ADDR, "agent_private_key": "", "mode": "demo"})
        assert h.status_code == 400
        assert "Binance" in h.json()["detail"]
    finally:
        client.delete(f"{BASE_URL}/api/binance/bind")


# --- Reverse direction: Binance/KuCoin/LBank should be blocked when HL bound
@pytest.mark.parametrize("ex,payload", [
    ("binance", {"api_key": "TEST_key_123456", "api_secret": "TEST_secret_123456", "mode": "demo"}),
    ("kucoin", {"api_key": "TEST_key_123456", "api_secret": "TEST_secret_123456", "passphrase": "x", "mode": "demo"}),
    ("lbank", {"api_key": "TEST_key_123456", "api_secret": "TEST_secret_123456", "mode": "demo"}),
])
def test_other_blocked_when_hl_bound(client, ex, payload):
    r = client.post(f"{BASE_URL}/api/hyperliquid/bind",
                    json={"account_address": ADDR, "agent_private_key": "", "mode": "demo"})
    assert r.status_code == 200
    try:
        o = client.post(f"{BASE_URL}/api/{ex}/bind", json=payload)
        print(ex, o.status_code, o.text[:200])
        if o.status_code == 200:
            client.delete(f"{BASE_URL}/api/{ex}/bind")
        assert o.status_code == 400, f"{ex} bind allowed while Hyperliquid connected"
    finally:
        client.delete(f"{BASE_URL}/api/hyperliquid/bind")
