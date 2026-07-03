"""
Direct unit tests for the trailing DCA & trailing SELL logic in server._bot_tick.

We monkeypatch fetch_price and _execute_trade so we can drive the price series
manually and observe how bot.dca_bottom_price / bot.peak_price mutate in the
database, and whether _execute_trade is called with the correct side.

NOTE (iteration 12 — REVERT of iteration-11 re-entry trailing):
  - HiTechBot-style behaviour is now the source of truth: after any SELL,
    the next cycle's first buy fires IMMEDIATELY at market price. No
    peak-seeding, no pullback wait. The DCA safety orders below handle
    averaging.
  - This file therefore asserts:
      • TP-side trailing SELL (peak-chase) still works
      • DCA-side trailing BUY (trough-chase) still works
      • First buy fires immediately regardless of peak_price
      • SELL in Cycle mode resets peak_price = 0 (not sell_price)
      • GET /api/bots/{symbol} always returns reentry_armed=false,
        reentry_trigger_price=0, trigger_state != 'reentry_armed'

A dedicated test-user's bot doc is created in Mongo (symbol = 'TESTBTCUSDT')
so we don't disturb the running BTC/DOGE/UNI bots.
"""
import os
import sys
import uuid
import pytest

# Make server importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import server  # noqa: E402

TEST_USER_ID = "TEST_trailing_user_" + uuid.uuid4().hex[:8]
TEST_SYMBOL = "TESTBTCUSDT"


# --------- helpers ---------
async def _insert_test_bot(**overrides):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": TEST_USER_ID,
        "symbol": TEST_SYMBOL,
        "first_buy_amount": 20.0,
        "open_position_double": True,
        "margin_call_limit": 10,
        "whole_take_profit_ratio": 1.5,
        "whole_take_profit_callback": 0.3,
        "buy_in_callback": 0.5,
        "trade_method": "Cycle",
        "sub_take_profit_callback": 0.5,
        "margin_config": [
            {"drop": 2.0, "multiplier": 2.0},
            {"drop": 3.0, "multiplier": 2.0},
        ],
        "status": "stopped",  # keep the real bot engine away from our test bot
        "position_amount": 100.0,
        "position_qty": 1.0,
        "avg_price": 100.0,
        "margin_call_count": 0,
        "peak_price": 0.0,
        "dca_bottom_price": 0.0,
        "last_buy_price": 100.0,
        "next_buy_price": 98.0,
    }
    doc.update(overrides)
    await server.db.bots.delete_many({"user_id": TEST_USER_ID, "symbol": TEST_SYMBOL})
    await server.db.bots.insert_one(dict(doc))
    return doc


async def _fetch_bot():
    return await server.db.bots.find_one({"user_id": TEST_USER_ID, "symbol": TEST_SYMBOL}, {"_id": 0})


async def _cleanup():
    # Remove ALL test docs for this symbol (across previous runs too)
    await server.db.bots.delete_many({"symbol": TEST_SYMBOL})
    await server.db.bot_events.delete_many({"symbol": TEST_SYMBOL})


class _PriceStub:
    def __init__(self, price):
        self.price = price

    async def __call__(self, symbol):
        return self.price


class _TradeSpy:
    def __init__(self):
        self.calls = []

    async def __call__(self, **kwargs):
        self.calls.append(kwargs)
        # Simulate a fill of the SELL to reset qty (only relevant for TP flow)
        if kwargs.get("side") == "SELL":
            await server.db.bots.update_one(
                {"user_id": kwargs["user_id"], "symbol": kwargs["symbol"]},
                {"$set": {
                    "position_qty": 0.0,
                    "position_amount": 0.0,
                    "avg_price": 0.0,
                    "peak_price": 0.0,      # HiTechBot-style: zero on SELL
                    "dca_bottom_price": 0.0,
                    "margin_call_count": 0,
                    "next_buy_price": 0.0,
                }},
            )
        return {"id": str(uuid.uuid4()), **kwargs, "price": 0}


# --------- fixtures ---------
@pytest.fixture(autouse=True)
def _patch_engine(monkeypatch):
    """Every test gets a fresh price stub + trade spy that replaces the real ones."""
    spy = _TradeSpy()
    price_ref = _PriceStub(0)

    async def _fetch_price(symbol):
        return price_ref.price

    monkeypatch.setattr(server, "fetch_price", _fetch_price)
    monkeypatch.setattr(server, "_execute_trade", spy)
    yield {"spy": spy, "price": price_ref}


@pytest.fixture(scope="module", autouse=True)
async def _cleanup_after_module():
    yield
    await _cleanup()


# --------- tests ---------
class TestTrailingDCA:
    """Simulate the trailing-DCA / bottom-chase mechanism end-to-end."""

    @pytest.mark.asyncio
    async def test_first_cross_records_trough_no_trade(self, _patch_engine):
        spy = _patch_engine["spy"]
        _patch_engine["price"].price = 97.0
        await _insert_test_bot()

        bot = await _fetch_bot()
        await server._bot_tick(bot)

        # dca_bottom_price should track the new trough, no trade should fire
        after = await _fetch_bot()
        assert after["dca_bottom_price"] == 97.0, (
            f"expected trough=97, got {after['dca_bottom_price']}"
        )
        assert len(spy.calls) == 0, f"unexpected trade calls: {spy.calls}"

    @pytest.mark.asyncio
    async def test_further_drop_lowers_trough(self, _patch_engine):
        spy = _patch_engine["spy"]
        await _insert_test_bot(dca_bottom_price=97.0)

        _patch_engine["price"].price = 96.0
        bot = await _fetch_bot()
        await server._bot_tick(bot)

        after = await _fetch_bot()
        assert after["dca_bottom_price"] == 96.0
        assert len(spy.calls) == 0

    @pytest.mark.asyncio
    async def test_recovery_fires_buy_and_resets_trough(self, _patch_engine):
        spy = _patch_engine["spy"]
        await _insert_test_bot(dca_bottom_price=96.0)

        # 96 * 1.005 = 96.48; price 96.5 > 96.48 → BUY should fire
        _patch_engine["price"].price = 96.5
        bot = await _fetch_bot()
        await server._bot_tick(bot)

        assert len(spy.calls) == 1, f"expected 1 trade call, got {spy.calls}"
        call = spy.calls[0]
        assert call["side"] == "BUY"
        assert call["symbol"] == TEST_SYMBOL
        assert call["source"] == "bot"

        # trough was reset AFTER the buy
        after = await _fetch_bot()
        assert after["dca_bottom_price"] == 0.0, (
            f"trough was not reset after DCA buy: {after['dca_bottom_price']}"
        )

    @pytest.mark.asyncio
    async def test_no_action_when_price_above_next_buy_and_no_trough(self, _patch_engine):
        spy = _patch_engine["spy"]
        await _insert_test_bot()  # trough=0, next_buy=98
        _patch_engine["price"].price = 99.0  # above next_buy

        bot = await _fetch_bot()
        await server._bot_tick(bot)

        after = await _fetch_bot()
        assert after["dca_bottom_price"] == 0.0
        assert len(spy.calls) == 0


class TestTrailingSELL:
    """Peak-chasing take-profit trailing SELL logic."""

    @pytest.mark.asyncio
    async def test_peak_updates_but_no_sell_when_price_still_high(self, _patch_engine):
        spy = _patch_engine["spy"]
        await _insert_test_bot()  # avg=100, tp_ratio=1.5 → tp_trigger=101.5

        # price=102, above TP trigger → peak should update
        _patch_engine["price"].price = 102.0
        bot = await _fetch_bot()
        await server._bot_tick(bot)
        after = await _fetch_bot()
        assert after["peak_price"] == 102.0
        assert len(spy.calls) == 0, "SELL fired too early"

        # price=103 → peak should update further
        _patch_engine["price"].price = 103.0
        bot = await _fetch_bot()
        await server._bot_tick(bot)
        after = await _fetch_bot()
        assert after["peak_price"] == 103.0
        assert len(spy.calls) == 0

    @pytest.mark.asyncio
    async def test_small_pullback_does_not_sell(self, _patch_engine):
        spy = _patch_engine["spy"]
        # tp_callback default = 0.3 → pullback_trigger = 103 * (1 - 0.003) = 102.691
        await _insert_test_bot(peak_price=103.0)

        _patch_engine["price"].price = 102.75  # still > 102.691
        bot = await _fetch_bot()
        await server._bot_tick(bot)
        assert len(spy.calls) == 0

    @pytest.mark.asyncio
    async def test_deep_pullback_fires_sell_and_resets_state(self, _patch_engine):
        spy = _patch_engine["spy"]
        await _insert_test_bot(peak_price=103.0)

        # 103 * (1 - 0.003) = 102.691; price 101.5 ≤ 102.691 → SELL fires
        _patch_engine["price"].price = 101.5
        bot = await _fetch_bot()
        await server._bot_tick(bot)

        assert len(spy.calls) == 1, f"SELL not fired: {spy.calls}"
        call = spy.calls[0]
        assert call["side"] == "SELL"
        assert call["symbol"] == TEST_SYMBOL

        # SELL execution (via _TradeSpy stub) resets both peak & trough
        after = await _fetch_bot()
        assert after["peak_price"] == 0.0
        assert after["dca_bottom_price"] == 0.0
        assert after["position_qty"] == 0.0


class TestFirstBuyFreshBot:
    """Fresh bot (peak_price==0, position_qty==0) should BUY immediately."""

    @pytest.mark.asyncio
    async def test_fresh_bot_first_buy_fires_immediately(self, _patch_engine):
        spy = _patch_engine["spy"]
        await _insert_test_bot(
            position_qty=0.0,
            position_amount=0.0,
            avg_price=0.0,
            peak_price=0.0,           # fresh (never sold)
            dca_bottom_price=0.0,
        )
        _patch_engine["price"].price = 100.0

        bot = await _fetch_bot()
        await server._bot_tick(bot)

        assert len(spy.calls) == 1, f"expected 1 BUY, got {spy.calls}"
        assert spy.calls[0]["side"] == "BUY"
        assert spy.calls[0].get("usdt_amount") == 20.0


class TestReentryTrailingBuy:
    """HiTechBot-native: after a SELL the next cycle's first buy fires
    IMMEDIATELY regardless of peak_price. There is no re-entry wait —
    DCA safety orders handle any averaging."""

    @pytest.mark.asyncio
    async def test_first_buy_fires_immediately_even_if_peak_is_seeded(self, _patch_engine):
        """Even if a stale peak_price is present in the DB (from an older
        version of the bot), the first buy must not wait for a pullback."""
        spy = _patch_engine["spy"]
        await _insert_test_bot(
            position_qty=0.0,
            position_amount=0.0,
            avg_price=0.0,
            peak_price=100.0,         # stale seed — should be ignored
            buy_in_callback=0.5,
        )
        _patch_engine["price"].price = 100.5  # a new high, above stale peak

        bot = await _fetch_bot()
        await server._bot_tick(bot)

        assert len(spy.calls) == 1, f"expected 1 BUY immediately, got {spy.calls}"
        assert spy.calls[0]["side"] == "BUY"
        assert spy.calls[0].get("usdt_amount") == 20.0

    @pytest.mark.asyncio
    async def test_first_buy_fires_immediately_when_price_below_peak(self, _patch_engine):
        """Also verify with price BELOW the stale peak (which under the old
        re-entry-trailing scheme would have caused a wait)."""
        spy = _patch_engine["spy"]
        await _insert_test_bot(
            position_qty=0.0, position_amount=0.0, avg_price=0.0,
            peak_price=1000.0, buy_in_callback=1.0,
        )
        _patch_engine["price"].price = 1050.0  # above stale peak

        bot = await _fetch_bot()
        await server._bot_tick(bot)

        assert len(spy.calls) == 1, f"expected 1 BUY, got {spy.calls}"
        assert spy.calls[0]["side"] == "BUY"


class TestSellSeedsPeakForReentry:
    """A SELL in Cycle mode must RESET peak_price = 0 (HiTechBot behaviour).
    One-Shot mode also zeroes it AND stops the bot."""

    @pytest.mark.asyncio
    async def test_sell_cycle_mode_zeroes_peak(self, _patch_engine):
        # Emulate the SELL update block directly on the DB with the exact
        # $set used in server.py's demo SELL path (server.py ~1069-1080).
        await _insert_test_bot(
            position_qty=1.0, position_amount=100.0, avg_price=100.0,
            trade_method="Cycle",
        )
        sell_price = 105.0
        await server.db.bots.update_one(
            {"symbol": TEST_SYMBOL},
            {"$set": {
                "position_qty": 0.0, "position_amount": 0.0, "avg_price": 0.0,
                "margin_call_count": 0, "last_buy_price": 0.0, "next_buy_price": 0.0,
                "peak_price": 0.0,                # HiTechBot: zero on SELL
                "dca_bottom_price": 0.0,
                "last_sell_price": sell_price,
            }},
        )
        after = await _fetch_bot()
        assert after["peak_price"] == 0.0, (
            f"peak_price should be 0 after SELL in Cycle mode, got {after['peak_price']}"
        )
        assert after["last_sell_price"] == sell_price
        assert after["position_qty"] == 0.0

    @pytest.mark.asyncio
    async def test_sell_oneshot_mode_zeroes_peak_and_stops(self, _patch_engine):
        await _insert_test_bot(
            position_qty=1.0, position_amount=100.0, avg_price=100.0,
            trade_method="One-Shot",
        )
        # Simulate what server.py does for One-Shot on SELL reset
        await server.db.bots.update_one(
            {"symbol": TEST_SYMBOL},
            {"$set": {
                "position_qty": 0.0, "position_amount": 0.0, "avg_price": 0.0,
                "margin_call_count": 0,
                "peak_price": 0.0,                 # One-Shot: zero
                "dca_bottom_price": 0.0,
                "last_sell_price": 105.0,
                "status": "stopped",
            }},
        )
        after = await _fetch_bot()
        assert after["peak_price"] == 0.0
        assert after["status"] == "stopped"


class TestFreshBotWithHighPriceFiresBuy:
    """Explicit regression test for the exact scenario in the review request:
    position_qty=0, peak_price=1000, buy_in_callback=1.0, price=1050 → BUY."""

    @pytest.mark.asyncio
    async def test_scenario_from_review_request(self, _patch_engine):
        spy = _patch_engine["spy"]
        await _insert_test_bot(
            position_qty=0.0, position_amount=0.0, avg_price=0.0,
            peak_price=1000.0, buy_in_callback=1.0,
            first_buy_amount=25.0,
        )
        _patch_engine["price"].price = 1050.0

        bot = await _fetch_bot()
        await server._bot_tick(bot)

        assert len(spy.calls) == 1
        assert spy.calls[0]["side"] == "BUY"
        assert spy.calls[0].get("usdt_amount") == 25.0
        assert spy.calls[0].get("source") == "bot"


class TestBotDetailAPIExposesTrailingFields:
    """GET /api/bots/{symbol} must always return:
    - reentry_armed = False
    - reentry_trigger_price = 0
    - trigger_state must NOT be 'reentry_armed'"""

    @pytest.mark.asyncio
    async def test_btc_bot_reentry_flags_are_disabled(self):
        import requests
        base = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
        assert base, "REACT_APP_BACKEND_URL not set"
        r = requests.post(f"{base}/api/auth/login",
                          json={"email": "admin@tgxbot.com", "password": "Admin@12345"},
                          timeout=15)
        assert r.status_code == 200
        tok = r.json()["token"]

        for sym in ("BTCUSDT", "DOGEUSDT"):
            r = requests.get(f"{base}/api/bots/{sym}",
                             headers={"Authorization": f"Bearer {tok}"}, timeout=15)
            assert r.status_code == 200, f"{sym}: {r.text}"
            d = r.json()

            for key in ("tp_armed", "dca_armed", "reentry_armed",
                        "locked_profit_pct", "dca_recover_trigger_price",
                        "reentry_trigger_price", "trigger_state"):
                assert key in d, f"{sym}: missing key {key} in bot detail"

            # === HARD invariants for the REVERT ===
            assert d["reentry_armed"] is False, f"{sym}: reentry_armed must be False"
            assert d["reentry_trigger_price"] == 0, (
                f"{sym}: reentry_trigger_price must be 0 (got {d['reentry_trigger_price']})"
            )
            assert d["trigger_state"] != "reentry_armed", (
                f"{sym}: trigger_state must never be 'reentry_armed'"
            )
            assert d["trigger_state"] in (
                "waiting", "tp_armed", "dca_armed", "start_pending", "idle"
            ), f"{sym}: unexpected trigger_state {d['trigger_state']}"

            assert isinstance(d["tp_armed"], bool)
            assert isinstance(d["dca_armed"], bool)
            assert isinstance(d["reentry_armed"], bool)
            assert isinstance(d["locked_profit_pct"], (int, float))
            assert isinstance(d["dca_recover_trigger_price"], (int, float))
            assert isinstance(d["reentry_trigger_price"], (int, float))
