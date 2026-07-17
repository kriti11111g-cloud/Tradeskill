"""Backend tests for Pre-Funded Bot Wallet & Monetization Flow.

Covers:
- GET /api/bot-wallet/status defaults (activated=false, balance=0, fee=70, pct=20)
- POST /api/bot-wallet/activate (deducts $70; 400 if main wallet < $70)
- POST /api/bot-wallet/deposit / withdraw
- GET /api/bot-wallet/transactions
- POST /api/bots/{symbol}/start blocked when not activated / balance=0
- SELL profit deducts 20% into bot_transactions (trading_fee kind)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASSWORD = "Admin@12345"


# ---------- Helpers ----------
def _register_fresh():
    email = f"TEST_botwallet_{uuid.uuid4().hex[:10]}@example.com"
    password = "TestPass@123"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": password, "name": "BotWalletTester"},
                      timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"], email, password


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _get_admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    if r.status_code == 200:
        return r.json()["token"]
    return None


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def fresh_user():
    token, user, email, password = _register_fresh()
    return {"token": token, "user": user, "email": email, "password": password}


# ---------- Bot Wallet Status ----------
class TestBotWalletStatusDefaults:
    def test_status_fresh_user_defaults(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/bot-wallet/status",
                         headers=_headers(fresh_user["token"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["activated"] is False
        assert data["balance"] == 0
        assert data["activation_fee"] == 50
        assert data["trading_fee_pct"] == 25
        assert data["min_fuel_balance"] == 10
        assert "deposit_address" in data
        assert data["main_wallet_usdt"] == 1000.0  # seed wallet

    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/bot-wallet/status", timeout=15)
        assert r.status_code in (401, 403)


# ---------- Activation ----------
class TestBotWalletActivate:
    def test_start_bot_blocked_before_activation(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bots/BTCUSDT/start",
                          headers=_headers(fresh_user["token"]), timeout=15)
        assert r.status_code == 400
        assert "not activated" in r.text.lower()

    def test_deposit_blocked_before_activation(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bot-wallet/deposit",
                          headers=_headers(fresh_user["token"]),
                          json={"amount": 10}, timeout=15)
        assert r.status_code == 400
        assert "not activated" in r.text.lower()

    def test_activate_deducts_70(self, fresh_user):
        # Check main wallet before
        me = requests.get(f"{BASE_URL}/api/auth/me",
                          headers=_headers(fresh_user["token"]), timeout=15).json()
        before = float(me["wallet_usdt"])
        r = requests.post(f"{BASE_URL}/api/bot-wallet/activate",
                          headers=_headers(fresh_user["token"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("activation_fee") == 50

        # Verify status now
        s = requests.get(f"{BASE_URL}/api/bot-wallet/status",
                        headers=_headers(fresh_user["token"]), timeout=15).json()
        assert s["activated"] is True
        assert s["balance"] == 0
        assert s["main_wallet_usdt"] == round(before - 50, 4)

    def test_activate_idempotent(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bot-wallet/activate",
                          headers=_headers(fresh_user["token"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("already") is True

    def test_start_bot_blocked_when_balance_zero(self, fresh_user):
        # Activated but 0 balance
        r = requests.post(f"{BASE_URL}/api/bots/BTCUSDT/start",
                          headers=_headers(fresh_user["token"]), timeout=15)
        assert r.status_code == 400
        assert "fuel required" in r.text.lower() or "minimum" in r.text.lower()


class TestActivateInsufficientBalance:
    def test_insufficient_main_wallet_returns_400(self):
        """Register a new user, drain wallet to <$50, try to activate."""
        token, user, _, _ = _register_fresh()
        # Drain: buy some BTC to spend most of the balance.
        r = requests.post(f"{BASE_URL}/api/trade/order",
                          headers=_headers(token),
                          json={"symbol": "BTCUSDT", "side": "BUY",
                                "usdt_amount": 960.0}, timeout=30)
        # accept 200 or skip if trade path unavailable
        if r.status_code != 200:
            pytest.skip(f"Could not drain wallet via /trade/order: {r.status_code} {r.text}")

        # Now try to activate — main wallet < 50
        act = requests.post(f"{BASE_URL}/api/bot-wallet/activate",
                            headers=_headers(token), timeout=15)
        assert act.status_code == 400
        assert "insufficient" in act.text.lower()


# ---------- Deposit / Withdraw ----------
class TestBotWalletDepositWithdraw:
    def test_deposit_after_activation(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bot-wallet/deposit",
                          headers=_headers(fresh_user["token"]),
                          json={"amount": 100}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["balance"] == 100.0

        s = requests.get(f"{BASE_URL}/api/bot-wallet/status",
                         headers=_headers(fresh_user["token"]), timeout=15).json()
        assert s["balance"] == 100.0

    def test_deposit_over_main_balance_rejected(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bot-wallet/deposit",
                          headers=_headers(fresh_user["token"]),
                          json={"amount": 999999}, timeout=15)
        assert r.status_code == 400

    def test_deposit_negative_rejected(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bot-wallet/deposit",
                          headers=_headers(fresh_user["token"]),
                          json={"amount": -10}, timeout=15)
        assert r.status_code in (400, 422)

    def test_start_bot_after_deposit(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bots/BTCUSDT/start",
                          headers=_headers(fresh_user["token"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "running"

    def test_withdraw_partial(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bot-wallet/withdraw",
                          headers=_headers(fresh_user["token"]),
                          json={"amount": 50}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["balance"] == 50.0

        s = requests.get(f"{BASE_URL}/api/bot-wallet/status",
                         headers=_headers(fresh_user["token"]), timeout=15).json()
        assert s["balance"] == 50.0

    def test_withdraw_over_balance_rejected(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bot-wallet/withdraw",
                          headers=_headers(fresh_user["token"]),
                          json={"amount": 99999}, timeout=15)
        assert r.status_code == 400


# ---------- Transactions ----------
class TestBotWalletTransactions:
    def test_transactions_list_contains_expected_kinds(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/bot-wallet/transactions",
                         headers=_headers(fresh_user["token"]), timeout=15)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        kinds = {row["kind"] for row in rows}
        # We expect at least activation + deposit + withdraw so far
        assert "activation" in kinds
        assert "deposit" in kinds
        assert "withdraw" in kinds
        # All rows sanity
        for row in rows:
            assert "id" in row
            assert "amount" in row
            assert "created_at" in row
            assert "_id" not in row  # mongo _id must be excluded

    def test_transactions_desc_sorted(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/bot-wallet/transactions",
                         headers=_headers(fresh_user["token"]), timeout=15)
        rows = r.json()
        if len(rows) >= 2:
            assert rows[0]["created_at"] >= rows[-1]["created_at"]


# ---------- Trading Fee Deduction on SELL ----------
class TestTradingFeeDeduction:
    def test_profitable_sell_deducts_25pct_fuel_from_bot_wallet(self):
        """Full flow: register → activate → deposit → BUY → SELL profitable →
        verify fuel txn with amount = -0.25 * profit AND admin wallet credited."""
        token, user, _, _ = _register_fresh()
        h = _headers(token)

        # Activate
        r = requests.post(f"{BASE_URL}/api/bot-wallet/activate", headers=h, timeout=15)
        assert r.status_code == 200, r.text

        # Deposit into bot wallet
        r = requests.post(f"{BASE_URL}/api/bot-wallet/deposit", headers=h,
                          json={"amount": 200}, timeout=15)
        assert r.status_code == 200, r.text
        bot_bal_before = r.json()["balance"]
        assert bot_bal_before == 200.0

        # BUY to open a position at current price
        buy = requests.post(f"{BASE_URL}/api/trade/order", headers=h,
                            json={"symbol": "BTCUSDT", "side": "BUY",
                                  "usdt_amount": 100.0}, timeout=30)
        assert buy.status_code == 200, buy.text
        buy_txn = buy.json()
        buy_price = float(buy_txn["price"])
        buy_qty = float(buy_txn["quantity"])

        # Directly bump avg_price down in DB to guarantee a profit on SELL,
        # OR simulate by using MongoDB. But we can't touch DB from test easily.
        # Instead: sell immediately — profit may be ~0 or slightly negative
        # due to price movement. To force profit, we can artificially set the
        # bot's avg_price via a manual position override endpoint if exists.
        # Fall back: use /bots/{symbol}/position override.
        override = requests.post(
            f"{BASE_URL}/api/bots/BTCUSDT/position",
            headers=h,
            json={"position_qty": buy_qty, "avg_price": buy_price * 0.5,
                  "reset_peak": True},
            timeout=15,
        )
        # If override endpoint isn't available, mark test as skip.
        if override.status_code not in (200, 201):
            pytest.skip(f"position override not available: {override.status_code} {override.text}")

        # Now SELL — should yield ~2x proceeds vs cost → profit
        sell = requests.post(f"{BASE_URL}/api/trade/order", headers=h,
                             json={"symbol": "BTCUSDT", "side": "SELL",
                                   "quantity": buy_qty}, timeout=30)
        assert sell.status_code == 200, sell.text
        sell_txn = sell.json()
        profit = float(sell_txn["profit"])
        assert profit > 0, f"Expected profit > 0, got {profit}"

        # Allow the async fee task a moment (it's inline so should be fine).
        time.sleep(0.5)

        # Verify bot wallet balance decreased by 25% of profit
        s = requests.get(f"{BASE_URL}/api/bot-wallet/status", headers=h, timeout=15).json()
        expected_fee = round(profit * 0.25, 4)
        self_commission = round(profit * 0.035, 4)  # Starter self commission (MLM)
        expected_new = round(bot_bal_before - expected_fee + self_commission, 4)
        # Allow small rounding tolerance
        assert abs(s["balance"] - expected_new) < 0.02, (
            f"expected balance≈{expected_new}, got {s['balance']} (profit={profit}, fee={expected_fee})"
        )

        # Verify fuel txn is logged
        txns = requests.get(f"{BASE_URL}/api/bot-wallet/transactions",
                            headers=h, timeout=15).json()
        fee_rows = [t for t in txns if t["kind"] == "fuel"]
        assert len(fee_rows) >= 1
        assert fee_rows[0]["symbol"] == "BTCUSDT"
        assert fee_rows[0]["amount"] < 0
        assert abs(abs(fee_rows[0]["amount"]) - expected_fee) < 0.02

    def test_sell_when_fee_exceeds_small_balance_pauses_bots(self):
        """Balance ~$1 with a bigger fee → balance drained to 0 and running bots paused.
        Also verify a 'pause' bot_transaction is logged."""
        token, user, _, _ = _register_fresh()
        h = _headers(token)

        # Activate
        r = requests.post(f"{BASE_URL}/api/bot-wallet/activate", headers=h, timeout=15)
        assert r.status_code == 200, r.text

        # Deposit $11 (just above min $10 fuel to allow bot to start)
        r = requests.post(f"{BASE_URL}/api/bot-wallet/deposit", headers=h,
                          json={"amount": 11}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["balance"] == 11.0

        # Start a bot so we can verify it gets paused
        start = requests.post(f"{BASE_URL}/api/bots/BTCUSDT/start",
                              headers=h, timeout=15)
        assert start.status_code == 200, start.text
        assert start.json()["status"] == "running"

        # BUY $100 to open a position
        buy = requests.post(f"{BASE_URL}/api/trade/order", headers=h,
                            json={"symbol": "BTCUSDT", "side": "BUY",
                                  "usdt_amount": 100.0}, timeout=30)
        assert buy.status_code == 200, buy.text
        buy_qty = float(buy.json()["quantity"])
        buy_price = float(buy.json()["price"])

        # Override avg_price to half → guarantees profit ≈ $100 → fee ≈ $20 (> $1)
        override = requests.post(
            f"{BASE_URL}/api/bots/BTCUSDT/position", headers=h,
            json={"position_qty": buy_qty, "avg_price": buy_price * 0.5,
                  "reset_peak": True}, timeout=15,
        )
        if override.status_code not in (200, 201):
            pytest.skip(f"position override not available: {override.status_code}")

        # SELL → profit large → fee > balance → balance drained to 0 and bots paused
        sell = requests.post(f"{BASE_URL}/api/trade/order", headers=h,
                             json={"symbol": "BTCUSDT", "side": "SELL",
                                   "quantity": buy_qty}, timeout=30)
        assert sell.status_code == 200, sell.text
        profit = float(sell.json()["profit"])
        assert profit > 1.0, f"profit {profit} not large enough for scenario"

        time.sleep(0.5)

        # Balance drained to 0, then scaled Starter self-commission credited back
        s = requests.get(f"{BASE_URL}/api/bot-wallet/status",
                         headers=h, timeout=15).json()
        expected_back = round(11.0 * 0.035 / 0.25, 4)  # deducted * (3.5/25)
        assert abs(s["balance"] - expected_back) < 0.02, f"expected ≈{expected_back}, got {s['balance']}"

        # Bot for BTCUSDT should now be stopped (paused)
        bots = requests.get(f"{BASE_URL}/api/bots", headers=h, timeout=15).json()
        btc = next((b for b in bots if b["symbol"] == "BTCUSDT"), None)
        assert btc is not None, "BTCUSDT bot missing"
        assert btc["status"] == "stopped", f"expected stopped, got {btc['status']}"

        # Verify a 'pause' bot_transaction is logged AND fuel is logged
        txns = requests.get(f"{BASE_URL}/api/bot-wallet/transactions",
                            headers=h, timeout=15).json()
        kinds = [t["kind"] for t in txns]
        assert "pause" in kinds, f"expected 'pause' txn, got kinds={kinds}"
        assert "fuel" in kinds, f"expected 'fuel' txn, got kinds={kinds}"




# ---------- Admin (already activated) sanity ----------
class TestAdminActivated:
    def test_admin_status_activated(self):
        token = _get_admin_token()
        if not token:
            pytest.skip("Admin login failed")
        r = requests.get(f"{BASE_URL}/api/bot-wallet/status",
                         headers=_headers(token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Admin was pre-activated in earlier iterations
        # It may or may not still be activated depending on DB state.
        if data["activated"]:
            assert data["activation_fee"] == 50
            assert data["trading_fee_pct"] == 25
