"""
Backend tests for Social Media Bonus Center (HUBXBOT).

Covers:
- GET /api/social-bonus/status shape (5 platforms, reward=0.20, total_available=1.00)
- POST /api/social-bonus/claim/{platform} without follow -> 400 "Please follow first"
- POST /api/social-bonus/follow/{platform} then claim credits +0.20 to unified wallet
- Duplicate claim -> 400 "Reward already claimed"
- Claim logs a bot transaction with kind 'social_bonus' and note '<Platform> Follow Reward'
- Unknown platform id -> 404
- Second platform (instagram) claim, total_earned becomes 0.40
"""
import os
import time
import uuid
import pathlib
import pytest
import requests


def _load_env():
    if os.environ.get("REACT_APP_BACKEND_URL"):
        return
    p = pathlib.Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


_load_env()
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

PLATFORMS = ["telegram", "instagram", "x", "youtube", "facebook"]
PLATFORM_NAMES = {
    "telegram": "Telegram",
    "instagram": "Instagram",
    "x": "X (Twitter)",
    "youtube": "YouTube",
    "facebook": "Facebook",
}
REWARD = 0.20


@pytest.fixture(scope="module")
def fresh_user():
    """Register a brand-new user so all 5 platform claims are unclaimed."""
    email = f"TEST_socialbonus_{uuid.uuid4().hex[:10]}@tgxbot.com"
    password = "Test@12345"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": "Social Bonus Tester",
    }, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("token") or body.get("access_token")
    if not token:
        # fall back to login
        r2 = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": password}, timeout=30)
        assert r2.status_code == 200, r2.text
        token = r2.json().get("token") or r2.json().get("access_token")
    assert token, f"no token: {body}"
    return {"email": email, "password": password, "token": token}


@pytest.fixture(scope="module")
def auth_headers(fresh_user):
    return {"Authorization": f"Bearer {fresh_user['token']}",
            "Content-Type": "application/json"}


def _wallet_balance(headers) -> float:
    r = requests.get(f"{API}/wallet/summary", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    # unified = wallet_usdt in demo mode
    return float(j.get("wallet_usdt") or 0.0)


class TestSocialBonusStatus:
    def test_status_shape(self, auth_headers):
        r = requests.get(f"{API}/social-bonus/status", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "platforms" in j
        assert len(j["platforms"]) == 5
        ids = [p["id"] for p in j["platforms"]]
        assert set(ids) == set(PLATFORMS)
        for p in j["platforms"]:
            assert p["reward"] == REWARD
            assert p["followed"] is False
            assert p["claimed"] is False
            assert isinstance(p["name"], str) and p["name"]
            assert p.get("url", "").startswith("http")
        assert j["reward"] == REWARD
        assert j["total_available"] == round(REWARD * 5, 2) == 1.00
        assert j["total_earned"] == 0.00


class TestClaimGuards:
    def test_claim_without_follow_returns_400(self, auth_headers):
        r = requests.post(f"{API}/social-bonus/claim/telegram",
                          headers=auth_headers, timeout=15)
        assert r.status_code == 400, r.text
        msg = (r.json().get("detail") or "").lower()
        assert "follow" in msg, r.text

    def test_unknown_platform_follow_404(self, auth_headers):
        r = requests.post(f"{API}/social-bonus/follow/tiktok",
                          headers=auth_headers, timeout=15)
        assert r.status_code == 404, r.text

    def test_unknown_platform_claim_404(self, auth_headers):
        r = requests.post(f"{API}/social-bonus/claim/tiktok",
                          headers=auth_headers, timeout=15)
        assert r.status_code == 404, r.text


class TestFollowAndClaimFlow:
    def test_follow_marks_followed_true(self, auth_headers):
        r = requests.post(f"{API}/social-bonus/follow/telegram",
                          headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("followed") is True

        # Verify via status
        r2 = requests.get(f"{API}/social-bonus/status",
                          headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        tg = next(p for p in r2.json()["platforms"] if p["id"] == "telegram")
        assert tg["followed"] is True
        assert tg["claimed"] is False

    def test_claim_credits_wallet_and_returns_amount(self, auth_headers):
        before = _wallet_balance(auth_headers)
        r = requests.post(f"{API}/social-bonus/claim/telegram",
                          headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("claimed") is True
        assert j.get("amount") == REWARD
        # returned balance matches
        assert "balance" in j
        assert round(float(j["balance"]) - before, 4) == REWARD, \
            f"balance delta wrong: before={before}, after={j['balance']}"
        # Verify wallet/summary
        time.sleep(0.4)
        after = _wallet_balance(auth_headers)
        assert round(after - before, 4) == REWARD, \
            f"wallet_summary delta wrong: before={before}, after={after}"

    def test_status_reflects_claim(self, auth_headers):
        r = requests.get(f"{API}/social-bonus/status",
                         headers=auth_headers, timeout=15)
        j = r.json()
        tg = next(p for p in j["platforms"] if p["id"] == "telegram")
        assert tg["claimed"] is True
        assert tg["followed"] is True
        assert j["total_earned"] == round(REWARD, 2)

    def test_duplicate_claim_returns_400(self, auth_headers):
        r = requests.post(f"{API}/social-bonus/claim/telegram",
                          headers=auth_headers, timeout=15)
        assert r.status_code == 400, r.text
        assert "already" in (r.json().get("detail") or "").lower()

    def test_bot_txn_history_contains_social_bonus(self, auth_headers):
        r = requests.get(f"{API}/bot-wallet/transactions",
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        rows = r.json()
        matches = [x for x in rows
                   if x.get("kind") == "social_bonus"
                   and (x.get("note") or "").startswith("Telegram")]
        assert matches, f"no social_bonus txn for Telegram found in {rows[:5]}"
        m = matches[0]
        assert m["amount"] == REWARD
        assert "Follow Reward" in m["note"]

    def test_second_platform_follow_and_claim(self, auth_headers):
        # follow instagram
        r = requests.post(f"{API}/social-bonus/follow/instagram",
                          headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        # claim instagram
        before = _wallet_balance(auth_headers)
        r2 = requests.post(f"{API}/social-bonus/claim/instagram",
                           headers=auth_headers, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["amount"] == REWARD
        time.sleep(0.4)
        after = _wallet_balance(auth_headers)
        assert round(after - before, 4) == REWARD

        # status total_earned == 0.40
        r3 = requests.get(f"{API}/social-bonus/status",
                          headers=auth_headers, timeout=15)
        assert r3.json()["total_earned"] == round(REWARD * 2, 2) == 0.40
