from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
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
ALLOWED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "MATICUSDT"]

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
    mode: Literal["real", "demo"] = "demo"


class BotConfigIn(BaseModel):
    symbol: str
    first_buy_amount: float = 20.0
    open_position_double: bool = True
    margin_call_limit: int = 10
    whole_take_profit_ratio: float = 1.5
    whole_take_profit_callback: float = 0.3
    buy_in_callback: float = 1.0
    trade_method: Literal["Cycle", "One-Shot"] = "Cycle"
    sub_take_profit_callback: float = 0.5


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
async def pairs_summary():
    """Fetch 24hr stats for all allowed symbols in parallel."""
    import asyncio
    async def one(c, sym):
        try:
            r = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/24hr", params={"symbol": sym})
            if r.status_code == 200:
                d = r.json()
                return {
                    "symbol": sym,
                    "last_price": float(d.get("lastPrice", 0)),
                    "change_pct": float(d.get("priceChangePercent", 0)),
                    "volume": float(d.get("quoteVolume", 0)),
                    "high": float(d.get("highPrice", 0)),
                    "low": float(d.get("lowPrice", 0)),
                }
        except Exception as e:
            logger.warning(f"pairs {sym}: {e}")
        return None
    async with httpx.AsyncClient(timeout=8) as c:
        results = await asyncio.gather(*[one(c, s) for s in ALLOWED_SYMBOLS])
        return {"pairs": [r for r in results if r]}


# ==== Bot Config ====
DEFAULT_BOT_CFG = {
    "first_buy_amount": 20.0,
    "open_position_double": True,
    "margin_call_limit": 10,
    "whole_take_profit_ratio": 1.5,
    "whole_take_profit_callback": 0.3,
    "buy_in_callback": 1.0,
    "trade_method": "Cycle",
    "sub_take_profit_callback": 0.5,
    "status": "stopped",
    "position_amount": 0.0,
    "position_qty": 0.0,
    "avg_price": 0.0,
    "margin_call_count": 0,
}


@api.get("/bots")
async def list_bots(user: dict = Depends(get_current_user)):
    rows = await db.bots.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    return rows


@api.get("/bots/{symbol}")
async def get_bot(symbol: str, user: dict = Depends(get_current_user)):
    row = await db.bots.find_one({"user_id": user["id"], "symbol": symbol.upper()}, {"_id": 0})
    if not row:
        return {**DEFAULT_BOT_CFG, "symbol": symbol.upper(), "user_id": user["id"]}
    # Fill missing defaults for older docs
    merged = {**DEFAULT_BOT_CFG, **row}
    return merged


@api.post("/bots/{symbol}")
async def upsert_bot(symbol: str, cfg: BotConfigIn, user: dict = Depends(get_current_user)):
    symbol = symbol.upper()
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


# ==== Trading (Demo simulation using real Binance price) ====
async def fetch_price(symbol: str) -> float:
    async with httpx.AsyncClient(timeout=8) as c:
        r = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/price", params={"symbol": symbol})
        r.raise_for_status()
        return float(r.json()["price"])


@api.post("/trade/order")
async def place_order(body: OrderIn, user: dict = Depends(get_current_user)):
    """
    Simulated market order using live Binance price.
    In demo mode: updates user's wallet_usdt and bot position.
    """
    symbol = body.symbol.upper()
    if symbol not in ALLOWED_SYMBOLS:
        raise HTTPException(400, "Symbol not supported")

    price = await fetch_price(symbol)
    wallet = user.get("wallet_usdt", 0.0)
    bot = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}) or {
        "position_amount": 0.0, "position_qty": 0.0, "avg_price": 0.0, "margin_call_count": 0,
    }

    if body.side == "BUY":
        amount = body.usdt_amount or 0
        if amount <= 0:
            raise HTTPException(400, "usdt_amount required for BUY")
        if amount > wallet:
            raise HTTPException(400, "Insufficient USDT balance")
        qty = amount / price
        new_qty = bot.get("position_qty", 0.0) + qty
        new_amt = bot.get("position_amount", 0.0) + amount
        new_avg = new_amt / new_qty if new_qty else 0.0
        new_wallet = wallet - amount

        await db.bots.update_one(
            {"user_id": user["id"], "symbol": symbol},
            {"$set": {
                "position_amount": new_amt,
                "position_qty": new_qty,
                "avg_price": new_avg,
                "margin_call_count": bot.get("margin_call_count", 0) + (1 if bot.get("position_amount", 0) > 0 else 0),
            }},
            upsert=True,
        )
        await db.users.update_one({"id": user["id"]}, {"$set": {"wallet_usdt": new_wallet}})
        profit = 0.0
    else:  # SELL
        qty = body.quantity or bot.get("position_qty", 0.0)
        if qty <= 0:
            raise HTTPException(400, "No position to sell")
        qty = min(qty, bot.get("position_qty", 0.0))
        proceeds = qty * price
        cost = qty * bot.get("avg_price", 0.0)
        profit = proceeds - cost
        remaining_qty = bot.get("position_qty", 0.0) - qty
        remaining_amt = remaining_qty * bot.get("avg_price", 0.0)
        new_wallet = wallet + proceeds
        await db.bots.update_one(
            {"user_id": user["id"], "symbol": symbol},
            {"$set": {
                "position_qty": remaining_qty,
                "position_amount": remaining_amt,
                "avg_price": bot.get("avg_price", 0.0) if remaining_qty > 0 else 0.0,
                "margin_call_count": 0 if remaining_qty == 0 else bot.get("margin_call_count", 0),
            }},
        )
        await db.users.update_one({"id": user["id"]}, {"$set": {"wallet_usdt": new_wallet}})

    txn = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "symbol": symbol,
        "side": body.side,
        "price": price,
        "quantity": (body.usdt_amount / price) if body.side == "BUY" else qty,
        "amount": body.usdt_amount if body.side == "BUY" else (qty * price),
        "profit": profit,
        "mode": "demo",
        "created_at": iso(now_utc()),
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)
    return txn


# ==== Transactions ====
@api.get("/transactions")
async def list_transactions(user: dict = Depends(get_current_user), limit: int = 50, symbol: Optional[str] = None):
    q = {"user_id": user["id"]}
    if symbol:
        q["symbol"] = symbol.upper()
    rows = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return rows


# ==== Revenue ====
@api.get("/revenue/summary")
async def revenue_summary(user: dict = Depends(get_current_user)):
    rows = await db.transactions.find(
        {"user_id": user["id"], "side": "SELL"}, {"_id": 0, "profit": 1, "created_at": 1, "symbol": 1}
    ).to_list(1000)
    total = sum(r.get("profit", 0.0) for r in rows)

    # last 7 days by date
    by_day = {}
    for r in rows:
        try:
            d = r["created_at"][:10]
        except Exception:
            continue
        by_day[d] = by_day.get(d, 0) + r.get("profit", 0.0)
    days = sorted(by_day.keys())[-14:]
    daily = [{"date": d, "profit": round(by_day[d], 4)} for d in days]

    # by symbol
    by_sym = {}
    for r in rows:
        s = r.get("symbol", "N/A")
        by_sym[s] = by_sym.get(s, 0) + r.get("profit", 0.0)
    by_symbol = [{"symbol": k, "profit": round(v, 4)} for k, v in by_sym.items()]

    return {
        "total_profit": round(total, 4),
        "total_trades": len(rows),
        "daily": daily,
        "by_symbol": by_symbol,
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


# ==== Referral ====
@api.get("/referral")
async def referral(user: dict = Depends(get_current_user)):
    team = await db.users.find({"referred_by": user["id"]}, {"_id": 0, "email": 1, "name": 1, "rank": 1, "created_at": 1}).to_list(500)
    earnings = await db.rewards.find({"user_id": user["id"], "type": "referral"}, {"_id": 0}).to_list(500)
    total_earned = sum(e.get("amount", 0) for e in earnings if e.get("status") == "claimed")
    return {
        "referral_code": user.get("referral_code"),
        "team_size": len(team),
        "team": team,
        "total_earned": round(total_earned, 4),
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
@api.get("/news")
async def list_news():
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
    client.close()
