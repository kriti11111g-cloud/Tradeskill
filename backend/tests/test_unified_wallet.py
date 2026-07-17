"""Backend tests for UNIFIED WALLET SYSTEM (Jan 2026).

Single source of truth = bot_wallets.balance.
- /api/wallet/summary in demo mode returns total_usdt == wallet_usdt == bot_wallet_balance
- POST /api/bot-wallet/deposit is DISABLED (400)
- POST /api/bot-wallet/withdraw requires address (400 without address)
- External withdraw still works and deducts unified balance (and cancel refunds)
- Activation deducts $50 from bot wallet (400 if insufficient)
- P2P email/address transfer keeps both sides' unified balance in sync
- Admin activation revenue credits ADMIN'S bot wallet (revenue txn)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASSWORD = "Admin@12345"
MLM_NEWBIE_EMAIL = "mlm.newbie@tgxbot.com"
MLM_NEWBIE_PASSWORD = "Test@12345"
MLM_NEWBIE_ADDRESS = "0xa92392993a3EB73EB5C76f010486aEA5e16f4acC"

DUMMY_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678"


# ---------------- helpers ----------------
def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _register_fresh():
    email = f"TEST_unified_{uuid.uuid4().hex[:10]}@example.com"
    password = "TestPass@123"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": password, "name": "UnifiedTester"},
                      timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()["token"], email


def _wallet_summary(token):
    r = requests.get(f"{BASE_URL}/api/wallet/summary",
                     headers=_headers(token), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _bot_wallet_status(token):
    r = requests.get(f"{BASE_URL}/api/bot-wallet/status",
                     headers=_headers(token), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def mlm_newbie_token():
    return _login(MLM_NEWBIE_EMAIL, MLM_NEWBIE_PASSWORD)


# ---------------- 1. Unified balance equality ----------------
class TestUnifiedBalanceEquality:
    def test_admin_summary_equals_bot_wallet(self, admin_token):
        s = _wallet_summary(admin_token)
        bw = _bot_wallet_status(admin_token)
        assert "bot_wallet_balance" in s, "wallet/summary must include bot_wallet_balance"
        assert s["wallet_mode"] == "demo"
        assert s["total_usdt"] == s["wallet_usdt"] == s["bot_wallet_balance"] == round(bw["balance"], 4), (
            f"unified mismatch: total={s['total_usdt']} wallet={s['wallet_usdt']} "
            f"bw_field={s['bot_wallet_balance']} bw_status={bw['balance']}"
        )

    def test_mlm_newbie_summary_equals_bot_wallet(self, mlm_newbie_token):
        s = _wallet_summary(mlm_newbie_token)
        bw = _bot_wallet_status(mlm_newbie_token)
        assert s["total_usdt"] == s["wallet_usdt"] == s["bot_wallet_balance"] == round(bw["balance"], 4)


# ---------------- 2. Disabled endpoints ----------------
class TestDisabledEndpoints:
    def test_bot_wallet_deposit_disabled(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/bot-wallet/deposit",
                          headers=_headers(admin_token),
                          json={"amount": 10}, timeout=15)
        assert r.status_code == 400
        assert "disabled" in r.text.lower() or "unified" in r.text.lower(), r.text

    def test_bot_wallet_withdraw_without_address(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/bot-wallet/withdraw",
                          headers=_headers(admin_token),
                          json={"amount": 10}, timeout=15)
        assert r.status_code == 400
        assert "address" in r.text.lower(), r.text


# ---------------- 3. External withdrawal unified deduction + cancel refund ----------------
class TestExternalWithdrawUnified:
    def test_external_withdraw_then_cancel_unified(self, admin_token):
        before_sum = _wallet_summary(admin_token)
        before_bal = before_sum["total_usdt"]
        if before_bal < 15:
            pytest.skip(f"admin needs >=$15 for withdraw test, has {before_bal}")

        amount = 10.0
        r = requests.post(f"{BASE_URL}/api/bot-wallet/withdraw",
                          headers=_headers(admin_token),
                          json={"amount": amount, "address": DUMMY_ADDRESS,
                                "network": "BEP20",
                                "password": ADMIN_PASSWORD}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["kind"] == "withdraw_request"
        req_id = data["request_id"]

        # Balance should have dropped by exactly `amount` (fee stays inside net_amount)
        after_sum = _wallet_summary(admin_token)
        after_bal = after_sum["total_usdt"]
        assert abs((before_bal - amount) - after_bal) < 0.02, (
            f"expected {before_bal - amount}, got {after_bal}"
        )
        # Unified equality still holds
        assert after_sum["total_usdt"] == after_sum["wallet_usdt"] == after_sum["bot_wallet_balance"]

        # Cancel
        c = requests.post(
            f"{BASE_URL}/api/bot-wallet/withdrawals/{req_id}/cancel",
            headers=_headers(admin_token), timeout=15)
        assert c.status_code == 200, c.text

        refunded = _wallet_summary(admin_token)
        assert abs(refunded["total_usdt"] - before_bal) < 0.02, (
            f"refund mismatch: before={before_bal}, after cancel={refunded['total_usdt']}"
        )
        assert refunded["total_usdt"] == refunded["wallet_usdt"] == refunded["bot_wallet_balance"]

    def test_external_withdraw_wrong_password_rejected(self, admin_token):
        before = _wallet_summary(admin_token)["total_usdt"]
        if before < 10:
            pytest.skip("admin balance <10")
        r = requests.post(f"{BASE_URL}/api/bot-wallet/withdraw",
                          headers=_headers(admin_token),
                          json={"amount": 10.0, "address": DUMMY_ADDRESS,
                                "network": "BEP20", "password": "WRONG"},
                          timeout=15)
        assert r.status_code == 401, r.text
        assert "password" in r.text.lower()


# ---------------- 4. Activation from unified wallet ----------------
class TestUnifiedActivation:
    def test_fresh_user_activate_insufficient(self):
        token, _ = _register_fresh()
        # New user bot wallet balance == 0 (unified)
        s = _wallet_summary(token)
        assert s["total_usdt"] == 0 == s["wallet_usdt"] == s["bot_wallet_balance"]
        bw = _bot_wallet_status(token)
        assert bw["activated"] is False
        assert bw["balance"] == 0

        r = requests.post(f"{BASE_URL}/api/bot-wallet/activate",
                          headers=_headers(token), timeout=15)
        assert r.status_code == 400
        assert "insufficient" in r.text.lower(), r.text
        assert "50" in r.text or "$50" in r.text

    def test_p2p_fund_then_activate_and_admin_revenue(self, admin_token):
        # 1. Register new user
        new_token, new_email = _register_fresh()
        new_before = _wallet_summary(new_token)["total_usdt"]
        assert new_before == 0

        # 2. Admin sends 60 via P2P (email mode) — needs admin >= 60
        admin_before = _wallet_summary(admin_token)["total_usdt"]
        if admin_before < 60:
            pytest.skip(f"admin needs >=60 to fund test user, has {admin_before}")

        p = requests.post(f"{BASE_URL}/api/bot-wallet/p2p",
                          headers=_headers(admin_token),
                          json={"amount": 60, "recipient_email": new_email},
                          timeout=15)
        assert p.status_code == 200, p.text

        # 3. Verify new user balance rose to 60 (unified)
        new_after_p2p = _wallet_summary(new_token)
        assert abs(new_after_p2p["total_usdt"] - 60.0) < 0.02, new_after_p2p
        assert new_after_p2p["total_usdt"] == new_after_p2p["bot_wallet_balance"]

        admin_after_p2p = _wallet_summary(admin_token)["total_usdt"]
        assert abs((admin_before - 60) - admin_after_p2p) < 0.02

        # 4. Activate — should succeed and deduct 50 from unified balance
        act = requests.post(f"{BASE_URL}/api/bot-wallet/activate",
                            headers=_headers(new_token), timeout=15)
        assert act.status_code == 200, act.text
        assert act.json().get("activation_fee") == 50

        post_act = _wallet_summary(new_token)
        assert abs(post_act["total_usdt"] - 10.0) < 0.02, (
            f"expected 10.0 after activation, got {post_act['total_usdt']}"
        )
        assert post_act["total_usdt"] == post_act["bot_wallet_balance"]

        # 5. Admin should have received activation revenue in bot wallet
        admin_after_act = _wallet_summary(admin_token)["total_usdt"]
        assert admin_after_act > admin_after_p2p - 0.01, (
            f"admin bot wallet did not gain from activation: before={admin_after_p2p} "
            f"after={admin_after_act}"
        )
        # Verify 'revenue' txn logged in admin bot txns
        txns = requests.get(f"{BASE_URL}/api/bot-wallet/transactions",
                            headers=_headers(admin_token), timeout=15).json()
        recent_kinds = [t["kind"] for t in txns[:15]]
        assert "revenue" in recent_kinds, f"expected 'revenue' bot txn recently, got {recent_kinds}"


# ---------------- 5. P2P by address (unified sync) ----------------
class TestP2PByAddress:
    def test_p2p_by_mlm_newbie_address(self, admin_token, mlm_newbie_token):
        admin_before = _wallet_summary(admin_token)["total_usdt"]
        newbie_before = _wallet_summary(mlm_newbie_token)["total_usdt"]
        if admin_before < 5:
            pytest.skip(f"admin needs >=5 for P2P address test, has {admin_before}")

        amt = 3.0
        r = requests.post(f"{BASE_URL}/api/bot-wallet/p2p",
                          headers=_headers(admin_token),
                          json={"amount": amt,
                                "recipient_address": MLM_NEWBIE_ADDRESS},
                          timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("mode") == "address"

        admin_after = _wallet_summary(admin_token)["total_usdt"]
        newbie_after = _wallet_summary(mlm_newbie_token)["total_usdt"]
        assert abs((admin_before - amt) - admin_after) < 0.02
        assert abs((newbie_before + amt) - newbie_after) < 0.02

        # Reverse it — send back so admin balance is not permanently drained
        rev = requests.post(f"{BASE_URL}/api/bot-wallet/p2p",
                            headers=_headers(mlm_newbie_token),
                            json={"amount": amt,
                                  "recipient_email": ADMIN_EMAIL},
                            timeout=15)
        assert rev.status_code == 200, rev.text
