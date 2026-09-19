"""Backend tests for auto-sweep code paths + auth/UID regressions (iteration 23).

Covers:
- /api/ health (Trade Skill / status ok)
- chain_wallet.sweep_usdt dry-run on BEP20 (balance < min -> swept:False, no raise)
- gas floor logic literal present in chain_wallet.py source (3 gwei BEP20 / 30 gwei POLYGON,
  gas_price = max(node*1.15, floor))
- deposit_watcher_loop stability: no exception traceback in supervisor backend log
- Regression: admin login returns referral_code=TSKADMIN and uid=TSK100000
- Regression: register creates user with uid TSK1000xx AND referral_code == uid
- Regression: /api/bots requires auth and returns list; /api/wallet/summary works
- Regression: bot start/stop endpoints respond (BTCUSDT)
"""
import os
import sys
import time
import uuid
import inspect
import pytest
import requests

sys.path.insert(0, "/app/backend")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASS = "Admin@12345"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_client(api, admin_token):
    api.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api


# ---------- Health ----------
def test_health_root(api):
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    j = r.json()
    assert j.get("app") == "Trade Skill"
    assert j.get("status") == "ok"


# ---------- Admin regression ----------
def test_admin_login_uid_and_referral(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200
    j = r.json()
    u = j.get("user") or {}
    assert u.get("referral_code") == "TSKADMIN", u
    assert u.get("uid") == "TSK100000", u


# ---------- Register: uid == referral_code, TSK1000xx ----------
def test_register_uid_equals_referral(api):
    email = f"TEST_sweep_{uuid.uuid4().hex[:8]}@tgxbot.com"
    r = api.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Sweep Test", "email": email,
        "password": "Test@12345", "mobile": "9876543210",
    })
    assert r.status_code == 200, r.text
    j = r.json()
    u = j.get("user") or {}
    uid = u.get("uid") or ""
    rc = u.get("referral_code") or ""
    assert uid.startswith("TSK1"), f"uid={uid}"
    assert len(uid) == 9, f"uid length not 9: {uid}"
    assert rc == uid, f"referral_code({rc}) != uid({uid})"


# ---------- Regression: authed endpoints ----------
def test_bots_list_authed(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/bots")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_wallet_summary(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/wallet/summary")
    assert r.status_code == 200
    j = r.json()
    # Common expected fields
    assert any(k in j for k in ("balance", "wallet_usdt", "demo_balance", "total"))


def test_bot_start_stop_responds(admin_client):
    sym = "BTCUSDT"
    # Ensure a bot config exists (POST /bots/{sym} creates/updates)
    upsert = admin_client.post(f"{BASE_URL}/api/bots/{sym}", json={
        "strategy": "grid", "capital_usdt": 20, "risk": "medium"
    })
    assert upsert.status_code in (200, 201, 400, 422), upsert.text
    start = admin_client.post(f"{BASE_URL}/api/bots/{sym}/start")
    assert start.status_code in (200, 400, 409), start.text
    stop = admin_client.post(f"{BASE_URL}/api/bots/{sym}/stop")
    assert stop.status_code in (200, 400, 409), stop.text


# ---------- Sweep dry-run + code-path checks ----------
def test_sweep_dry_run_bep20_balance_below_min():
    """Master gas wallet (index 0) has ~$10 BNB on BEP20 but 0 USDT, so sweep
    should return swept:False with 'balance ... < min ...' — validates HD deriv +
    RPC + min-balance guard without raising."""
    import chain_wallet
    addr = "0x07fE8dc2d97F592C4333F30ADC47377c93b37559"
    res = chain_wallet.sweep_usdt("BEP20", 1, addr, 1.0)
    assert isinstance(res, dict)
    assert res.get("swept") is False, res
    reason = res.get("reason", "")
    assert "balance" in reason and "min" in reason, reason


def test_sweep_gas_floor_source_contains_floor_literal():
    """Verify BEP20=3 gwei, POLYGON=30 gwei floor and gas_price = max(node*1.15, floor)."""
    import chain_wallet
    src = inspect.getsource(chain_wallet.sweep_usdt)
    assert 'Web3.to_wei(3, "gwei")' in src, "BEP20 3 gwei floor missing"
    assert 'Web3.to_wei(30, "gwei")' in src, "POLYGON 30 gwei floor missing"
    assert "max(int(w3.eth.gas_price * 1.15)" in src, "gas_price max floor logic missing"


def test_derive_address_master_and_index1():
    """HD derivation deterministic — master (idx 0) must equal known address."""
    import chain_wallet
    master = chain_wallet.derive_address(0)
    assert master.lower() == "0x5aA5004E23B39D0368b765e4FDF47f6747F7e84F".lower()
    # index 1 is deterministic; just ensure it's a 0x address
    a1 = chain_wallet.derive_address(1)
    assert a1.startswith("0x") and len(a1) == 42


# ---------- Watcher stability ----------
def test_deposit_watcher_no_traceback_in_logs():
    """Recent backend logs must not contain sweep-related tracebacks."""
    path = "/var/log/supervisor/backend.err.log"
    if not os.path.exists(path):
        pytest.skip("backend log not found")
    with open(path, "rb") as f:
        f.seek(0, 2)
        size = f.tell()
        f.seek(max(0, size - 200_000))
        tail = f.read().decode("utf-8", errors="ignore")
    bad_needles = ["deposit_watcher_loop", "sweep_usdt", "chain_wallet.py"]
    trace_hits = []
    for line in tail.splitlines():
        low = line.lower()
        if "traceback" in low or ("error" in low and "sweep" in low):
            trace_hits.append(line)
        for n in bad_needles:
            if n in line and ("Error" in line or "Exception" in line):
                trace_hits.append(line)
    assert not trace_hits, f"Found sweep/watcher errors in logs: {trace_hits[:5]}"
