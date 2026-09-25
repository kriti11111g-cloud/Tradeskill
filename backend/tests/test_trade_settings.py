"""Tests for Trade Settings (bot upsert) master-sync of margin_config & sub_position_tps."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback read frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "admin@tgxbot.com"
ADMIN_PASS = "Admin@12345"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_get_bot_btc(headers):
    r = requests.get(f"{BASE_URL}/api/bots/BTCUSDT", headers=headers)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "margin_call_limit" in j


def test_upsert_bot_pads_to_12(headers):
    payload = {
        "symbol": "BTCUSDT", "first_buy_amount": 15,
        "open_position_double": False,
        "margin_call_limit": 12,
        "whole_take_profit_ratio": 1.5,
        "whole_take_profit_callback": 0.3,
        "buy_in_callback": 1.0,
        "trade_method": "Cycle",
        "sub_take_profit_callback": 0.5,
        "margin_config": [{"drop": 2, "multiplier": 2}, {"drop": 3, "multiplier": 2}],
        "sub_position_tps": [1.5, 1.6],
    }
    r = requests.post(f"{BASE_URL}/api/bots/BTCUSDT", headers=headers, json=payload)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["margin_call_limit"] == 12
    assert len(j["margin_config"]) == 12, f"expected 12 got {len(j['margin_config'])}"
    assert len(j["sub_position_tps"]) == 12
    # trailing padded from last (drop=3, mult=2)
    assert float(j["margin_config"][-1]["drop"]) == 3.0
    assert float(j["margin_config"][-1]["multiplier"]) == 2.0
    # padded tps from whole_take_profit_ratio
    assert float(j["sub_position_tps"][-1]) == 1.5


def test_upsert_bot_trims_to_3(headers):
    payload = {
        "symbol": "BTCUSDT", "first_buy_amount": 15,
        "open_position_double": False,
        "margin_call_limit": 3,
        "whole_take_profit_ratio": 1.8,
        "whole_take_profit_callback": 0.3,
        "buy_in_callback": 1.0,
        "trade_method": "Cycle",
        "sub_take_profit_callback": 0.5,
        "margin_config": [{"drop": i, "multiplier": 2} for i in range(1, 11)],
        "sub_position_tps": [1.5] * 10,
    }
    r = requests.post(f"{BASE_URL}/api/bots/BTCUSDT", headers=headers, json=payload)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["margin_call_limit"] == 3
    assert len(j["margin_config"]) == 3
    assert len(j["sub_position_tps"]) == 3

    # verify persistence
    r2 = requests.get(f"{BASE_URL}/api/bots/BTCUSDT", headers=headers)
    j2 = r2.json()
    assert len(j2["margin_config"]) == 3
    assert len(j2["sub_position_tps"]) == 3


def test_min_first_buy_validation(headers):
    payload = {
        "symbol": "BTCUSDT", "first_buy_amount": 5,
        "open_position_double": False,
        "margin_call_limit": 5,
        "whole_take_profit_ratio": 1.5,
        "whole_take_profit_callback": 0.3,
        "buy_in_callback": 1.0,
        "trade_method": "Cycle",
        "sub_take_profit_callback": 0.5,
    }
    r = requests.post(f"{BASE_URL}/api/bots/BTCUSDT", headers=headers, json=payload)
    assert r.status_code == 400
    assert "Minimum First Buy" in r.text
