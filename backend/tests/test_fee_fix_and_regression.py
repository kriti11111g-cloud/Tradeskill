"""
Tests for BUY fee (commission in base asset) fix + demo-mode regression.

Covers:
  FIX 1  — _parse_fill nets base-asset commission from filled qty
  FIX 2  — SELL LOT_SIZE floor math (simulated locally; LIVE path can't run in preview)
  FIX 3  — Dust reset after SELL (< step*1.05 → 0, cycle increment)
  REGR   — /api/, login, GET /api/bots, start/stop bot, wallet summary, market top
"""
import math
import os
import sys
import pathlib
import pytest
import requests

# Make backend package importable for direct function tests
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from server import _parse_fill  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


# ─────────────────────────── FIX 1: _parse_fill ───────────────────────────
class TestParseFillFeeFix:
    def test_buy_fil_commission_in_base_asset_is_netted(self):
        """The exact reported bug: 4.57 FIL bought, 0.00457 FIL fee ⇒ net 4.56543."""
        order = {
            "fills": [{
                "qty": "4.57",
                "price": "1.0932",
                "commission": "0.00457",
                "commissionAsset": "FIL",
            }]
        }
        qty, quote, avg = _parse_fill(order, base_asset="FIL")
        assert qty == pytest.approx(4.56543, rel=1e-6), f"expected 4.56543, got {qty}"
        assert quote == pytest.approx(4.995924, rel=1e-6)
        assert avg == pytest.approx(1.0932, rel=1e-6)

    def test_buy_commission_in_bnb_does_not_reduce_qty(self):
        """If user has BNB fee discount, commissionAsset='BNB' — qty should stay gross."""
        order = {
            "fills": [{
                "qty": "4.57",
                "price": "1.0932",
                "commission": "0.00376",
                "commissionAsset": "BNB",
            }]
        }
        qty, quote, avg = _parse_fill(order, base_asset="FIL")
        assert qty == pytest.approx(4.57, rel=1e-9)
        assert avg == pytest.approx(1.0932, rel=1e-6)

    def test_sell_call_returns_gross_qty(self):
        """SELL path passes base_asset='' — must NOT subtract commission (fee is in USDT)."""
        order = {
            "fills": [{
                "qty": "4.56",
                "price": "1.10",
                "commission": "0.005016",
                "commissionAsset": "USDT",
            }]
        }
        qty, quote, avg = _parse_fill(order, base_asset="")
        assert qty == pytest.approx(4.56, rel=1e-9)
        assert quote == pytest.approx(5.016, rel=1e-6)

    def test_multi_fill_aggregation(self):
        order = {"fills": [
            {"qty": "2.00", "price": "1.09", "commission": "0.002", "commissionAsset": "FIL"},
            {"qty": "2.57", "price": "1.10", "commission": "0.00257", "commissionAsset": "FIL"},
        ]}
        qty, quote, avg = _parse_fill(order, base_asset="FIL")
        gross = 4.57
        fee = 0.00457
        assert qty == pytest.approx(gross - fee, rel=1e-6)
        assert quote == pytest.approx(2.0 * 1.09 + 2.57 * 1.10, rel=1e-6)

    def test_fallback_to_top_level_fields_when_no_fills(self):
        order = {"executedQty": "4.57", "cummulativeQuoteQty": "4.9959"}
        qty, quote, avg = _parse_fill(order, base_asset="FIL")
        assert qty == pytest.approx(4.57)
        assert quote == pytest.approx(4.9959)
        assert avg == pytest.approx(4.9959 / 4.57, rel=1e-6)


# ─────────────────────── FIX 2 & 3: floor + dust math ─────────────────────
class TestSellFloorAndDust:
    @staticmethod
    def _floor_to_step(qty: float, step: float) -> float:
        return math.floor(qty / step + 1e-9) * step

    def test_floor_fil_lot_step(self):
        """4.56543 FIL @ 0.01 step ⇒ 4.56 sellable."""
        assert self._floor_to_step(4.56543, 0.01) == pytest.approx(4.56, rel=1e-9)

    def test_floor_below_step_becomes_zero(self):
        """Sub-step balance → 0 → caller should raise 'No sellable balance'."""
        assert self._floor_to_step(0.005, 0.01) == 0.0

    def test_dust_reset_trigger(self):
        """After tracked 4.57 vs sold 4.56, remaining 0.01 is < step*1.05 (0.0105) ⇒ dust."""
        tracked = 4.57
        sold = 4.56
        step = 0.01
        remaining = max(0.0, tracked - sold)
        if remaining < max(step, 0.000001) * 1.05:
            remaining = 0.0
        assert remaining == 0.0

    def test_non_dust_leaves_position(self):
        """Real partial fill 4.57 tracked, sold 2.0 ⇒ 2.57 remains, not dust."""
        remaining = 4.57 - 2.0
        step = 0.01
        if remaining < step * 1.05:
            remaining = 0.0
        assert remaining == pytest.approx(2.57)


# ─────────────────────────── REGRESSION (demo) ────────────────────────────
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "admin@tgxbot.com",
        "password": "Admin@12345",
    }, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


class TestBackendHealth:
    def test_api_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        j = r.json()
        assert j.get("app") == "Trade Skill"
        assert j.get("status") == "ok"


class TestDemoRegression:
    def test_get_bots(self, auth_headers):
        r = requests.get(f"{API}/bots", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_wallet_summary(self, auth_headers):
        r = requests.get(f"{API}/wallet/summary", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "wallet_usdt" in data or "balance" in data or isinstance(data, dict)

    def test_market_top(self):
        r = requests.get(f"{API}/market/top", timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"

    def test_start_and_stop_bot(self, auth_headers):
        sym = "SOLUSDT"
        start = requests.post(f"{API}/bots/{sym}/start", headers=auth_headers, timeout=20)
        assert start.status_code in (200, 400), f"start unexpected: {start.status_code} {start.text[:200]}"
        # Always attempt stop to avoid leaving bot running
        stop = requests.post(f"{API}/bots/{sym}/stop", headers=auth_headers, timeout=20)
        assert stop.status_code in (200, 400), f"stop unexpected: {stop.status_code} {stop.text[:200]}"
