"""Backend tests for HD-wallet crypto deposit/withdraw + P2P by address + admin.

Covers:
- GET /api/bot-wallet/deposit-address (idempotent, correct networks)
- POST /api/bot-wallet/withdraw (BEP20/POLYGON with password, min amount, TRC20/ERC20 coming soon, internal-transfer)
- Cancel withdrawal
- Admin withdrawal queue (list/approve manual/reject) + 403 for non-admin
- Admin treasury (RPC)
- P2P by address (success / 404 unknown / 400 own)
"""
import os
import time
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASSWORD = "Admin@12345"
USER_EMAIL = "mlm.newbie@tgxbot.com"
USER_PASSWORD = "Test@12345"
# The known deposit address of mlm.newbie (per review request)
KNOWN_MLM_DEPOSIT_ADDR = "0xa92392993a3EB73EB5C76f010486aEA5e16f4acC"


def _login(email, password):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": password},
                      timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    token = r.json().get("token")
    assert token
    return token


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def user_token():
    return _login(USER_EMAIL, USER_PASSWORD)


# ---- deposit address ----
class TestDepositAddress:
    def test_returns_valid_address_and_networks(self, admin_token):
        r = requests.get(f"{API}/bot-wallet/deposit-address",
                         headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "address" in data and data["address"].startswith("0x")
        assert len(data["address"]) == 42
        nets = {n["id"]: n for n in data["networks"]}
        assert nets["BEP20"]["active"] is True
        assert nets["POLYGON"]["active"] is True
        assert nets["TRC20"]["active"] is False
        assert "Coming Soon" in nets["TRC20"].get("note", "")

    def test_idempotent_same_address(self, admin_token):
        r1 = requests.get(f"{API}/bot-wallet/deposit-address",
                          headers=_h(admin_token), timeout=15).json()
        r2 = requests.get(f"{API}/bot-wallet/deposit-address",
                          headers=_h(admin_token), timeout=15).json()
        assert r1["address"] == r2["address"]

    def test_user_and_admin_have_different_addresses(self, admin_token, user_token):
        a = requests.get(f"{API}/bot-wallet/deposit-address",
                         headers=_h(admin_token), timeout=15).json()["address"]
        u = requests.get(f"{API}/bot-wallet/deposit-address",
                         headers=_h(user_token), timeout=15).json()["address"]
        assert a != u

    def test_mlm_newbie_known_address(self, user_token):
        u = requests.get(f"{API}/bot-wallet/deposit-address",
                         headers=_h(user_token), timeout=15).json()["address"]
        # case-insensitive compare (checksum casing may vary)
        assert u.lower() == KNOWN_MLM_DEPOSIT_ADDR.lower(), \
            f"expected mlm.newbie address {KNOWN_MLM_DEPOSIT_ADDR}, got {u}"


# ---- withdraw request ----
class TestWithdraw:
    def test_trc20_coming_soon(self, admin_token):
        r = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                          json={"amount": 15, "network": "TRC20",
                                "address": "0x" + "a" * 40,
                                "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 400
        assert "coming soon" in r.text.lower()

    def test_erc20_coming_soon(self, admin_token):
        r = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                          json={"amount": 15, "network": "ERC20",
                                "address": "0x" + "a" * 40,
                                "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 400
        assert "coming soon" in r.text.lower()

    def test_wrong_password_401(self, admin_token):
        r = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                          json={"amount": 15, "network": "BEP20",
                                "address": "0x" + "b" * 40,
                                "password": "wrong-password"}, timeout=15)
        assert r.status_code == 401

    def test_below_min_returns_400(self, admin_token):
        r = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                          json={"amount": 5, "network": "BEP20",
                                "address": "0x" + "c" * 40,
                                "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 400
        assert "minimum" in r.text.lower() or "10" in r.text

    def test_valid_creates_pending_request_and_deducts_bot_wallet(self, admin_token):
        wal_before = requests.get(f"{API}/bot-wallet/status", headers=_h(admin_token),
                                  timeout=15).json()
        bal_before = float(wal_before.get("balance", 0.0))
        if bal_before < 15:
            pytest.skip(f"admin bot wallet balance too low for withdraw test: {bal_before}")
        payload = {"amount": 12, "network": "BEP20",
                   "address": "0x" + "d" * 40,
                   "password": ADMIN_PASSWORD}
        r = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                          json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["kind"] == "withdraw_request"
        assert body["fee"] == 2
        assert abs(body["net_amount"] - 10.0) < 1e-6
        assert abs(body["balance"] - (bal_before - 12)) < 1e-4
        req_id = body["request_id"]

        # persistence via GET /withdrawals
        rows = requests.get(f"{API}/bot-wallet/withdrawals",
                            headers=_h(admin_token), timeout=15).json()
        matching = [x for x in rows if x["id"] == req_id]
        assert matching, "withdrawal request not returned in /withdrawals"
        assert matching[0]["status"] == "pending"
        assert matching[0]["fee"] == 2
        assert matching[0]["network"] == "BEP20"
        # Cancel to refund for cleanup
        cancel = requests.post(f"{API}/bot-wallet/withdrawals/{req_id}/cancel",
                               headers=_h(admin_token), timeout=15)
        assert cancel.status_code == 200

    def test_cancel_refunds_and_marks_cancelled(self, admin_token):
        wal_before = requests.get(f"{API}/bot-wallet/status", headers=_h(admin_token),
                                  timeout=15).json()
        bal_before = float(wal_before.get("balance", 0.0))
        if bal_before < 15:
            pytest.skip("insufficient balance")
        r = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                          json={"amount": 11, "network": "POLYGON",
                                "address": "0x" + "e" * 40,
                                "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        req_id = r.json()["request_id"]
        # cancel
        c = requests.post(f"{API}/bot-wallet/withdrawals/{req_id}/cancel",
                          headers=_h(admin_token), timeout=15)
        assert c.status_code == 200
        rows = requests.get(f"{API}/bot-wallet/withdrawals",
                            headers=_h(admin_token), timeout=15).json()
        row = [x for x in rows if x["id"] == req_id][0]
        assert row["status"] == "cancelled"
        wal_after = requests.get(f"{API}/bot-wallet/status", headers=_h(admin_token),
                                 timeout=15).json()
        assert abs(float(wal_after["balance"]) - bal_before) < 1e-4, \
            "refund not restored to bot wallet"

    def test_internal_transfer_no_address(self, admin_token):
        """Without address -> internal transfer to main wallet (no fee, no password required)."""
        wal_before = requests.get(f"{API}/bot-wallet/status", headers=_h(admin_token),
                                  timeout=15).json()
        bal_before = float(wal_before.get("balance", 0.0))
        if bal_before < 5:
            pytest.skip("insufficient balance")
        r = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                          json={"amount": 1}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["kind"] == "withdraw"
        # restore by depositing back
        requests.post(f"{API}/bot-wallet/deposit", headers=_h(admin_token),
                      json={"amount": 1}, timeout=15)


# ---- p2p by address ----
class TestP2PByAddress:
    def test_p2p_to_unknown_address_returns_404(self, admin_token):
        r = requests.post(f"{API}/bot-wallet/p2p", headers=_h(admin_token),
                          json={"amount": 1,
                                "recipient_address": "0x" + "f" * 40}, timeout=15)
        assert r.status_code == 404
        assert "does not belong" in r.text.lower()

    def test_p2p_to_own_address_returns_400(self, admin_token):
        my_addr = requests.get(f"{API}/bot-wallet/deposit-address",
                               headers=_h(admin_token), timeout=15).json()["address"]
        r = requests.post(f"{API}/bot-wallet/p2p", headers=_h(admin_token),
                          json={"amount": 1, "recipient_address": my_addr}, timeout=15)
        assert r.status_code == 400
        assert "own" in r.text.lower()

    def test_p2p_to_valid_address_transfers(self, admin_token, user_token):
        # admin sends 1 USDT to mlm.newbie's known deposit address
        wal_a_before = float(requests.get(f"{API}/bot-wallet/status", headers=_h(admin_token)).json()["balance"])
        wal_u_before = float(requests.get(f"{API}/bot-wallet/status", headers=_h(user_token)).json()["balance"])
        if wal_a_before < 2:
            pytest.skip("admin balance too low")
        r = requests.post(f"{API}/bot-wallet/p2p", headers=_h(admin_token),
                          json={"amount": 1,
                                "recipient_address": KNOWN_MLM_DEPOSIT_ADDR}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mode"] == "address"
        wal_a_after = float(requests.get(f"{API}/bot-wallet/status", headers=_h(admin_token)).json()["balance"])
        wal_u_after = float(requests.get(f"{API}/bot-wallet/status", headers=_h(user_token)).json()["balance"])
        assert abs(wal_a_after - (wal_a_before - 1)) < 1e-4
        assert abs(wal_u_after - (wal_u_before + 1)) < 1e-4
        # send back to keep balances stable
        requests.post(f"{API}/bot-wallet/p2p", headers=_h(user_token),
                      json={"amount": 1, "recipient_email": ADMIN_EMAIL}, timeout=15)


# ---- admin endpoints ----
class TestAdmin:
    def test_non_admin_forbidden_on_withdrawals(self, user_token):
        r = requests.get(f"{API}/admin/withdrawals", headers=_h(user_token), timeout=15)
        assert r.status_code == 403

    def test_non_admin_forbidden_on_treasury(self, user_token):
        r = requests.get(f"{API}/admin/treasury", headers=_h(user_token), timeout=15)
        assert r.status_code == 403

    def test_admin_can_list_withdrawals(self, admin_token):
        r = requests.get(f"{API}/admin/withdrawals", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_treasury_has_master_and_balances(self, admin_token):
        r = requests.get(f"{API}/admin/treasury", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "master_address" in data
        assert data["master_address"].startswith("0x")
        assert "networks" in data
        assert "BEP20" in data["networks"]
        assert "POLYGON" in data["networks"]
        # Each net should have usdt+native or error (RPC may occasionally fail)
        for net_key, net in data["networks"].items():
            assert "label" in net
            assert "native_symbol" in net
            assert ("usdt" in net and "native" in net) or ("error" in net)

    def test_admin_manual_approve_and_reject_flow(self, admin_token):
        wal_before = float(requests.get(f"{API}/bot-wallet/status", headers=_h(admin_token)).json()["balance"])
        if wal_before < 25:
            pytest.skip("admin balance too low for approve/reject flow")

        # Create a request to REJECT
        r1 = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                           json={"amount": 11, "network": "BEP20",
                                 "address": "0x" + "a" * 40,
                                 "password": ADMIN_PASSWORD}, timeout=15)
        assert r1.status_code == 200, r1.text
        req_id_reject = r1.json()["request_id"]
        # Admin rejects -> refunds
        rej = requests.post(f"{API}/admin/withdrawals/{req_id_reject}/reject",
                            headers=_h(admin_token),
                            json={"reason": "test-reject"}, timeout=15)
        assert rej.status_code == 200
        rows = requests.get(f"{API}/admin/withdrawals?status=rejected",
                            headers=_h(admin_token), timeout=15).json()
        assert any(x["id"] == req_id_reject for x in rows)

        # Create another to APPROVE manually
        r2 = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                           json={"amount": 11, "network": "BEP20",
                                 "address": "0x" + "b" * 40,
                                 "password": ADMIN_PASSWORD}, timeout=15)
        assert r2.status_code == 200
        req_id_manual = r2.json()["request_id"]
        appr = requests.post(f"{API}/admin/withdrawals/{req_id_manual}/approve",
                             headers=_h(admin_token),
                             json={"manual": True}, timeout=15)
        assert appr.status_code == 200
        assert appr.json()["method"] == "manual"
        rows_c = requests.get(f"{API}/admin/withdrawals?status=completed",
                              headers=_h(admin_token), timeout=15).json()
        assert any(x["id"] == req_id_manual for x in rows_c)

        # Confirm balances net (reject refunded +11, manual completed leaves -11 spent)
        wal_after = float(requests.get(f"{API}/bot-wallet/status", headers=_h(admin_token)).json()["balance"])
        assert abs(wal_after - (wal_before - 11)) < 1e-3, \
            f"expected bal_before-11, got {wal_after} vs {wal_before}"

        # Refund manual-approved amount via internal deposit-from-main to restore state
        requests.post(f"{API}/bot-wallet/deposit", headers=_h(admin_token),
                      json={"amount": 11}, timeout=15)

    def test_approve_onchain_fails_gracefully_no_gas(self, admin_token):
        """Master has 0 gas → expect 400 with error, per review context."""
        wal = float(requests.get(f"{API}/bot-wallet/status", headers=_h(admin_token)).json()["balance"])
        if wal < 15:
            pytest.skip("insufficient bal")
        r = requests.post(f"{API}/bot-wallet/withdraw", headers=_h(admin_token),
                          json={"amount": 11, "network": "BEP20",
                                "address": "0x" + "1" * 40,
                                "password": ADMIN_PASSWORD}, timeout=15)
        req_id = r.json()["request_id"]
        # Non-manual approve -> attempts on-chain -> should fail (400) since no gas/USDT
        appr = requests.post(f"{API}/admin/withdrawals/{req_id}/approve",
                             headers=_h(admin_token),
                             json={"manual": False}, timeout=60)
        assert appr.status_code == 400, f"expected 400 (no gas), got {appr.status_code}: {appr.text}"
        # Cleanup: reject to refund
        requests.post(f"{API}/admin/withdrawals/{req_id}/reject",
                      headers=_h(admin_token), json={}, timeout=15)
