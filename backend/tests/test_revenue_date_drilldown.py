"""
TGX BOT — Date drill-down feature tests.
Covers:
  - GET /api/revenue/summary → 'by_date' contract (date, profit, trades, symbols[])
  - GET /api/transactions?date=YYYY-MM-DD (regex prefix match on created_at)
  - Combined ?symbol=&date= filters intersect
  - Empty date, unauthenticated
  - Existing keys preserved (daily, today_profit, by_symbol)
"""
import os
import datetime as dt
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASS = "Admin@12345"


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def seeded_today_sell(admin_token):
    """Guarantee at least one SELL today."""
    sym = "BTCUSDT"
    requests.post(
        f"{API}/bots/{sym}/position",
        headers=_headers(admin_token),
        json={"position_qty": 0.001, "avg_price": 1.0, "margin_call_count": 0},
        timeout=15,
    )
    r = requests.post(
        f"{API}/trade/order",
        headers=_headers(admin_token),
        json={"symbol": sym, "side": "SELL"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return sym


@pytest.fixture(scope="module")
def today_utc() -> str:
    return dt.datetime.utcnow().strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# /api/revenue/summary → by_date
# ---------------------------------------------------------------------------
class TestRevenueSummaryByDate:
    def test_summary_has_by_date_list(self, admin_token, seeded_today_sell, today_utc):
        r = requests.get(f"{API}/revenue/summary", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "by_date" in data, "by_date key must be present"
        assert isinstance(data["by_date"], list)
        assert len(data["by_date"]) >= 1, "expected at least one by_date entry after seed"

    def test_by_date_row_schema(self, admin_token, seeded_today_sell):
        r = requests.get(f"{API}/revenue/summary", headers=_headers(admin_token), timeout=15)
        data = r.json()
        row = data["by_date"][0]
        for key in ("date", "profit", "trades", "symbols"):
            assert key in row, f"missing key {key} in by_date row: {row}"
        assert isinstance(row["date"], str) and len(row["date"]) == 10
        assert isinstance(row["profit"], (int, float))
        assert isinstance(row["trades"], int) and row["trades"] >= 1
        assert isinstance(row["symbols"], list) and len(row["symbols"]) >= 1

    def test_by_date_sorted_desc(self, admin_token, seeded_today_sell):
        r = requests.get(f"{API}/revenue/summary", headers=_headers(admin_token), timeout=15)
        data = r.json()
        dates = [row["date"] for row in data["by_date"]]
        assert dates == sorted(dates, reverse=True), "by_date must be sorted most-recent first"

    def test_today_present_in_by_date(self, admin_token, seeded_today_sell, today_utc):
        r = requests.get(f"{API}/revenue/summary", headers=_headers(admin_token), timeout=15)
        data = r.json()
        dates = [row["date"] for row in data["by_date"]]
        assert today_utc in dates, f"today ({today_utc}) must appear in by_date after SELL"

    def test_existing_keys_preserved(self, admin_token, seeded_today_sell):
        """REGRESSION — daily/today_profit/by_symbol must still exist."""
        r = requests.get(f"{API}/revenue/summary", headers=_headers(admin_token), timeout=15)
        data = r.json()
        for k in ("total_profit", "today_profit", "today_trades", "total_trades", "daily", "by_symbol"):
            assert k in data, f"existing key {k} missing from summary"

    def test_by_date_totals_match_today_profit(self, admin_token, seeded_today_sell, today_utc):
        r = requests.get(f"{API}/revenue/summary", headers=_headers(admin_token), timeout=15)
        data = r.json()
        today_row = next((row for row in data["by_date"] if row["date"] == today_utc), None)
        assert today_row is not None
        # Allow small float noise
        assert abs(today_row["profit"] - data["today_profit"]) < 1e-3


# ---------------------------------------------------------------------------
# /api/transactions?date=
# ---------------------------------------------------------------------------
class TestTransactionsDateFilter:
    def test_filter_by_date_returns_only_that_day(self, admin_token, seeded_today_sell, today_utc):
        r = requests.get(
            f"{API}/transactions?date={today_utc}",
            headers=_headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 1
        for row in rows:
            assert row["created_at"].startswith(today_utc), (
                f"row {row['id']} created_at={row['created_at']} not in {today_utc}"
            )

    def test_filter_by_empty_date_returns_all(self, admin_token, seeded_today_sell):
        """Empty ?date= param must NOT filter (should be treated as no filter)."""
        r_all = requests.get(f"{API}/transactions", headers=_headers(admin_token), timeout=15)
        r_empty = requests.get(f"{API}/transactions?date=", headers=_headers(admin_token), timeout=15)
        assert r_all.status_code == 200 and r_empty.status_code == 200
        assert len(r_empty.json()) == len(r_all.json())

    def test_filter_by_date_no_trades(self, admin_token):
        r = requests.get(
            f"{API}/transactions?date=2000-01-01",
            headers=_headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_symbol_and_date_intersect(self, admin_token, seeded_today_sell, today_utc):
        sym = seeded_today_sell
        r = requests.get(
            f"{API}/transactions?symbol={sym}&date={today_utc}",
            headers=_headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1
        for row in rows:
            assert row["symbol"] == sym
            assert row["created_at"].startswith(today_utc)

    def test_symbol_and_date_no_intersection(self, admin_token, today_utc):
        r = requests.get(
            f"{API}/transactions?symbol=BTCUSDT&date=2000-01-01",
            headers=_headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_unauth_date_filter(self, today_utc):
        r = requests.get(f"{API}/transactions?date={today_utc}", timeout=10)
        assert r.status_code in (401, 403)
