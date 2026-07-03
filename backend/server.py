from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import asyncio
import logging
import secrets as pysecrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
import httpx
from cryptography.fernet import Fernet
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.security import HTTPBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from starlette.concurrency import run_in_threadpool
from binance.client import Client as BinanceClient
from binance.exceptions import BinanceAPIException, BinanceRequestException


class _SafeBinanceClient(BinanceClient):
    """Skip the auto-ping in the parent Client __init__ so a geo-restricted
    or unreachable Binance server does not blow up client construction.
    Errors will surface when an actual order/account call is made."""
    def ping(self):
        try:
            return super().ping()
        except Exception:
            return None

# ==== Setup ====
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
MASTER_KEY = os.environ['MASTER_KEY']
JWT_ALGORITHM = "HS256"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
fernet = Fernet(MASTER_KEY.encode())

BINANCE_PUBLIC = "https://data-api.binance.vision"
ALLOWED_SYMBOLS = {
    # Fallback set if Binance exchangeInfo isn't reachable at startup — overridden at boot.
    # Top majors
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT",
    "TRXUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT", "LINKUSDT", "TONUSDT", "SHIBUSDT",
    "LTCUSDT", "BCHUSDT", "UNIUSDT", "ATOMUSDT", "XLMUSDT", "NEARUSDT",
    "APTUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "SEIUSDT", "INJUSDT", "FILUSDT",
    "ETCUSDT", "HBARUSDT", "VETUSDT", "ICPUSDT", "IMXUSDT", "STXUSDT", "AAVEUSDT",
    "MKRUSDT", "GRTUSDT", "RUNEUSDT", "ALGOUSDT", "SANDUSDT", "MANAUSDT",
    "PEPEUSDT", "FLOKIUSDT", "WIFUSDT", "BONKUSDT", "ORDIUSDT",
    "STRKUSDT", "LDOUSDT", "RENDERUSDT", "TIAUSDT", "JUPUSDT",
}

app = FastAPI(title="TGX BOT API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tgx")


# ==== Utilities ====
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": now_utc() + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def encrypt_text(v: str) -> str:
    return fernet.encrypt(v.encode()).decode()


def decrypt_text(v: str) -> str:
    return fernet.decrypt(v.encode()).decode()


def mask(v: str) -> str:
    if not v or len(v) < 8:
        return "****"
    return v[:4] + "****" + v[-4:]


def gen_ref_code() -> str:
    return "TGX" + pysecrets.token_hex(3).upper()


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


# ==== Models ====
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None
    referral_code: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class BindAPIIn(BaseModel):
    api_key: str
    api_secret: str
    mode: Literal["real", "demo", "testnet"] = "demo"


class MarginRule(BaseModel):
    drop: float = 2.0        # % below last buy price
    multiplier: float = 2.0  # multiplier of first_buy_amount for this round


class BotConfigIn(BaseModel):
    symbol: str
    first_buy_amount: float = 20.0
    open_position_double: bool = True
    margin_call_limit: int = 5
    whole_take_profit_ratio: float = 1.5
    whole_take_profit_callback: float = 0.3
    buy_in_callback: float = 1.0
    trade_method: Literal["Cycle", "One-Shot"] = "Cycle"
    sub_take_profit_callback: float = 0.5
    margin_config: Optional[List[MarginRule]] = None


class OrderIn(BaseModel):
    symbol: str
    side: Literal["BUY", "SELL"]
    usdt_amount: Optional[float] = None
    quantity: Optional[float] = None


class WalletTxnIn(BaseModel):
    type: Literal["deposit", "withdraw", "transfer"]
    amount: float
    asset: str = "USDT"
    note: Optional[str] = None


class PositionOverrideIn(BaseModel):
    position_qty: float = Field(ge=0)
    avg_price: float = Field(ge=0)
    margin_call_count: Optional[int] = Field(default=None, ge=0)
    reset_peak: bool = True


# ==== Auth Routes ====
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered")

    user_id = str(uuid.uuid4())
    ref_code = gen_ref_code()
    while await db.users.find_one({"referral_code": ref_code}):
        ref_code = gen_ref_code()

    referred_by = None
    if body.referral_code:
        ref = await db.users.find_one({"referral_code": body.referral_code.upper()})
        if ref:
            referred_by = ref["id"]

    doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name or email.split("@")[0],
        "role": "user",
        "referral_code": ref_code,
        "referred_by": referred_by,
        "rank": "Bronze",
        "activated": False,
        "wallet_usdt": 1000.0,  # demo starter balance
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)

    # Seed some rewards
    await db.rewards.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "joining",
        "amount": 5.0,
        "status": "claimable",
        "note": "Welcome bonus for joining TGX BOT",
        "created_at": iso(now_utc()),
    })

    token = create_access_token(user_id, email)
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=604800, path="/")
    return {
        "token": token,
        "user": {k: v for k, v in doc.items() if k not in ("password_hash", "_id")},
    }


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(user["id"], email)
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=604800, path="/")
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ==== Binance API Keys ====
@api.post("/binance/bind")
async def bind_api(body: BindAPIIn, user: dict = Depends(get_current_user)):
    doc = {
        "user_id": user["id"],
        "api_key_enc": encrypt_text(body.api_key),
        "api_secret_enc": encrypt_text(body.api_secret),
        "api_key_mask": mask(body.api_key),
        "mode": body.mode,
        "updated_at": iso(now_utc()),
    }
    await db.binance_keys.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    await db.users.update_one({"id": user["id"]}, {"$set": {"activated": True}})
    return {"ok": True, "mask": doc["api_key_mask"], "mode": body.mode}


@api.get("/binance/bind")
async def get_bind(user: dict = Depends(get_current_user)):
    row = await db.binance_keys.find_one({"user_id": user["id"]}, {"_id": 0, "api_key_enc": 0, "api_secret_enc": 0})
    return row or {"mode": None, "api_key_mask": None}


@api.delete("/binance/bind")
async def unbind(user: dict = Depends(get_current_user)):
    await db.binance_keys.delete_one({"user_id": user["id"]})
    return {"ok": True}


# ==== Public Market Data ====
@api.get("/market/ticker/{symbol}")
async def ticker(symbol: str):
    symbol = symbol.upper()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/price", params={"symbol": symbol})
        if r.status_code != 200:
            raise HTTPException(400, r.text)
        return r.json()


@api.get("/market/stats/{symbol}")
async def stats(symbol: str):
    symbol = symbol.upper()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/24hr", params={"symbol": symbol})
        if r.status_code != 200:
            raise HTTPException(400, r.text)
        return r.json()


@api.get("/market/klines/{symbol}")
async def klines(symbol: str, interval: str = "1h", limit: int = 48):
    symbol = symbol.upper()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{BINANCE_PUBLIC}/api/v3/klines", params={"symbol": symbol, "interval": interval, "limit": limit})
        if r.status_code != 200:
            raise HTTPException(400, r.text)
        return r.json()


@api.get("/market/pairs")
async def pairs_summary(limit: int = 50):
    """Fetch 24hr stats for all allowed symbols in ONE Binance batch call, filter and sort by volume."""
    allow = set(ALLOWED_SYMBOLS)
    async with httpx.AsyncClient(timeout=10) as c:
        try:
            r = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/24hr")
            r.raise_for_status()
        except Exception as e:
            logger.warning(f"pairs_summary batch failed: {e}")
            return {"pairs": []}
        data = r.json()

    out = []
    for d in data:
        sym = d.get("symbol")
        if sym not in allow:
            continue
        try:
            out.append({
                "symbol": sym,
                "last_price": float(d.get("lastPrice", 0)),
                "change_pct": float(d.get("priceChangePercent", 0)),
                "volume": float(d.get("quoteVolume", 0)),
                "high": float(d.get("highPrice", 0)),
                "low": float(d.get("lowPrice", 0)),
            })
        except Exception:
            continue
    # Sort by 24h quote volume (most liquid first) and cap
    out.sort(key=lambda x: x["volume"], reverse=True)
    return {"pairs": out[:limit]}


# Simple in-memory cache for the top-50 list (refresh every 5 min)
_TOP_CACHE = {"ts": 0.0, "data": None}
_STABLE_SYMBOLS = {"USDT", "USDC", "DAI", "TUSD", "BUSD", "FDUSD", "PYUSD", "USDD", "USDS"}


@api.get("/market/top")
async def top_market(limit: int = 50, force: bool = False):
    """Top-N coins by market cap (CoinGecko) intersected with Binance-listed USDT pairs.
    Returns rank, name, symbol, image (from CoinGecko) + live price/change (from Binance).
    Cached for 5 minutes. Pass ?force=1 to bypass cache."""
    import time as _t
    now = _t.time()
    if not force and _TOP_CACHE["data"] and _TOP_CACHE["data"].get("count", 0) >= limit and (now - _TOP_CACHE["ts"] < 300):
        return _TOP_CACHE["data"]

    async with httpx.AsyncClient(timeout=12) as c:
        # 1) fetch top coins by market cap — over-fetch (top 250) so we still get
        #    the requested `limit` after filtering out stables + non-Binance coins.
        try:
            cg = await c.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                params={
                    "vs_currency": "usd",
                    "order": "market_cap_desc",
                    "per_page": 250,
                    "page": 1,
                    "sparkline": "false",
                    "price_change_percentage": "24h",
                },
            )
            cg.raise_for_status()
            coins = cg.json()
        except Exception as e:
            logger.warning(f"top_market CoinGecko failed: {e}")
            # Serve stale cache if we have one; otherwise empty.
            if _TOP_CACHE["data"]:
                return _TOP_CACHE["data"]
            return {"coins": [], "count": 0, "error": "coingecko_unreachable"}

        # 2) fetch all Binance USDT pairs (from ticker)
        try:
            bn = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/24hr")
            bn.raise_for_status()
            binance = {d["symbol"]: d for d in bn.json()}
        except Exception:
            binance = {}

    out = []
    for coin in coins:
        sym = coin.get("symbol", "").upper()
        if not sym or sym in _STABLE_SYMBOLS:
            continue
        # Heuristic: any coin whose name contains "USD" (case-insensitive) is likely
        # a stablecoin variant — skip. Also skip if price ≈ $1 within 1% (safety net).
        name_upper = (coin.get("name") or "").upper()
        current = float(coin.get("current_price") or 0)
        if "USD" in name_upper or (0.985 <= current <= 1.015 and current > 0):
            continue
        pair = f"{sym}USDT"
        # Some coins on Binance use special aliases (e.g., IOTA -> IOTAUSDT is fine).
        binance_row = binance.get(pair)
        if not binance_row:
            continue
        out.append({
            "rank": coin.get("market_cap_rank"),
            "symbol": pair,
            "asset": sym,
            "name": coin.get("name"),
            "image": coin.get("image"),
            "market_cap": coin.get("market_cap"),
            "last_price": float(binance_row.get("lastPrice", 0)),
            "change_pct": float(binance_row.get("priceChangePercent", 0)),
            "volume": float(binance_row.get("quoteVolume", 0)),
            "high": float(binance_row.get("highPrice", 0)),
            "low": float(binance_row.get("lowPrice", 0)),
        })
        if len(out) >= limit:
            break

    result = {"coins": out, "count": len(out), "cached_at": iso(now_utc())}
    _TOP_CACHE["ts"] = now
    _TOP_CACHE["data"] = result
    return result


# ==== Bot Config ====
DEFAULT_MARGIN_CONFIG = [
    {"drop": 2.0, "multiplier": 2.0},
    {"drop": 3.0, "multiplier": 2.0},
    {"drop": 4.0, "multiplier": 2.0},
    {"drop": 6.0, "multiplier": 2.0},
    {"drop": 10.0, "multiplier": 2.0},
]

DEFAULT_BOT_CFG = {
    "first_buy_amount": 20.0,
    "open_position_double": True,
    "margin_call_limit": 5,
    "whole_take_profit_ratio": 1.5,
    "whole_take_profit_callback": 0.3,
    "buy_in_callback": 1.0,
    "trade_method": "Cycle",
    "sub_take_profit_callback": 0.5,
    "margin_config": DEFAULT_MARGIN_CONFIG,
    "status": "stopped",
    "position_amount": 0.0,
    "position_qty": 0.0,
    "avg_price": 0.0,
    "margin_call_count": 0,
}


def _get_margin_rule(bot: dict, round_idx: int) -> dict:
    """Return the {drop, multiplier} rule for the given DCA round (0-indexed).
    Falls back to the last rule if round_idx exceeds the config length."""
    cfg = bot.get("margin_config") or DEFAULT_MARGIN_CONFIG
    if not cfg:
        return {"drop": float(bot.get("buy_in_callback", 1.0) or 1.0), "multiplier": 1.0}
    idx = min(round_idx, len(cfg) - 1)
    r = cfg[idx]
    return {
        "drop": float(r.get("drop", 2.0) or 2.0),
        "multiplier": float(r.get("multiplier", 2.0) or 2.0),
    }


def _compute_dca_ladder(bot: dict, current_price: float = 0.0) -> list:
    """Return the full remaining DCA ladder for the UI.
    Each entry: {level, trigger_price, drop_pct, amount_usdt, cumulative_usdt}
    Level numbering starts at (margin_call_count + 1) — i.e. the NEXT safety order.
    Prices are computed by compounding the drop% from either the avg_price
    (if a position is open) or the current market price (if idle).
    """
    cfg = bot.get("margin_config") or DEFAULT_MARGIN_CONFIG
    if not cfg:
        return []
    first_buy = float(bot.get("first_buy_amount", 20.0) or 20.0)
    avg_price = float(bot.get("avg_price", 0) or 0)
    mc_count = int(bot.get("margin_call_count", 0) or 0)
    mc_limit = int(bot.get("margin_call_limit", 5) or 5)
    open_pos_double = bool(bot.get("open_position_double", True))

    # Anchor: if position open, ladder chains down from avg_price;
    # if idle, chain from current market price so user can preview.
    anchor = avg_price if avg_price > 0 else float(current_price or 0)
    if anchor <= 0 or mc_limit <= mc_count:
        return []

    ladder = []
    last_price = anchor
    cum = float(bot.get("position_amount", 0) or 0)
    if cum <= 0:
        # If no position yet, seed the running sum with the first buy amount
        # so cumulative includes the initial base order.
        cum = first_buy
    for i in range(mc_count, mc_limit):
        rule_idx = min(i, len(cfg) - 1)
        r = cfg[rule_idx]
        drop = float(r.get("drop", 2.0) or 2.0)
        mult = float(r.get("multiplier", 2.0) or 2.0)
        trigger = last_price * (1 - drop / 100.0)
        # Amount for this safety order
        if open_pos_double:
            amount = first_buy * (mult ** (i + 1))
        else:
            amount = first_buy
        cum += amount
        ladder.append({
            "level": i + 1,
            "trigger_price": round(trigger, 6),
            "drop_pct": round(drop, 2),
            "amount_usdt": round(amount, 2),
            "cumulative_usdt": round(cum, 2),
        })
        last_price = trigger
    return ladder


@api.get("/bots")
async def list_bots(user: dict = Depends(get_current_user)):
    rows = await db.bots.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    # Aggregate buy/sell counts + cumulative profit per symbol from transactions
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$group": {
            "_id": {"symbol": "$symbol", "side": "$side"},
            "count": {"$sum": 1},
            "profit_sum": {"$sum": {"$ifNull": ["$profit", 0]}},
        }},
    ]
    stats_by_sym: dict = {}
    async for a in db.transactions.aggregate(pipeline):
        sym = a["_id"]["symbol"]
        side = a["_id"]["side"]
        s = stats_by_sym.setdefault(sym, {"buy_count": 0, "sell_count": 0, "cumulative_profit": 0.0})
        if side == "BUY":
            s["buy_count"] = a["count"]
        elif side == "SELL":
            s["sell_count"] = a["count"]
            s["cumulative_profit"] = round(a["profit_sum"], 4)

    # First + last transaction date per symbol (for date range display)
    range_pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$group": {
            "_id": "$symbol",
            "first_at": {"$min": "$created_at"},
            "last_at": {"$max": "$created_at"},
        }},
    ]
    range_by_sym: dict = {}
    async for a in db.transactions.aggregate(range_pipeline):
        range_by_sym[a["_id"]] = {"first_at": a["first_at"], "last_at": a["last_at"]}

    for r in rows:
        s = stats_by_sym.get(r["symbol"], {"buy_count": 0, "sell_count": 0, "cumulative_profit": 0.0})
        r["buy_count"] = s["buy_count"]
        r["sell_count"] = s["sell_count"]
        r["cumulative_profit"] = s["cumulative_profit"]
        rng = range_by_sym.get(r["symbol"], {})
        r["first_trade_at"] = rng.get("first_at")
        r["last_trade_at"] = rng.get("last_at")
    return rows


@api.get("/bots/{symbol}")
async def get_bot(symbol: str, user: dict = Depends(get_current_user)):
    row = await db.bots.find_one({"user_id": user["id"], "symbol": symbol.upper()}, {"_id": 0})
    if not row:
        merged = {**DEFAULT_BOT_CFG, "symbol": symbol.upper(), "user_id": user["id"]}
    else:
        # Fill missing defaults for older docs
        merged = {**DEFAULT_BOT_CFG, **row}

    # Compute derived triggers so UI can show "Operation Reminder"
    avg_price = float(merged.get("avg_price", 0) or 0)
    position_qty = float(merged.get("position_qty", 0) or 0)
    tp_ratio = float(merged.get("whole_take_profit_ratio", 0) or 0)
    buy_cb = float(merged.get("buy_in_callback", 0) or 0)
    mc_count = int(merged.get("margin_call_count", 0) or 0)
    mc_limit = int(merged.get("margin_call_limit", 0) or 0)
    peak = float(merged.get("peak_price", 0) or 0)
    trough = float(merged.get("dca_bottom_price", 0) or 0)
    tp_callback = float(merged.get("whole_take_profit_callback", 0) or 0)

    tp_trigger = avg_price * (1 + tp_ratio / 100.0) if avg_price > 0 else 0.0
    next_buy = float(merged.get("next_buy_price", 0) or 0)
    if next_buy == 0 and avg_price > 0 and buy_cb > 0:
        next_buy = avg_price * (1 - buy_cb / 100.0)

    # === Trailing trigger states =====================================
    # tp_armed         → price crossed take-profit target, chasing peak to SELL
    # dca_armed        → price crossed DCA target, chasing trough to BUY (safety)
    # reentry_armed    → position closed, chasing peak DOWN before first BUY
    tp_armed = position_qty > 0 and peak > 0
    dca_armed = position_qty > 0 and trough > 0 and mc_count < mc_limit
    reentry_armed = position_qty == 0 and peak > 0

    # Locked-in profit % if a peak has been recorded
    locked_profit_pct = 0.0
    if tp_armed and avg_price > 0:
        pullback_price = peak * (1 - tp_callback / 100.0)
        locked_profit_pct = ((pullback_price - avg_price) / avg_price) * 100.0

    # Recovery trigger for trailing DCA — price must climb back this high
    # from the tracked trough before the safety-order fires.
    dca_recover_trigger = trough * (1 + buy_cb / 100.0) if trough > 0 else 0.0

    # Re-entry trigger — after a SELL the bot waits for a pullback of
    # buy_in_callback% from the running peak before the first-buy of the
    # next cycle fires.
    reentry_trigger = peak * (1 - buy_cb / 100.0) if reentry_armed else 0.0

    if position_qty == 0:
        if reentry_armed:
            trigger_state = "reentry_armed"
        else:
            trigger_state = "start_pending" if merged.get("status") == "running" else "idle"
    elif tp_armed:
        trigger_state = "tp_armed"
    elif dca_armed:
        trigger_state = "dca_armed"
    else:
        trigger_state = "waiting"

    merged["take_profit_trigger_price"] = round(tp_trigger, 6) if tp_trigger else 0
    merged["margin_call_trigger_price"] = round(next_buy, 6) if next_buy else 0
    merged["tp_pullback_trigger_price"] = round(peak * (1 - tp_callback / 100.0), 6) if peak > 0 and position_qty > 0 else 0
    merged["dca_recover_trigger_price"] = round(dca_recover_trigger, 6) if dca_recover_trigger else 0
    merged["reentry_trigger_price"] = round(reentry_trigger, 6) if reentry_trigger else 0
    merged["margin_call_remaining"] = max(0, mc_limit - mc_count)
    merged["trigger_state"] = trigger_state
    merged["tp_armed"] = tp_armed
    merged["dca_armed"] = dca_armed
    merged["reentry_armed"] = reentry_armed
    merged["locked_profit_pct"] = round(locked_profit_pct, 4)
    # Fetch current market price so we can build a preview ladder
    # even when the bot has no open position yet.
    live_px = 0.0
    try:
        live_px = float(await fetch_price(symbol.upper()))
    except Exception:
        live_px = 0.0
    merged["current_price"] = round(live_px, 6) if live_px else 0
    merged["dca_ladder"] = _compute_dca_ladder(merged, current_price=live_px)
    return merged


@api.post("/bots/{symbol}")
async def upsert_bot(symbol: str, cfg: BotConfigIn, user: dict = Depends(get_current_user)):
    symbol = symbol.upper()
    # Serialize margin_config (list of MarginRule pydantic objects) to plain dicts
    mc = cfg.margin_config
    mc_docs = [r.model_dump() for r in mc] if mc else DEFAULT_MARGIN_CONFIG
    doc = {
        "user_id": user["id"],
        "symbol": symbol,
        "first_buy_amount": cfg.first_buy_amount,
        "open_position_double": cfg.open_position_double,
        "margin_call_limit": cfg.margin_call_limit,
        "whole_take_profit_ratio": cfg.whole_take_profit_ratio,
        "whole_take_profit_callback": cfg.whole_take_profit_callback,
        "buy_in_callback": cfg.buy_in_callback,
        "trade_method": cfg.trade_method,
        "sub_take_profit_callback": cfg.sub_take_profit_callback,
        "margin_config": mc_docs,
        "updated_at": iso(now_utc()),
    }
    existing = await db.bots.find_one({"user_id": user["id"], "symbol": symbol})
    if not existing:
        doc.update({
            "id": str(uuid.uuid4()),
            "status": "stopped",
            "position_amount": 0.0,
            "position_qty": 0.0,
            "avg_price": 0.0,
            "margin_call_count": 0,
            "created_at": iso(now_utc()),
        })
    await db.bots.update_one({"user_id": user["id"], "symbol": symbol}, {"$set": doc}, upsert=True)
    row = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}, {"_id": 0})
    return row


@api.post("/bots/{symbol}/position")
async def override_position(symbol: str, body: PositionOverrideIn, user: dict = Depends(get_current_user)):
    """Manually override the bot's tracked position. Useful when the user has
    executed trades outside the bot on Binance and wants to sync."""
    symbol = symbol.upper()
    existing = await db.bots.find_one({"user_id": user["id"], "symbol": symbol})
    if not existing:
        # Create fresh bot doc with defaults + this position
        doc = {**DEFAULT_BOT_CFG, "id": str(uuid.uuid4()), "user_id": user["id"],
               "symbol": symbol, "created_at": iso(now_utc())}
        await db.bots.insert_one(doc)
        existing = doc

    new_qty = float(body.position_qty)
    new_avg = float(body.avg_price)
    new_amt = new_qty * new_avg
    mc_count = body.margin_call_count if body.margin_call_count is not None else existing.get("margin_call_count", 0)

    # Recompute next_buy_price using the appropriate margin rule
    next_rule = _get_margin_rule(existing, mc_count)
    next_buy_price = new_avg * (1 - next_rule["drop"] / 100.0) if new_avg > 0 else 0.0

    update_set = {
        "position_qty": new_qty,
        "avg_price": new_avg,
        "position_amount": new_amt,
        "margin_call_count": mc_count,
        "last_buy_price": new_avg,
        "next_buy_price": next_buy_price,
        "manually_adjusted_at": iso(now_utc()),
    }
    if body.reset_peak:
        update_set["peak_price"] = 0.0
        update_set["dca_bottom_price"] = 0.0

    await db.bots.update_one({"user_id": user["id"], "symbol": symbol}, {"$set": update_set})

    # Log the adjustment as a bot event so history is auditable
    await db.bot_events.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "symbol": symbol,
        "kind": "manual_adjust", "round": mc_count + 1,
        "amount": new_amt, "price": new_avg,
        "created_at": iso(now_utc()),
    })

    row = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}, {"_id": 0})
    return row


@api.post("/bots/{symbol}/start")
async def start_bot(symbol: str, user: dict = Depends(get_current_user)):
    symbol = symbol.upper()
    await db.bots.update_one(
        {"user_id": user["id"], "symbol": symbol},
        {"$set": {"status": "running", "started_at": iso(now_utc())}},
        upsert=True,
    )
    return {"status": "running", "symbol": symbol}


@api.post("/bots/{symbol}/stop")
async def stop_bot(symbol: str, user: dict = Depends(get_current_user)):
    symbol = symbol.upper()
    await db.bots.update_one(
        {"user_id": user["id"], "symbol": symbol},
        {"$set": {"status": "stopped", "stopped_at": iso(now_utc())}},
    )
    return {"status": "stopped", "symbol": symbol}


# ==== Trading (Real Binance orders when bound in real/testnet; Demo simulation otherwise) ====
async def fetch_price(symbol: str) -> float:
    async with httpx.AsyncClient(timeout=8) as c:
        r = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/price", params={"symbol": symbol})
        r.raise_for_status()
        return float(r.json()["price"])


async def get_user_binance(user_id: str):
    """Return (client, mode) if user has real/testnet keys, else (None, 'demo' or actual mode)."""
    row = await db.binance_keys.find_one({"user_id": user_id})
    if not row:
        return None, "demo"
    mode = row.get("mode", "demo")
    if mode == "demo":
        return None, "demo"
    try:
        api_key = decrypt_text(row["api_key_enc"])
        api_secret = decrypt_text(row["api_secret_enc"])
    except Exception as e:
        logger.error(f"decrypt keys failed: {e}")
        raise HTTPException(500, "Failed to load API credentials")
    testnet = (mode == "testnet")
    client = _SafeBinanceClient(api_key, api_secret, testnet=testnet)
    return client, mode


def _parse_fill(order: dict) -> tuple[float, float, float]:
    """Return (filled_qty, quote_spent, avg_price) from a Binance order response."""
    fills = order.get("fills") or []
    if fills:
        qty = sum(float(f["qty"]) for f in fills)
        quote = sum(float(f["qty"]) * float(f["price"]) for f in fills)
        avg = quote / qty if qty > 0 else 0.0
        return qty, quote, avg
    # Fallback to top-level fields
    exec_qty = float(order.get("executedQty", 0) or 0)
    cum_quote = float(order.get("cummulativeQuoteQty", 0) or 0)
    avg = cum_quote / exec_qty if exec_qty > 0 else 0.0
    return exec_qty, cum_quote, avg


@api.get("/binance/account")
async def binance_account(user: dict = Depends(get_current_user)):
    """Return live Binance account balances (real or testnet)."""
    client, mode = await get_user_binance(user["id"])
    if not client:
        raise HTTPException(400, "No live API keys bound. Bind API in real or testnet mode first.")
    try:
        data = await run_in_threadpool(client.get_account)
    except (BinanceAPIException, BinanceRequestException) as e:
        msg = getattr(e, "message", str(e)) or str(e)
        if "restricted location" in msg.lower():
            raise HTTPException(
                503,
                "Binance is not reachable from this server (geographic restriction). Deploy to a supported region, or switch to Demo mode.",
            )
        raise HTTPException(400, f"Binance error: {msg}")
    except Exception as e:
        raise HTTPException(400, f"Binance unreachable: {e}")
    # Filter non-zero balances
    balances = [
        {"asset": b["asset"], "free": float(b["free"]), "locked": float(b["locked"])}
        for b in data.get("balances", [])
        if float(b.get("free", 0)) > 0 or float(b.get("locked", 0)) > 0
    ]
    return {
        "mode": mode,
        "canTrade": data.get("canTrade"),
        "accountType": data.get("accountType"),
        "balances": balances,
    }


@api.post("/trade/order")
async def place_order(body: OrderIn, user: dict = Depends(get_current_user)):
    """
    Places a market order (called manually from UI).
    Delegates to _execute_trade which routes to live Binance or demo simulation
    based on the user's bound mode.
    """
    symbol = body.symbol.upper()
    if symbol not in ALLOWED_SYMBOLS:
        raise HTTPException(400, "Symbol not supported")
    try:
        txn = await _execute_trade(
            user_id=user["id"],
            symbol=symbol,
            side=body.side,
            usdt_amount=body.usdt_amount,
            quantity=body.quantity,
            source="manual",
        )
    except _TradeError as e:
        raise HTTPException(e.status, e.msg)
    return txn


async def _credit_referral_commission(user_id: str, profit: float, symbol: str):
    """When a user with a referrer books a profitable SELL, credit 10% of the profit
    to the referrer as a claimable 'referral' reward. Silently no-op on any error."""
    if profit <= 0:
        return
    try:
        u = await db.users.find_one({"id": user_id}, {"_id": 0, "referred_by": 1, "name": 1, "email": 1})
        ref_id = u and u.get("referred_by")
        if not ref_id:
            return
        commission = round(profit * 0.10, 4)
        if commission <= 0:
            return
        await db.rewards.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": ref_id,
            "type": "referral",
            "amount": commission,
            "status": "claimable",
            "note": f"10% from {u.get('name') or u.get('email','team')} · {symbol}",
            "from_user_id": user_id,
            "symbol": symbol,
            "created_at": iso(now_utc()),
        })
    except Exception as e:
        logger.warning(f"referral commission failed: {e}")


# ---------- Shared trade execution engine ----------
class _TradeError(Exception):
    def __init__(self, status_code: int, msg: str):
        self.status = status_code
        self.msg = msg
        super().__init__(msg)


async def _execute_trade(*, user_id, symbol, side, usdt_amount=None, quantity=None, source="manual"):
    """Shared trade executor used by both the /trade/order endpoint and the bot engine.
    Returns the transaction dict. Raises _TradeError on failure."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise _TradeError(404, "User not found")

    client, mode = await get_user_binance(user_id)
    wallet = user.get("wallet_usdt", 0.0)
    bot = await db.bots.find_one({"user_id": user_id, "symbol": symbol}) or {
        "position_amount": 0.0, "position_qty": 0.0, "avg_price": 0.0, "margin_call_count": 0,
    }

    # ----- LIVE (real / testnet) -----
    if client and mode in ("real", "testnet"):
        try:
            if side == "BUY":
                amount = usdt_amount or 0
                if amount <= 0:
                    raise _TradeError(400, "usdt_amount required for BUY")
                order = await run_in_threadpool(
                    client.order_market_buy, symbol=symbol, quoteOrderQty=round(amount, 2),
                )
            else:
                qty = quantity or bot.get("position_qty", 0.0)
                if qty <= 0:
                    raise _TradeError(400, "No position to sell")
                order = await run_in_threadpool(
                    client.order_market_sell, symbol=symbol, quantity=float(f"{qty:.6f}"),
                )
        except _TradeError:
            raise
        except (BinanceAPIException, BinanceRequestException) as e:
            msg = getattr(e, "message", str(e)) or str(e)
            if "restricted location" in msg.lower():
                raise _TradeError(503, "Binance not reachable (geographic restriction). Deploy to a supported region, or switch to Demo.")
            raise _TradeError(400, f"Binance rejected order: {msg}")
        except Exception as e:
            raise _TradeError(400, f"Order failed: {e}")

        filled_qty, quote_spent, avg_price = _parse_fill(order)
        if side == "BUY":
            new_qty = bot.get("position_qty", 0.0) + filled_qty
            new_amt = bot.get("position_amount", 0.0) + quote_spent
            new_avg = new_amt / new_qty if new_qty > 0 else 0.0
            new_wallet = max(0.0, wallet - quote_spent)
            new_mc_count = bot.get("margin_call_count", 0) + (1 if bot.get("position_amount", 0) > 0 else 0)
            # Compute next-DCA trigger using per-round margin_config drop%
            next_rule = _get_margin_rule(bot, new_mc_count)
            next_buy_price = avg_price * (1 - next_rule["drop"] / 100.0)
            await db.bots.update_one(
                {"user_id": user_id, "symbol": symbol},
                {"$set": {
                    "position_amount": new_amt,
                    "position_qty": new_qty,
                    "avg_price": new_avg,
                    "last_buy_price": avg_price,
                    "next_buy_price": next_buy_price,
                    "peak_price": 0.0,
                    "dca_bottom_price": 0.0,
                    "margin_call_count": new_mc_count,
                }},
                upsert=True,
            )
            await db.users.update_one({"id": user_id}, {"$set": {"wallet_usdt": new_wallet}})
            profit = 0.0
        else:
            cost = filled_qty * bot.get("avg_price", 0.0)
            profit = quote_spent - cost
            remaining_qty = max(0.0, bot.get("position_qty", 0.0) - filled_qty)
            remaining_amt = remaining_qty * bot.get("avg_price", 0.0)
            new_wallet = wallet + quote_spent
            reset = remaining_qty == 0
            update_set = {
                "position_qty": remaining_qty,
                "position_amount": remaining_amt,
                "avg_price": bot.get("avg_price", 0.0) if remaining_qty > 0 else 0.0,
            }
            if reset:
                update_set.update({
                    "margin_call_count": 0,
                    "last_buy_price": 0.0,
                    "next_buy_price": 0.0,
                    # Seed peak with the sell price so the first-buy of the
                    # NEXT cycle waits for a pullback instead of buying right
                    # at the top. Zero it out only for One-Shot mode.
                    "peak_price": avg_price if bot.get("trade_method") == "Cycle" else 0.0,
                    "dca_bottom_price": 0.0,
                    "last_sell_price": avg_price,
                    "cycles_completed": bot.get("cycles_completed", 0) + 1,
                })
                if bot.get("trade_method") != "Cycle":
                    update_set["status"] = "stopped"
            await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": update_set})
            await db.users.update_one({"id": user_id}, {"$set": {"wallet_usdt": new_wallet}})

        txn = {
            "id": str(uuid.uuid4()), "user_id": user_id, "symbol": symbol, "side": side,
            "price": avg_price, "quantity": filled_qty, "amount": quote_spent,
            "profit": profit, "mode": mode, "source": source,
            "binance_order_id": order.get("orderId"), "binance_status": order.get("status"),
            "created_at": iso(now_utc()),
        }
        await db.transactions.insert_one(txn)
        if side == "SELL":
            await _credit_referral_commission(user_id, profit, symbol)
        txn.pop("_id", None)
        return txn

    # ----- DEMO SIMULATION -----
    try:
        price = await fetch_price(symbol)
    except Exception as e:
        raise _TradeError(400, f"Price fetch failed: {e}")

    if side == "BUY":
        amount = usdt_amount or 0
        if amount <= 0:
            raise _TradeError(400, "usdt_amount required for BUY")
        if amount > wallet:
            raise _TradeError(400, "Insufficient USDT balance")
        qty = amount / price
        new_qty = bot.get("position_qty", 0.0) + qty
        new_amt = bot.get("position_amount", 0.0) + amount
        new_avg = new_amt / new_qty if new_qty else 0.0
        new_wallet = wallet - amount
        new_mc_count = bot.get("margin_call_count", 0) + (1 if bot.get("position_amount", 0) > 0 else 0)
        next_rule = _get_margin_rule(bot, new_mc_count)
        next_buy_price = price * (1 - next_rule["drop"] / 100.0)
        await db.bots.update_one(
            {"user_id": user_id, "symbol": symbol},
            {"$set": {
                "position_amount": new_amt,
                "position_qty": new_qty,
                "avg_price": new_avg,
                "last_buy_price": price,
                "next_buy_price": next_buy_price,
                "peak_price": 0.0,
                "dca_bottom_price": 0.0,
                "margin_call_count": new_mc_count,
            }},
            upsert=True,
        )
        await db.users.update_one({"id": user_id}, {"$set": {"wallet_usdt": new_wallet}})
        profit = 0.0
        resp_qty = qty
        resp_amount = amount
    else:
        qty = quantity or bot.get("position_qty", 0.0)
        if qty <= 0:
            raise _TradeError(400, "No position to sell")
        qty = min(qty, bot.get("position_qty", 0.0))
        proceeds = qty * price
        cost = qty * bot.get("avg_price", 0.0)
        profit = proceeds - cost
        remaining_qty = bot.get("position_qty", 0.0) - qty
        remaining_amt = remaining_qty * bot.get("avg_price", 0.0)
        new_wallet = wallet + proceeds
        reset = remaining_qty == 0
        update_set = {
            "position_qty": remaining_qty,
            "position_amount": remaining_amt,
            "avg_price": bot.get("avg_price", 0.0) if remaining_qty > 0 else 0.0,
        }
        if reset:
            update_set.update({
                "margin_call_count": 0,
                "last_buy_price": 0.0,
                "next_buy_price": 0.0,
                # Seed peak with the sell price so the first-buy of the NEXT
                # cycle waits for a pullback (skip for One-Shot).
                "peak_price": price if bot.get("trade_method") == "Cycle" else 0.0,
                "dca_bottom_price": 0.0,
                "last_sell_price": price,
                "cycles_completed": bot.get("cycles_completed", 0) + 1,
            })
            if bot.get("trade_method") != "Cycle":
                update_set["status"] = "stopped"
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": update_set})
        await db.users.update_one({"id": user_id}, {"$set": {"wallet_usdt": new_wallet}})
        resp_qty = qty
        resp_amount = qty * price

    txn = {
        "id": str(uuid.uuid4()), "user_id": user_id, "symbol": symbol, "side": side,
        "price": price, "quantity": resp_qty, "amount": resp_amount,
        "profit": profit, "mode": "demo", "source": source,
        "created_at": iso(now_utc()),
    }
    await db.transactions.insert_one(txn)
    if side == "SELL":
        await _credit_referral_commission(user_id, profit, symbol)
    txn.pop("_id", None)
    return txn


# ---------- Bot Engine (background trader) ----------
async def _bot_tick(bot: dict):
    """Evaluate a single running bot: place first buy, DCA (margin call),
    or take-profit sell based on the strategy. Records events in bot_events."""
    user_id = bot["user_id"]
    symbol = bot["symbol"]

    try:
        price = await fetch_price(symbol)
    except Exception as e:
        logger.warning(f"bot {symbol}: price fetch failed: {e}")
        return

    position_qty = float(bot.get("position_qty", 0.0) or 0)
    avg_price = float(bot.get("avg_price", 0.0) or 0)
    first_buy = float(bot.get("first_buy_amount", 20.0) or 20.0)
    mc_count = int(bot.get("margin_call_count", 0) or 0)
    mc_limit = int(bot.get("margin_call_limit", 10) or 10)
    tp_ratio = float(bot.get("whole_take_profit_ratio", 1.5) or 1.5)
    tp_callback = float(bot.get("whole_take_profit_callback", 0.3) or 0.3)
    dca_callback = float(bot.get("buy_in_callback", 0.3) or 0.3)
    next_buy = float(bot.get("next_buy_price", 0.0) or 0)
    peak = float(bot.get("peak_price", 0.0) or 0)
    trough = float(bot.get("dca_bottom_price", 0.0) or 0)

    # === FIRST BUY (with re-entry trailing) ===
    # After a SELL, `peak_price` is seeded with the sell price so the next
    # cycle's first buy waits for a pullback of `buy_in_callback`% from the
    # local high — never re-enters at a fresh top. Fresh bots (peak==0) buy
    # immediately at the current market price.
    if position_qty == 0:
        if peak > 0:
            # We are in "re-entry armed" mode. Update the running high, then
            # check if price has retraced enough to enter.
            new_peak = max(peak, price)
            if new_peak != peak:
                await db.bots.update_one(
                    {"user_id": user_id, "symbol": symbol},
                    {"$set": {"peak_price": new_peak}},
                )
                peak = new_peak
            entry_trigger = peak * (1 - dca_callback / 100.0)
            if price > entry_trigger:
                # Still trending up — keep chasing the peak, don't buy yet
                return
        try:
            await _execute_trade(
                user_id=user_id, symbol=symbol, side="BUY",
                usdt_amount=first_buy, source="bot",
            )
            # Reset the pre-entry peak now that we've entered
            await db.bots.update_one(
                {"user_id": user_id, "symbol": symbol},
                {"$set": {"peak_price": 0.0}},
            )
            await db.bot_events.insert_one({
                "id": str(uuid.uuid4()), "user_id": user_id, "symbol": symbol,
                "kind": "first_buy", "round": 1, "amount": first_buy, "price": price,
                "created_at": iso(now_utc()),
            })
            logger.info(f"bot {symbol}: first buy ${first_buy} at ~{price}")
        except _TradeError as e:
            logger.warning(f"bot {symbol}: first buy failed: {e.msg}")
            # Auto-stop on insufficient balance to prevent tight loop
            if e.status == 400 and "Insufficient" in e.msg:
                await db.bots.update_one(
                    {"user_id": user_id, "symbol": symbol},
                    {"$set": {"status": "stopped", "stop_reason": e.msg}},
                )
        return

    # === TAKE PROFIT ===
    tp_trigger = avg_price * (1 + tp_ratio / 100.0)
    if price >= tp_trigger:
        new_peak = max(peak, price)
        # Arm callback: once we've peaked, wait for pullback of tp_callback%
        if new_peak != peak:
            await db.bots.update_one(
                {"user_id": user_id, "symbol": symbol},
                {"$set": {"peak_price": new_peak}},
            )
            peak = new_peak
        pullback_trigger = peak * (1 - tp_callback / 100.0)
        if price <= pullback_trigger:
            try:
                round_num = mc_count + 1
                await _execute_trade(
                    user_id=user_id, symbol=symbol, side="SELL",
                    quantity=position_qty, source="bot",
                )
                await db.bot_events.insert_one({
                    "id": str(uuid.uuid4()), "user_id": user_id, "symbol": symbol,
                    "kind": "take_profit", "round": round_num, "price": price,
                    "peak": peak, "created_at": iso(now_utc()),
                })
                logger.info(f"bot {symbol}: TAKE PROFIT sold at {price} (peak {peak})")
            except _TradeError as e:
                logger.warning(f"bot {symbol}: TP sell failed: {e.msg}")
        return

    # === TRAILING DCA / MARGIN CALL BUY ================================
    # Instead of buying the instant `next_buy` is crossed, we wait for the
    # price to keep falling, track the running trough, and only fire the
    # safety order when the price bounces back up by `dca_callback`% from
    # that trough. This gives us a lower average entry on the next round.
    if next_buy > 0 and mc_count < mc_limit:
        # Have we crossed the DCA trigger yet?
        if trough > 0 or price <= next_buy:
            new_trough = min(trough, price) if trough > 0 else min(next_buy, price)
            # Persist a new lower trough as it happens
            if new_trough != trough:
                await db.bots.update_one(
                    {"user_id": user_id, "symbol": symbol},
                    {"$set": {"dca_bottom_price": new_trough}},
                )
                trough = new_trough

            # Fire the safety order once price recovers by dca_callback% from trough
            recover_trigger = trough * (1 + dca_callback / 100.0)
            if price >= recover_trigger and trough > 0:
                rule = _get_margin_rule(bot, mc_count)
                amount = first_buy * rule["multiplier"]
                try:
                    await _execute_trade(
                        user_id=user_id, symbol=symbol, side="BUY",
                        usdt_amount=amount, source="bot",
                    )
                    await db.bot_events.insert_one({
                        "id": str(uuid.uuid4()), "user_id": user_id, "symbol": symbol,
                        "kind": "margin_call", "round": mc_count + 2,
                        "amount": amount, "price": price,
                        "trough": trough,
                        "drop_pct": rule["drop"], "multiplier": rule["multiplier"],
                        "created_at": iso(now_utc()),
                    })
                    logger.info(
                        f"bot {symbol}: DCA round {mc_count + 2}, ${amount} (x{rule['multiplier']}) "
                        f"at {price} (trough {trough}, drop {rule['drop']}%)"
                    )
                    # Reset trough after safety-order fires so the next round starts fresh
                    await db.bots.update_one(
                        {"user_id": user_id, "symbol": symbol},
                        {"$set": {"dca_bottom_price": 0.0}},
                    )
                except _TradeError as e:
                    logger.warning(f"bot {symbol}: DCA buy failed: {e.msg}")
                    if e.status == 400 and "Insufficient" in e.msg:
                        await db.bots.update_one(
                            {"user_id": user_id, "symbol": symbol},
                            {"$set": {"stop_reason": "Insufficient balance for DCA — please deposit or Close position."}},
                        )


_engine_task = None


async def bot_engine_loop():
    logger.info("bot engine started")
    while True:
        try:
            running = await db.bots.find({"status": "running"}, {"_id": 0}).to_list(500)
            if running:
                await asyncio.gather(*[_bot_tick(b) for b in running], return_exceptions=True)
        except Exception as e:
            logger.error(f"engine loop error: {e}")
        await asyncio.sleep(10)


@api.get("/bots/{symbol}/events")
async def bot_events(symbol: str, user: dict = Depends(get_current_user), limit: int = 30):
    rows = await db.bot_events.find(
        {"user_id": user["id"], "symbol": symbol.upper()},
        {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    return rows


# ==== Transactions ====
@api.get("/transactions")
async def list_transactions(
    user: dict = Depends(get_current_user),
    limit: int = 50,
    symbol: Optional[str] = None,
    date: Optional[str] = None,
):
    q = {"user_id": user["id"]}
    if symbol:
        q["symbol"] = symbol.upper()
    if date:
        # Match all created_at ISO strings that start with the given YYYY-MM-DD
        q["created_at"] = {"$regex": f"^{date}"}
    rows = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return rows


# ==== Revenue ====
@api.get("/revenue/summary")
async def revenue_summary(user: dict = Depends(get_current_user)):
    rows = await db.transactions.find(
        {"user_id": user["id"], "side": "SELL"}, {"_id": 0, "profit": 1, "created_at": 1, "symbol": 1}
    ).to_list(1000)
    total = sum(r.get("profit", 0.0) for r in rows)

    # last 14 days by date + today's total
    today_str = now_utc().strftime("%Y-%m-%d")
    by_day = {}
    by_day_count = {}
    by_day_symbols = {}
    today_profit = 0.0
    today_trades = 0
    for r in rows:
        try:
            d = r["created_at"][:10]
        except Exception:
            continue
        by_day[d] = by_day.get(d, 0) + r.get("profit", 0.0)
        by_day_count[d] = by_day_count.get(d, 0) + 1
        by_day_symbols.setdefault(d, set()).add(r.get("symbol", ""))
        if d == today_str:
            today_profit += r.get("profit", 0.0)
            today_trades += 1
    days = sorted(by_day.keys())
    daily = [{"date": d, "profit": round(by_day[d], 4)} for d in days]

    # by_date list (most recent first) for the drill-down list
    by_date = [
        {
            "date": d,
            "profit": round(by_day[d], 4),
            "trades": by_day_count[d],
            "symbols": sorted(list(by_day_symbols[d])),
        }
        for d in sorted(by_day.keys(), reverse=True)
    ]

    # by symbol
    by_sym = {}
    by_sym_count = {}
    for r in rows:
        s = r.get("symbol", "N/A")
        by_sym[s] = by_sym.get(s, 0) + r.get("profit", 0.0)
        by_sym_count[s] = by_sym_count.get(s, 0) + 1
    by_symbol = [
        {"symbol": k, "profit": round(v, 4), "trades": by_sym_count[k]}
        for k, v in sorted(by_sym.items(), key=lambda kv: -kv[1])
    ]

    return {
        "total_profit": round(total, 4),
        "today_profit": round(today_profit, 4),
        "today_trades": today_trades,
        "total_trades": len(rows),
        "daily": daily,
        "by_date": by_date,
        "by_symbol": by_symbol,
    }


@api.get("/revenue/pair/{symbol}")
async def revenue_pair(symbol: str, user: dict = Depends(get_current_user)):
    """Cumulative profit + trade counts for a single symbol (used on TradingPair page)."""
    symbol = symbol.upper()
    rows = await db.transactions.find(
        {"user_id": user["id"], "symbol": symbol},
        {"_id": 0, "profit": 1, "created_at": 1, "side": 1},
    ).to_list(2000)
    sells = [r for r in rows if r.get("side") == "SELL"]
    buys = [r for r in rows if r.get("side") == "BUY"]
    total = sum(r.get("profit", 0.0) for r in sells)
    today_str = now_utc().strftime("%Y-%m-%d")
    today = sum(r.get("profit", 0.0) for r in sells if (r.get("created_at") or "")[:10] == today_str)
    return {
        "symbol": symbol,
        "cumulative_profit": round(total, 4),
        "today_profit": round(today, 4),
        "sell_count": len(sells),
        "buy_count": len(buys),
    }


# ==== Wallet ====
@api.post("/wallet/transaction")
async def wallet_txn(body: WalletTxnIn, user: dict = Depends(get_current_user)):
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    wallet = user.get("wallet_usdt", 0.0)
    if body.type == "deposit":
        new_wallet = wallet + body.amount
    elif body.type == "withdraw":
        if body.amount > wallet:
            raise HTTPException(400, "Insufficient balance")
        new_wallet = wallet - body.amount
    else:  # transfer (internal, no net change but logged)
        new_wallet = wallet
    await db.users.update_one({"id": user["id"]}, {"$set": {"wallet_usdt": new_wallet}})
    txn = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": body.type,
        "amount": body.amount,
        "asset": body.asset,
        "note": body.note or "",
        "balance_after": new_wallet,
        "created_at": iso(now_utc()),
    }
    await db.wallet_history.insert_one(txn)
    txn.pop("_id", None)
    return txn


@api.get("/wallet/history")
async def wallet_history(user: dict = Depends(get_current_user), limit: int = 50):
    rows = await db.wallet_history.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return rows


@api.get("/wallet/summary")
async def wallet_summary(user: dict = Depends(get_current_user)):
    # Compute positions value from bots
    bots = await db.bots.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    positions_value = 0.0
    positions = []
    for b in bots:
        if b.get("position_qty", 0) > 0:
            try:
                price = await fetch_price(b["symbol"])
            except Exception:
                price = b.get("avg_price", 0.0)
            val = b["position_qty"] * price
            positions_value += val
            positions.append({
                "symbol": b["symbol"],
                "qty": b["position_qty"],
                "avg_price": b.get("avg_price", 0.0),
                "current_price": price,
                "value": val,
                "pnl": val - b.get("position_amount", 0.0),
            })
    return {
        "wallet_usdt": user.get("wallet_usdt", 0.0),
        "positions_value_usdt": round(positions_value, 4),
        "total_usdt": round(user.get("wallet_usdt", 0.0) + positions_value, 4),
        "positions": positions,
    }


@api.get("/wallet/spot")
async def wallet_spot(user: dict = Depends(get_current_user)):
    """Returns the user's spot USDT balance. If Binance is bound (real or testnet)
    and reachable, returns the live Binance USDT free balance. Otherwise falls back
    to the demo wallet balance."""
    result = {
        "mode": "demo",
        "connected": False,
        "usdt_balance": round(float(user.get("wallet_usdt", 0.0)), 4),
    }
    client, mode = await get_user_binance(user["id"])
    if not client:
        return result
    try:
        data = await run_in_threadpool(client.get_account)
        usdt = 0.0
        for b in data.get("balances", []):
            if b.get("asset") == "USDT":
                usdt = float(b.get("free", 0))
                break
        result.update({"mode": mode, "connected": True, "usdt_balance": round(usdt, 4)})
    except Exception as e:
        logger.warning(f"wallet/spot binance fetch failed for {user['id']}: {e}")
        result.update({"mode": mode, "connected": False})
    return result


# ==== Referral ====
@api.get("/referral")
async def referral(user: dict = Depends(get_current_user)):
    team = await db.users.find({"referred_by": user["id"]}, {"_id": 0, "email": 1, "name": 1, "rank": 1, "created_at": 1}).to_list(500)
    earnings = await db.rewards.find({"user_id": user["id"], "type": "referral"}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total_earned = sum(e.get("amount", 0) for e in earnings if e.get("status") == "claimed")
    pending = sum(e.get("amount", 0) for e in earnings if e.get("status") == "claimable")
    return {
        "referral_code": user.get("referral_code"),
        "team_size": len(team),
        "team": team,
        "total_earned": round(total_earned, 4),
        "pending": round(pending, 4),
        "earnings": earnings,
    }


# ==== Rewards ====
@api.get("/rewards")
async def list_rewards(user: dict = Depends(get_current_user)):
    rows = await db.rewards.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows


@api.post("/rewards/{reward_id}/claim")
async def claim_reward(reward_id: str, user: dict = Depends(get_current_user)):
    row = await db.rewards.find_one({"id": reward_id, "user_id": user["id"]})
    if not row:
        raise HTTPException(404, "Reward not found")
    if row.get("status") != "claimable":
        raise HTTPException(400, "Reward not claimable")
    amount = row.get("amount", 0)
    await db.rewards.update_one({"id": reward_id}, {"$set": {"status": "claimed", "claimed_at": iso(now_utc())}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_usdt": amount}})
    return {"ok": True, "claimed_amount": amount}


# ==== News ====
_news_cache = {"at": 0.0, "items": []}

async def _fetch_live_news():
    """Fetch live crypto news from Cointelegraph RSS (free, no API key)."""
    import xml.etree.ElementTree as ET
    import re
    from email.utils import parsedate_to_datetime

    def _strip_html(s: str) -> str:
        s = re.sub(r"<[^>]+>", "", s or "")
        return re.sub(r"\s+", " ", s).strip()

    def _extract_img(content: str) -> Optional[str]:
        if not content:
            return None
        m = re.search(r'<img[^>]+src="([^"]+)"', content)
        return m.group(1) if m else None

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True,
                                     headers={"User-Agent": "Mozilla/5.0 TGXBot"}) as c:
            r = await c.get("https://cointelegraph.com/rss")
            r.raise_for_status()
        root = ET.fromstring(r.text)
        items = []
        for it in root.iter("item"):
            title = (it.findtext("title") or "").strip()
            link = (it.findtext("link") or "").strip()
            desc = it.findtext("description") or ""
            # media:content or content:encoded may hold images
            image = None
            for child in it:
                tag = child.tag.split("}")[-1]
                if tag in ("content", "encoded") and child.text:
                    image = image or _extract_img(child.text)
                if tag == "thumbnail" and child.attrib.get("url"):
                    image = image or child.attrib["url"]
                if tag == "content" and child.attrib.get("url") and (child.attrib.get("medium") == "image" or child.attrib.get("url").endswith((".jpg", ".png", ".webp"))):
                    image = image or child.attrib["url"]
            if not image:
                image = _extract_img(desc)
            summary = _strip_html(desc)[:220]
            if len(_strip_html(desc)) > 220:
                summary += "..."
            pub = it.findtext("pubDate") or ""
            try:
                dt = parsedate_to_datetime(pub).astimezone(timezone.utc)
                created = iso(dt)
            except Exception:
                created = iso(now_utc())
            # Categories: pick the first <category>
            cat = None
            for cat_el in it.findall("category"):
                if cat_el.text:
                    cat = cat_el.text.strip()
                    break
            items.append({
                "id": link or str(uuid.uuid4()),
                "title": title,
                "summary": summary,
                "category": cat or "Cointelegraph",
                "url": link or None,
                "image": image,
                "created_at": created,
            })
            if len(items) >= 30:
                break
        return items
    except Exception as e:
        logger.warning(f"news fetch failed: {e}")
        return []


@api.get("/news")
async def list_news():
    # Serve fresh cache within 5 minutes
    import time
    now_ts = time.time()
    if _news_cache["items"] and (now_ts - _news_cache["at"]) < 300:
        return _news_cache["items"]

    live = await _fetch_live_news()
    if live:
        _news_cache["at"] = now_ts
        _news_cache["items"] = live
        return live

    # Fallback: seeded news
    rows = await db.news.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return rows


# ==== Guide ====
@api.get("/guide")
async def list_guide():
    rows = await db.guide.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    return rows


# ==== Health ====
@api.get("/")
async def root():
    return {"app": "TGX BOT", "status": "ok"}


# ==== Startup Seeding ====
@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("referral_code")
    await db.bots.create_index([("user_id", 1), ("symbol", 1)], unique=True)
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@tgxbot.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "referral_code": "TGXADMIN",
            "referred_by": None,
            "rank": "Diamond",
            "activated": True,
            "wallet_usdt": 10000.0,
            "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed news
    if await db.news.count_documents({}) == 0:
        news_items = [
            {"id": str(uuid.uuid4()), "title": "TGX BOT Launches Automated Cycle Trading", "summary": "The new Cycle mode uses grid + DCA strategies to catch every dip.", "category": "Platform", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "title": "Bitcoin ETF Inflows Hit New Record", "summary": "Institutional demand pushes BTC to fresh highs this quarter.", "category": "Market", "created_at": iso(now_utc() - timedelta(hours=6))},
            {"id": str(uuid.uuid4()), "title": "Referral 2.0 Rewards Live", "summary": "Earn 10% commission on every trade your team executes.", "category": "Rewards", "created_at": iso(now_utc() - timedelta(days=1))},
            {"id": str(uuid.uuid4()), "title": "Solana Ecosystem Update", "summary": "New DEX integrations expand SOL/USDT liquidity across venues.", "category": "Market", "created_at": iso(now_utc() - timedelta(days=2))},
        ]
        await db.news.insert_many(news_items)

    # Seed guide
    if await db.guide.count_documents({}) == 0:
        guide_items = [
            {"id": str(uuid.uuid4()), "order": 1, "title": "1. Bind Your Binance API", "body": "Go to Binance API management and generate a key with Spot Trading permission. Paste the API Key and Secret in the Bind API screen. Choose Demo to try risk-free.", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "order": 2, "title": "2. Choose a Trading Pair", "body": "Select from BTC, ETH, SOL, BNB, and more. TGX BOT works best with USDT pairs.", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "order": 3, "title": "3. Configure Your Strategy", "body": "Set First Buy Amount, Margin Call Limit, and Take Profit ratio. Use Cycle for repeated grid trades, One-Shot for single-shot swing entries.", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "order": 4, "title": "4. Start the Bot", "body": "Press Start BOT to activate. Monitor position and P&L from your Dashboard.", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "order": 5, "title": "5. Invite Friends & Earn", "body": "Share your unique referral code and earn a % of every trade your team makes.", "created_at": iso(now_utc())},
        ]
        await db.guide.insert_many(guide_items)

    logger.info("TGX BOT startup complete")

    # Populate ALLOWED_SYMBOLS from Binance's live USDT pair list (fallback to the hardcoded set)
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{BINANCE_PUBLIC}/api/v3/exchangeInfo")
            r.raise_for_status()
            info = r.json()
            usdt_pairs = {
                s["symbol"] for s in info.get("symbols", [])
                if s.get("quoteAsset") == "USDT"
                and s.get("status") == "TRADING"
                and "SPOT" in s.get("permissions", [])
            }
            if usdt_pairs:
                ALLOWED_SYMBOLS.clear()
                ALLOWED_SYMBOLS.update(usdt_pairs)
                logger.info(f"Loaded {len(ALLOWED_SYMBOLS)} tradable USDT pairs from Binance")
    except Exception as e:
        logger.warning(f"Could not load Binance exchangeInfo at startup: {e}. Using fallback list.")

    # Launch the background bot engine
    global _engine_task
    if _engine_task is None or _engine_task.done():
        _engine_task = asyncio.create_task(bot_engine_loop())


# ==== CORS + Include ====
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    global _engine_task
    if _engine_task and not _engine_task.done():
        _engine_task.cancel()
    client.close()
