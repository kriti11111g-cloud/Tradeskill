from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import math
import time
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
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from starlette.concurrency import run_in_threadpool
from binance.client import Client as BinanceClient
from binance.exceptions import BinanceAPIException, BinanceRequestException
import re
import random
import hashlib
import base64
import hmac
import json as _json
from decimal import Decimal
import chain_wallet


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

# ==== Rank System ====
# 10-STAR rank progression. Each rank unlocks higher earnings + benefits.
# Team requirements start from rank 2 onwards.
RANKS = [
    {
        "level": 1, "code": "LEVEL1", "title": "LEVEL 1",
        "color": "#39FF14", "glow": "#7FFF00",
        "direct_income": 8, "commission_pct": 3.5, "support_pct": 10,
        "direct_users": 0, "team_size": 0,
        "downline_requirement": None,
    },
    {
        "level": 2, "code": "LEVEL2", "title": "LEVEL 2",
        "color": "#00BFFF", "glow": "#1E90FF",
        "direct_income": 9, "commission_pct": 4.25, "support_pct": 10,
        "direct_users": 2, "team_size": 15,
        "downline_requirement": None,
        "team_note": "10+5 in 2 legs",
    },
    {
        "level": 3, "code": "LEVEL3", "title": "LEVEL 3",
        "color": "#9D3FE0", "glow": "#C77DFF",
        "direct_income": 12, "commission_pct": 5.0, "support_pct": 10,
        "direct_users": 4, "team_size": 80,
        "downline_requirement": {"count": 2, "min_level": 2, "label": "2× 1 Star"},
    },
    {
        "level": 4, "code": "LEVEL4", "title": "LEVEL 4",
        "color": "#FF8C00", "glow": "#FFA500",
        "direct_income": 15, "commission_pct": 5.75, "support_pct": 10,
        "direct_users": 6, "team_size": 250,
        "downline_requirement": {"count": 2, "min_level": 3, "label": "2× 2 Star"},
    },
    {
        "level": 5, "code": "LEVEL5", "title": "LEVEL 5",
        "color": "#DC143C", "glow": "#FF4444",
        "direct_income": 18, "commission_pct": 6.5, "support_pct": 10,
        "direct_users": 8, "team_size": 500,
        "downline_requirement": {"count": 2, "min_level": 4, "label": "2× 3 Star"},
    },
    {
        "level": 6, "code": "LEVEL6", "title": "LEVEL 6",
        "color": "#FFD700", "glow": "#FFC500",
        "direct_income": 20, "commission_pct": 7.5, "support_pct": 10,
        "direct_users": 10, "team_size": 1000,
        "downline_requirement": {"count": 2, "min_level": 5, "label": "2× 4 Star"},
    },
    {
        "level": 7, "code": "LEVEL7", "title": "LEVEL 7",
        "color": "#00FFFF", "glow": "#40E0D0",
        "direct_income": 22, "commission_pct": 8.5, "support_pct": 10,
        "direct_users": 12, "team_size": 2000,
        "downline_requirement": {"count": 2, "min_level": 6, "label": "2× 5 Star"},
    },
    {
        "level": 8, "code": "LEVEL8", "title": "LEVEL 8",
        "color": "#1E40FF", "glow": "#4169E1",
        "direct_income": 23, "commission_pct": 9.5, "support_pct": 10,
        "direct_users": 14, "team_size": 3500,
        "downline_requirement": {"count": 2, "min_level": 7, "label": "2× 6 Star"},
    },
    {
        "level": 9, "code": "LEVEL9", "title": "LEVEL 9",
        "color": "#FF1493", "glow": "#FF69B4",
        "direct_income": 24, "commission_pct": 10.75, "support_pct": 10,
        "direct_users": 16, "team_size": 5500,
        "downline_requirement": {"count": 2, "min_level": 8, "label": "2× 7 Star"},
    },
    {
        "level": 10, "code": "LEVEL10", "title": "LEVEL 10",
        "color": "#FFD700", "glow": "#FFF8DC",
        "direct_income": 26.36, "commission_pct": 12.0, "support_pct": 10,
        "direct_users": 20, "team_size": 10000,
        "downline_requirement": {"count": 2, "min_level": 9, "label": "2× 8 Star"},
        "crown": True,
    },
]


async def _compute_team_stats(user_id: str) -> dict:
    """Rank-qualification stats — ACTIVATED members ONLY (inactive members do NOT
    count towards rank or the progress bar). The tree is still fully traversed
    (unlimited levels) so active members below an inactive upline are reached.
    """
    direct = await db.users.count_documents({"referred_by": user_id, "activated": True})
    seen = {user_id}
    frontier = [user_id]
    downline_ranks: dict[int, int] = {}
    active_total = 0
    while frontier and len(seen) <= 100000:
        cursor = db.users.find(
            {"referred_by": {"$in": frontier}}, {"id": 1, "rank": 1, "activated": 1, "_id": 0},
        )
        next_frontier = []
        async for u in cursor:
            if u["id"] in seen:
                continue
            seen.add(u["id"])
            next_frontier.append(u["id"])  # traverse everyone to reach deeper active members
            if not u.get("activated"):
                continue  # inactive members are NOT counted for rank
            active_total += 1
            r_title = u.get("rank", "Level 1").upper()
            for rk in RANKS:
                if rk["title"] == r_title:
                    downline_ranks[rk["level"]] = downline_ranks.get(rk["level"], 0) + 1
                    break
        frontier = next_frontier
    return {
        "direct_count": direct,
        "total_team": active_total,
        "downline_ranks": downline_ranks,
    }


def _rank_qualifies(stats: dict, rank: dict) -> bool:
    if stats["direct_count"] < rank["direct_users"]:
        return False
    if stats["total_team"] < rank["team_size"]:
        return False
    dr = rank.get("downline_requirement")
    if dr:
        need_count = dr["count"]
        min_level = dr["min_level"]
        matches = sum(
            v for lvl, v in stats["downline_ranks"].items() if lvl >= min_level
        )
        if matches < need_count:
            return False
    return True





# One-time activation fee (USDT) charged from user's demo/main wallet the first
# time they enable trading. After activation, a % of every SELL's profit is
# auto-deducted from the pre-funded Bot Wallet. If balance runs out, bots pause.
BOT_ACTIVATION_FEE = float(os.environ.get("BOT_ACTIVATION_FEE", "50"))
BOT_TRADING_FEE_PCT = float(os.environ.get("BOT_TRADING_FEE_PCT", "25"))  # % of profit → fuel
BOT_MIN_FUEL_BALANCE = float(os.environ.get("BOT_MIN_FUEL_BALANCE", "5"))  # min fuel to START a bot
BOT_FUEL_WARN_BALANCE = float(os.environ.get("BOT_FUEL_WARN_BALANCE", "10"))  # warn popup below this
MIN_FIRST_BUY = 10.0  # minimum first buy in USDT (below this Binance sells can fail on MIN_NOTIONAL)

# ---- MLM Trading Commission Structure (of PROFIT, totals BOT_TRADING_FEE_PCT=25%) ----
COMPANY_FEE_PCT = 5.0        # Company / Bot fee (% of profit)
TRADING_MEETING_PCT = 1.0    # Physical meetings / operations (% of profit)
# Trading royalty pool — level-wise weights (% of profit), Levels 2..10, total 7%
TRADING_ROYALTY_BY_LEVEL = {2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5, 6: 0.75, 7: 0.75, 8: 1.0, 9: 1.0, 10: 1.5}
RANK_BUDGET_PCT = 12.0       # Differential rank commissions budget (12% fully paid at Level 10)
# ---- Bot activation ($50) distribution ----
ACTIVATION_ROYALTY_PER_LEVEL = 2.0   # $2 per level into royalty pool
ACTIVATION_ROYALTY_LEVELS = list(range(2, 11))  # Levels 2..10 only → $18 total (Level 1 gets no royalty)
ACTIVATION_COMPANY_PCT = 5.0         # 5% of activation → company ($2.50)
ACTIVATION_MEETING_PCT = 1.0         # 1% of activation → physical meeting fund ($0.50)
SUPPORT_INCOME_PCT = 10.0    # % of direct bonus to sponsor's immediate upline

RANK_PCT_BY_TITLE = {r["title"].upper(): float(r["commission_pct"]) for r in RANKS}
RANK_BONUS_BY_TITLE = {r["title"].upper(): float(r["direct_income"]) for r in RANKS}
MAX_RANK_PCT = max(RANK_PCT_BY_TITLE.values())
# Direct income per rank level + the fixed activation direct-income pot (= Level 10 max).
DIRECT_INCOME_BY_LEVEL = {int(r["level"]): float(r["direct_income"]) for r in RANKS}
DIRECT_INCOME_POT = DIRECT_INCOME_BY_LEVEL[max(DIRECT_INCOME_BY_LEVEL)]  # $26.36

# ---- Bonanza (Durga Puja Special Offer) ----
# Tier-based festive reward on ACTIVATED direct referrals. Mutually exclusive:
# only the HIGHEST achieved tier is paid. Claim unlocks once the countdown ends.
BONANZA_OFFER = {
    "id": "durga_puja_2026",
    "title": "Durga Puja Special Offer",
    "subtitle": "Add direct IDs & win festive cash rewards",
    # 20 Oct 2026, 12:00 AM IST  ==  2026-10-19 18:30 UTC
    "deadline": "2026-10-19T18:30:00+00:00",
    "tiers": [
        {"directs": 5, "reward": 10.0},
        {"directs": 10, "reward": 25.0},
    ],
}

BOT_WALLET_DEPOSIT_ADDRESS = os.environ.get("BOT_WALLET_DEPOSIT_ADDRESS",
                                            "TGXBOTUSDT-TRC20-DEMO-ADDRESS")
WITHDRAW_FEE_USDT = float(os.environ.get("WITHDRAW_FEE_USDT", "2"))
WITHDRAW_MIN_USDT = float(os.environ.get("WITHDRAW_MIN_USDT", "10"))
# Sub-position mode: Call 5 se aage har margin call alag sub-position banti hai
SUB_POSITION_START = int(os.environ.get("SUB_POSITION_START", "5"))

DEPOSIT_WATCH_INTERVAL = int(os.environ.get("DEPOSIT_WATCH_INTERVAL", "15"))  # backup poller
EVENT_SCAN_INTERVAL = int(os.environ.get("EVENT_SCAN_INTERVAL", "2"))  # primary event scanner
MAX_SCAN_CATCHUP = int(os.environ.get("MAX_SCAN_CATCHUP", "500"))  # restart/lag catch-up cap (blocks)
ADDR_INDEX_REFRESH = int(os.environ.get("ADDR_INDEX_REFRESH", "30"))  # deposit-address cache refresh (s)
DEEP_RESCAN_INTERVAL = int(os.environ.get("DEEP_RESCAN_INTERVAL", "60"))  # backup deep re-scan (s)
DEEP_RESCAN_BLOCKS = int(os.environ.get("DEEP_RESCAN_BLOCKS", "200"))  # backup lookback window (blocks)
AUTO_WITHDRAW_ENABLED = os.environ.get("AUTO_WITHDRAW", "true").lower() == "true"
EVENT_SCAN_INTERVAL = int(os.environ.get("EVENT_SCAN_INTERVAL", "2"))  # primary event scanner
# Auto-sweep: deposit address ka USDT automatic cold wallet me move hota hai
SWEEP_ENABLED = os.environ.get("SWEEP_ENABLED", "1") == "1"
SWEEP_MIN_USDT = float(os.environ.get("SWEEP_MIN_USDT", "1"))
ADMIN_WALLET_ADDRESS = os.environ.get("ADMIN_WALLET_ADDRESS", "")
EMAIL_OTP_MODE = os.environ.get("EMAIL_OTP_MODE", "demo")
OTP_TTL_SECONDS = 300
OTP_RESEND_COOLDOWN = 60

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

app = FastAPI(title="Trade Skill API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tgx")


# ==== Utilities ====
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# Daily income/revenue boundaries use India Standard Time (UTC+5:30) so "today"
# resets at 00:00 IST for the user base. Stored created_at are UTC ISO strings.
IST_OFFSET = timedelta(hours=5, minutes=30)


def ist_today() -> str:
    """Current calendar date in IST as 'YYYY-MM-DD'."""
    return (now_utc() + IST_OFFSET).strftime("%Y-%m-%d")


def ist_date(created_at) -> str:
    """IST 'YYYY-MM-DD' for a stored UTC ISO created_at string (or datetime)."""
    if not created_at:
        return ""
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00")) if isinstance(created_at, str) else created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (dt.astimezone(timezone.utc) + IST_OFFSET).strftime("%Y-%m-%d")
    except Exception:
        return created_at[:10] if isinstance(created_at, str) else ""


def ist_day_start_utc_iso() -> str:
    """UTC ISO timestamp of the current IST day's 00:00 (for Mongo $gte on created_at)."""
    d = (now_utc() + IST_OFFSET).date()
    utc_dt = datetime(d.year, d.month, d.day) - IST_OFFSET
    return utc_dt.replace(tzinfo=timezone.utc).isoformat()


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
    return "TS" + pysecrets.token_hex(3).upper()


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
    if user.get("blocked"):
        raise HTTPException(403, "Your account has been blocked. Contact support.")
    return user


# ==== Models ====
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None
    referral_code: Optional[str] = None
    country_code: Optional[str] = "+91"
    mobile: Optional[str] = None
    transaction_password: Optional[str] = Field(default=None, min_length=4)
    leg: Optional[Literal["left", "right"]] = None


class SignupOtpSendIn(BaseModel):
    email: EmailStr


class SignupOtpVerifyIn(BaseModel):
    email: EmailStr
    code: str


class LoginIn(BaseModel):
    email: str  # email ya UID (username)
    password: str


class BindAPIIn(BaseModel):
    api_key: str
    api_secret: str
    mode: Literal["real", "demo", "testnet"] = "demo"


class MarginRule(BaseModel):
    drop: float = 2.0        # % below last buy price
    multiplier: float = 2.0  # multiplier of first_buy_amount for this round


class BotConfigIn(BaseModel):
    symbol: Optional[str] = None  # path param se aata hai
    first_buy_amount: float = 10.0
    open_position_double: bool = False
    margin_call_limit: int = 5
    whole_take_profit_ratio: float = 1.25
    whole_take_profit_callback: float = 0.25
    buy_in_callback: float = 0.25
    trade_method: Literal["Cycle", "One-Shot"] = "One-Shot"
    sub_take_profit_callback: float = 0.25
    margin_config: Optional[List[MarginRule]] = None
    sub_position_tps: Optional[List[float]] = None


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
async def _next_uid() -> str:
    from pymongo import ReturnDocument
    c = await db.counters.find_one_and_update(
        {"_id": "uid"}, {"$inc": {"seq": 1}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    return f"TSK{100000 + int(c['seq']) - 1}"


@api.post("/auth/signup-otp/send")
async def signup_otp_send(body: SignupOtpSendIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    now = now_utc()
    existing = await db.signup_otps.find_one({"email": email}, {"_id": 0})
    if existing and existing.get("created_at"):
        elapsed = (now - datetime.fromisoformat(existing["created_at"])).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN:
            raise HTTPException(429, f"Please wait {int(OTP_RESEND_COOLDOWN - elapsed)}s before requesting another OTP")
    code = f"{random.randint(0, 999999):06d}"
    await db.signup_otps.replace_one(
        {"email": email},
        {"email": email,
         "code_hash": hashlib.sha256(code.encode()).hexdigest(),
         "created_at": iso(now),
         "expires_at": iso(now + timedelta(seconds=OTP_TTL_SECONDS)),
         "attempts": 0, "verified": False},
        upsert=True)
    try:
        await asyncio.to_thread(_send_otp_email, email, code, "signup")
    except Exception as e:
        logger.error(f"signup OTP email failed: {e}")
        raise HTTPException(500, "Could not send OTP email. Try again later.")
    resp = {"ok": True, "email_masked": _mask_email(email),
            "expires_in": OTP_TTL_SECONDS, "resend_in": OTP_RESEND_COOLDOWN,
            "mode": EMAIL_OTP_MODE}
    if EMAIL_OTP_MODE == "demo":
        resp["demo_otp"] = code
    return resp


@api.post("/auth/signup-otp/verify")
async def signup_otp_verify(body: SignupOtpVerifyIn):
    email = body.email.lower()
    doc = await db.signup_otps.find_one({"email": email}, {"_id": 0})
    if not doc:
        raise HTTPException(400, "Request an OTP first")
    if datetime.fromisoformat(doc["expires_at"]) < now_utc():
        raise HTTPException(400, "OTP expired — request a new one")
    if doc.get("attempts", 0) >= 5:
        raise HTTPException(429, "Too many wrong attempts — request a new OTP")
    if hashlib.sha256(body.code.strip().encode()).hexdigest() != doc["code_hash"]:
        await db.signup_otps.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect OTP")
    await db.signup_otps.update_one({"email": email}, {"$set": {"verified": True}})
    return {"verified": True}


@api.get("/auth/sponsor")
async def resolve_sponsor(code: str):
    """Public: resolve a referral/UID code to the sponsor's display name (for signup)."""
    code = (code or "").strip().upper()
    if not code:
        return {"found": False}
    ref = await db.users.find_one(
        {"$or": [{"referral_code": code}, {"uid": code}]},
        {"_id": 0, "name": 1, "uid": 1})
    if not ref:
        return {"found": False}
    return {"found": True, "name": ref.get("name") or ref.get("uid"), "uid": ref.get("uid")}


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered")
    otp = await db.signup_otps.find_one({"email": email}, {"_id": 0, "verified": 1})
    if not otp or not otp.get("verified"):
        raise HTTPException(400, "Please verify your email with OTP first")

    if body.transaction_password and body.transaction_password == body.password:
        raise HTTPException(400, "Login password and transaction password cannot be the same. Please use different passwords.")

    user_id = str(uuid.uuid4())
    uid = await _next_uid()
    ref_code = uid  # referral code = UID (TSK100000 style)

    referred_by = None
    if body.referral_code:
        code = body.referral_code.strip().upper()
        ref = await db.users.find_one({"$or": [{"referral_code": code}, {"uid": code}]})
        if ref:
            referred_by = ref["id"]

    # Leg auto-assigned (UI no longer asks). Alternate legs for each sponsor's directs.
    if body.leg in ("left", "right"):
        assigned_leg = body.leg
    elif referred_by:
        existing_directs = await db.users.count_documents({"referred_by": referred_by})
        assigned_leg = "left" if existing_directs % 2 == 0 else "right"
    else:
        assigned_leg = "left"

    doc = {
        "id": user_id,
        "uid": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name or email.split("@")[0],
        "role": "user",
        "referral_code": ref_code,
        "referred_by": referred_by,
        "rank": "Level 1",
        "country_code": body.country_code or "+91",
        "mobile": (body.mobile or "").strip() or None,
        "txn_password_hash": hash_password(body.transaction_password) if body.transaction_password else None,
        "leg": assigned_leg,
        "activated": False,
        "wallet_usdt": 1000.0,  # demo starter balance
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    await db.signup_otps.delete_one({"email": email})

    # Seed some rewards
    await db.rewards.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "joining",
        "amount": 5.0,
        "status": "claimable",
        "note": "Welcome bonus for joining Trade Skill",
        "created_at": iso(now_utc()),
    })

    token = create_access_token(user_id, email)
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=604800, path="/")
    return {
        "token": token,
        "user": {k: v for k, v in doc.items() if k not in ("password_hash", "_id")},
    }


class ForgotSendIn(BaseModel):
    email: EmailStr


class ForgotResetIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str


@api.post("/auth/forgot/send")
async def forgot_otp_send(body: ForgotSendIn):
    email = body.email.strip().lower()
    if not await db.users.find_one({"email": email}, {"id": 1}):
        raise HTTPException(404, "No account found with this email")
    now = now_utc()
    existing = await db.reset_otps.find_one({"email": email}, {"_id": 0})
    if existing and existing.get("created_at"):
        elapsed = (now - datetime.fromisoformat(existing["created_at"])).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN:
            raise HTTPException(429, f"Please wait {int(OTP_RESEND_COOLDOWN - elapsed)}s before requesting another OTP")
    code = f"{random.randint(0, 999999):06d}"
    await db.reset_otps.replace_one(
        {"email": email},
        {"email": email,
         "code_hash": hashlib.sha256(code.encode()).hexdigest(),
         "created_at": iso(now),
         "expires_at": iso(now + timedelta(seconds=OTP_TTL_SECONDS)),
         "attempts": 0, "used": False},
        upsert=True)
    try:
        await asyncio.to_thread(_send_otp_email, email, code, "reset")
    except Exception as e:
        logger.error(f"reset OTP email failed: {e}")
        raise HTTPException(500, "Could not send OTP email. Try again later.")
    resp = {"ok": True, "email_masked": _mask_email(email),
            "expires_in": OTP_TTL_SECONDS, "resend_in": OTP_RESEND_COOLDOWN,
            "mode": EMAIL_OTP_MODE}
    if EMAIL_OTP_MODE == "demo":
        resp["demo_otp"] = code
    return resp


@api.post("/auth/forgot/reset")
async def forgot_password_reset(body: ForgotResetIn):
    email = body.email.strip().lower()
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    doc = await db.reset_otps.find_one({"email": email}, {"_id": 0})
    if not doc:
        raise HTTPException(400, "Request an OTP first")
    if doc.get("used"):
        raise HTTPException(400, "OTP already used — request a new one")
    if datetime.fromisoformat(doc["expires_at"]) < now_utc():
        raise HTTPException(400, "OTP expired — request a new one")
    if doc.get("attempts", 0) >= 5:
        raise HTTPException(429, "Too many wrong attempts — request a new OTP")
    if hashlib.sha256(body.code.strip().encode()).hexdigest() != doc["code_hash"]:
        await db.reset_otps.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect OTP")
    await db.users.update_one(
        {"email": email}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.reset_otps.update_one({"email": email}, {"$set": {"used": True}})
    return {"ok": True, "message": "Password reset successful"}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    ident = body.email.strip()
    user = await db.users.find_one(
        {"$or": [{"email": ident.lower()}, {"uid": ident.upper()}]})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(user["id"], user["email"])
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
    # One exchange per account — block if another exchange is already connected.
    if await db.kucoin_keys.find_one({"user_id": user["id"]}):
        raise HTTPException(400, "KuCoin is already connected to this account. Disconnect KuCoin first to add Binance.")
    if await db.lbank_keys.find_one({"user_id": user["id"]}):
        raise HTTPException(400, "LBank is already connected to this account. Disconnect LBank first to add Binance.")
    doc = {
        "user_id": user["id"],
        "api_key_enc": encrypt_text(body.api_key),
        "api_secret_enc": encrypt_text(body.api_secret),
        "api_key_mask": mask(body.api_key),
        "mode": body.mode,
        "updated_at": iso(now_utc()),
    }
    await db.binance_keys.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    return {"ok": True, "mask": doc["api_key_mask"], "mode": body.mode}


_SERVER_IP_CACHE = {"ip": None, "ts": 0.0}


async def get_server_ip():
    """Detect the server's real public outbound IP (the IP an exchange sees).
    Env BIND_WHITELIST_IP pins it; otherwise auto-detected & cached 1h."""
    env_ip = os.environ.get("BIND_WHITELIST_IP")
    if env_ip:
        return env_ip
    if _SERVER_IP_CACHE["ip"] and (time.time() - _SERVER_IP_CACHE["ts"] < 3600):
        return _SERVER_IP_CACHE["ip"]
    for url in ("https://api4.ipify.org", "https://ipv4.icanhazip.com", "https://api.ipify.org"):
        try:
            transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")  # force IPv4
            async with httpx.AsyncClient(timeout=6.0, transport=transport) as h:
                r = await h.get(url)
                ip = (r.text or "").strip()
                if ip and len(ip) <= 45 and "." in ip and ":" not in ip:
                    _SERVER_IP_CACHE["ip"] = ip
                    _SERVER_IP_CACHE["ts"] = time.time()
                    return ip
        except Exception:
            continue
    return _SERVER_IP_CACHE["ip"] or "your server's public IP"


@api.get("/exchange/server-ip")
async def exchange_server_ip():
    return {"ip": await get_server_ip()}



@api.get("/binance/bind")
async def get_bind(user: dict = Depends(get_current_user)):
    row = await db.binance_keys.find_one({"user_id": user["id"]}, {"_id": 0, "api_key_enc": 0, "api_secret_enc": 0})
    if not row:
        return {"mode": None, "api_key_mask": None, "bound": False, "whitelist_ip": await get_server_ip()}
    row["bound"] = row.get("mode") in ("real", "testnet")
    row["whitelist_ip"] = await get_server_ip()
    return row


@api.delete("/binance/bind")
async def unbind(user: dict = Depends(get_current_user)):
    await db.binance_keys.delete_one({"user_id": user["id"]})
    return {"ok": True}


# ==== KuCoin API Keys ====
class KuCoinBindIn(BaseModel):
    api_key: str
    api_secret: str
    passphrase: str
    mode: Literal["real", "demo"] = "demo"
    key_version: str = "3"


@api.post("/kucoin/bind")
async def kucoin_bind(body: KuCoinBindIn, user: dict = Depends(get_current_user)):
    # One exchange per account — block if another exchange is already connected.
    if await db.binance_keys.find_one({"user_id": user["id"]}):
        raise HTTPException(400, "Binance is already connected to this account. Disconnect Binance first to add KuCoin.")
    if await db.lbank_keys.find_one({"user_id": user["id"]}):
        raise HTTPException(400, "LBank is already connected to this account. Disconnect LBank first to add KuCoin.")
    # For live mode, verify the keys actually work before saving.
    if body.mode == "real":
        client = KuCoinClient(body.api_key, body.api_secret, body.passphrase, body.key_version)
        try:
            await client.accounts(account_type="trade")
        except KuCoinError as e:
            if e.code == "400006":
                raise HTTPException(400, f"KuCoin: server IP not whitelisted. Add {await get_server_ip()} to your API key's IP list.")
            raise HTTPException(400, f"KuCoin rejected keys ({e.code}): {e.message}")
        except Exception as e:
            raise HTTPException(400, f"KuCoin unreachable: {e}")
    doc = {
        "user_id": user["id"],
        "api_key_enc": encrypt_text(body.api_key),
        "api_secret_enc": encrypt_text(body.api_secret),
        "passphrase_enc": encrypt_text(body.passphrase),
        "api_key_mask": mask(body.api_key),
        "mode": body.mode,
        "key_version": body.key_version or "3",
        "updated_at": iso(now_utc()),
    }
    await db.kucoin_keys.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    await db.users.update_one({"id": user["id"]}, {"$set": {"active_exchange": "kucoin"}})
    return {"ok": True, "mask": doc["api_key_mask"], "mode": body.mode}


@api.get("/kucoin/bind")
async def kucoin_get_bind(user: dict = Depends(get_current_user)):
    row = await db.kucoin_keys.find_one(
        {"user_id": user["id"]},
        {"_id": 0, "api_key_enc": 0, "api_secret_enc": 0, "passphrase_enc": 0})
    if not row:
        return {"mode": None, "api_key_mask": None, "bound": False, "whitelist_ip": await get_server_ip()}
    row["bound"] = row.get("mode") == "real"
    row["whitelist_ip"] = await get_server_ip()
    return row


@api.delete("/kucoin/bind")
async def kucoin_unbind(user: dict = Depends(get_current_user)):
    await db.kucoin_keys.delete_one({"user_id": user["id"]})
    await db.users.update_one({"id": user["id"]}, {"$set": {"active_exchange": "binance"}})
    return {"ok": True}


@api.get("/kucoin/account")
async def kucoin_account(user: dict = Depends(get_current_user)):
    client, mode = await get_user_kucoin(user["id"])
    if not client:
        raise HTTPException(400, "No live KuCoin API keys bound. Bind in real mode first.")
    try:
        data = await client.accounts(account_type="trade")
    except KuCoinError as e:
        raise HTTPException(400, f"KuCoin error ({e.code}): {e.message}")
    except Exception as e:
        raise HTTPException(400, f"KuCoin unreachable: {e}")
    balances = [
        {"asset": b["currency"], "free": float(b.get("available", 0) or 0), "locked": float(b.get("holds", 0) or 0)}
        for b in (data or [])
        if float(b.get("balance", 0) or 0) > 0
    ]
    return {"mode": mode, "canTrade": True, "accountType": "trade", "balances": balances}


@api.get("/lbank/account")
async def lbank_account(user: dict = Depends(get_current_user)):
    client, mode = await get_user_lbank(user["id"])
    if not client:
        raise HTTPException(400, "No live LBank API keys bound. Bind in real mode first.")
    try:
        resp = await client.user_info()
    except LBankError as e:
        raise HTTPException(400, f"LBank error ({e.code}): {e.message}")
    except Exception as e:
        raise HTTPException(400, f"LBank unreachable: {e}")
    m = LBankClient._parse_balances(resp)
    balances = [
        {"asset": asset, "free": v["free"], "locked": v["locked"]}
        for asset, v in m.items() if v["free"] > 0 or v["locked"] > 0
    ]
    return {"mode": mode, "canTrade": True, "accountType": "trade", "balances": balances}


@api.get("/lbank/diagnose")
async def lbank_diagnose(
    place: bool = False,
    amount: float = 5.0,
    symbol: str = "SOLUSDT",
    user: dict = Depends(get_current_user),
):
    """Live LBank diagnostic: proves (from the user's own account) whether the pair is
    listed and whether a real spot order is accepted. Returns LBank's raw responses.
    Call with ?place=true&amount=5 to actually attempt a tiny market buy."""
    client, mode = await get_user_lbank(user["id"])
    if not client:
        raise HTTPException(400, "No live LBank API keys bound. Bind in real mode first.")
    lsym = _lbank_symbol(symbol)
    out = {"mode": mode, "base_url": client.base_url, "app_symbol": symbol, "lbank_symbol": lsym}

    # 1) Is the pair listed for this account?
    try:
        cp = await client.public("/v2/currencyPairs.do")
        pairs = cp.get("data") if isinstance(cp, dict) else None
        if isinstance(pairs, list):
            out["currency_pairs_count"] = len(pairs)
            out["symbol_listed"] = lsym in pairs
        else:
            out["currency_pairs_raw"] = str(cp)[:300]
    except Exception as e:
        out["currency_pairs_error"] = str(e)

    # 2) Does balance read (private auth) work?
    try:
        ui = await client.user_info()
        out["user_info_ok"] = True
        out["user_info_error_code"] = str(ui.get("error_code", "0"))
    except Exception as e:
        out["user_info_ok"] = False
        out["user_info_error"] = str(e)

    # 3) Optionally attempt a real tiny market buy and capture LBank's exact response.
    if place:
        business = {"symbol": lsym, "type": "buy_market", "price": format(Decimal(str(amount)), "f")}
        attempts = {}
        for ep in ["/v2/supplement/create_order.do", "/v2/create_order.do"]:
            raw = await client.raw_private(ep, business)
            attempts[ep] = raw
            body = raw.get("body") if isinstance(raw, dict) else None
            if isinstance(body, dict) and str(body.get("error_code", "x")) == "0":
                break  # order accepted — do not fire the second endpoint
        out["order_attempts"] = attempts
    return out
class LBankBindIn(BaseModel):
    api_key: str
    api_secret: str
    mode: Literal["real", "demo"] = "demo"


@api.post("/lbank/bind")
async def lbank_bind(body: LBankBindIn, user: dict = Depends(get_current_user)):
    # One exchange per account — block if another exchange is already connected.
    if await db.binance_keys.find_one({"user_id": user["id"]}):
        raise HTTPException(400, "Binance is already connected to this account. Disconnect Binance first to add LBank.")
    if await db.kucoin_keys.find_one({"user_id": user["id"]}):
        raise HTTPException(400, "KuCoin is already connected to this account. Disconnect KuCoin first to add LBank.")
    # For live mode, verify the keys actually work before saving.
    if body.mode == "real":
        client = LBankClient(body.api_key, body.api_secret)
        try:
            await client.user_info()
        except LBankError as e:
            if str(e.code) in ("10022", "10025"):
                raise HTTPException(400, f"LBank: server IP not whitelisted. Add {await get_server_ip()} to your API key's IP list.")
            raise HTTPException(400, f"LBank rejected keys ({e.code}): {e.message}")
        except Exception as e:
            raise HTTPException(400, f"LBank unreachable: {e}")
    doc = {
        "user_id": user["id"],
        "api_key_enc": encrypt_text(body.api_key),
        "api_secret_enc": encrypt_text(body.api_secret),
        "api_key_mask": mask(body.api_key),
        "mode": body.mode,
        "updated_at": iso(now_utc()),
    }
    await db.lbank_keys.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    await db.users.update_one({"id": user["id"]}, {"$set": {"active_exchange": "lbank"}})
    return {"ok": True, "mask": doc["api_key_mask"], "mode": body.mode}


@api.get("/lbank/bind")
async def lbank_get_bind(user: dict = Depends(get_current_user)):
    row = await db.lbank_keys.find_one(
        {"user_id": user["id"]},
        {"_id": 0, "api_key_enc": 0, "api_secret_enc": 0})
    if not row:
        return {"mode": None, "api_key_mask": None, "bound": False, "whitelist_ip": await get_server_ip()}
    row["bound"] = row.get("mode") == "real"
    row["whitelist_ip"] = await get_server_ip()
    return row


@api.delete("/lbank/bind")
async def lbank_unbind(user: dict = Depends(get_current_user)):
    await db.lbank_keys.delete_one({"user_id": user["id"]})
    await db.users.update_one({"id": user["id"]}, {"$set": {"active_exchange": "binance"}})
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


# Cached full Binance 24hr ticker map (symbol -> row) — reused by coin search.
_TICKER_ALL = {"ts": 0.0, "data": {}}


async def _all_tickers_cached(ttl: float = 60.0):
    import time as _t
    now = _t.time()
    if _TICKER_ALL["data"] and (now - _TICKER_ALL["ts"] < ttl):
        return _TICKER_ALL["data"]
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/24hr")
            r.raise_for_status()
            data = {d["symbol"]: d for d in r.json()}
            _TICKER_ALL["ts"] = now
            _TICKER_ALL["data"] = data
            return data
    except Exception as e:
        logger.warning(f"_all_tickers_cached failed: {e}")
        return _TICKER_ALL["data"] or {}


@api.get("/market/search")
async def market_search(q: str = "", limit: int = 30):
    """Search ALL tradable Binance USDT pairs by coin ticker/base asset.
    Matches ALLOWED_SYMBOLS (populated from Binance exchangeInfo at startup)."""
    query = (q or "").strip().upper().replace("/", "").replace(" ", "")
    if not query:
        return {"results": []}
    # Strip trailing USDT so "BTCUSDT" and "BTC" both match
    qbase = query[:-4] if query.endswith("USDT") and len(query) > 4 else query

    tickers = await _all_tickers_cached()
    results = []
    for sym in ALLOWED_SYMBOLS:
        base = sym[:-4] if sym.endswith("USDT") else sym
        if qbase not in base:
            continue
        row = tickers.get(sym) or {}
        results.append({
            "symbol": sym,
            "asset": base,
            "last_price": float(row.get("lastPrice", 0) or 0),
            "change_pct": float(row.get("priceChangePercent", 0) or 0),
            "volume": float(row.get("quoteVolume", 0) or 0),
        })
    # Prefix matches first, then by 24h volume (most liquid first)
    results.sort(key=lambda x: (0 if x["asset"].startswith(qbase) else 1, -x["volume"]))
    return {"results": results[:max(1, min(100, limit))]}


# Simple in-memory cache for the top-50 list (refresh every 5 min)
_TOP_CACHE = {"ts": 0.0, "data": None}
_TOP_REFRESHING = {"v": False}
# Shared symbol -> logo URL map (populated from CoinGecko markets in top_market,
# reused by market_movers so Gainers/Losers also get real coin logos).
_SYMBOL_IMAGE = {}


async def _top_market_refresh(limit: int):
    try:
        await top_market(limit=limit, force=True)
    except Exception:
        pass
    finally:
        _TOP_REFRESHING["v"] = False
_STABLE_SYMBOLS = {"USDT", "USDC", "DAI", "TUSD", "BUSD", "FDUSD", "PYUSD", "USDD", "USDS"}


@api.get("/market/top")
async def top_market(limit: int = 50, force: bool = False):
    import time as _t
    now = _t.time()
    if not force and _TOP_CACHE["data"] and _TOP_CACHE["data"].get("count", 0) >= limit:
        if now - _TOP_CACHE["ts"] >= 300 and not _TOP_REFRESHING["v"]:
            _TOP_REFRESHING["v"] = True
            asyncio.create_task(_top_market_refresh(limit))
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


# ==== Upcoming Binance listings (keyless public announcement feed) ====
_UPCOMING_CACHE = {"ts": 0.0, "data": None}
_UPCOMING_REFRESHING = {"v": False}
BINANCE_CMS = "https://www.binance.com/bapi/composite/v1/public/cms"
_UPCOMING_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"


async def _upcoming_refresh():
    try:
        await market_upcoming(force=True)
    except Exception:
        pass
    finally:
        _UPCOMING_REFRESHING["v"] = False


async def _fetch_listing_time(client, code):
    """Fetch a Binance announcement article and extract the first 'YYYY-MM-DD HH:MM (UTC)'
    which is the trading-open time for new spot listings."""
    try:
        r = await client.get(f"{BINANCE_CMS}/article/detail/query", params={"articleCode": code})
        r.raise_for_status()
        body = (r.json().get("data") or {}).get("body") or ""
        m = re.findall(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s*\(UTC", body)
        if m:
            return datetime.strptime(m[0], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except Exception:
        pass
    return None


@api.get("/market/upcoming")
async def market_upcoming(force: bool = False):
    """Real upcoming spot listings parsed from Binance's public 'New Cryptocurrency
    Listing' announcements (catalogId=48). Keyless. Returns only FUTURE listings.
    Stale-while-revalidate cache, refreshed every 30 min."""
    import time as _t
    now = _t.time()
    if not force and _UPCOMING_CACHE["data"] is not None:
        if now - _UPCOMING_CACHE["ts"] >= 1800 and not _UPCOMING_REFRESHING["v"]:
            _UPCOMING_REFRESHING["v"] = True
            asyncio.create_task(_upcoming_refresh())
        return _UPCOMING_CACHE["data"]

    coins = []
    try:
        async with httpx.AsyncClient(timeout=15, headers={"User-Agent": _UPCOMING_UA}) as c:
            r = await c.get(
                f"{BINANCE_CMS}/article/list/query",
                params={"type": 1, "catalogId": 48, "pageNo": 1, "pageSize": 20},
            )
            r.raise_for_status()
            cats = (r.json().get("data") or {}).get("catalogs") or []
            arts = cats[0].get("articles", []) if cats else []
            cands = []
            for a in arts:
                title = a.get("title") or ""
                if "Will List" not in title:
                    continue
                m = re.search(r"\(([A-Z0-9]{2,10})\)", title)
                if not m:
                    continue
                asset = m.group(1)
                name = title.replace("Binance Will List", "")
                name = re.sub(r"\s*\(.*", "", name).strip()
                name = re.sub(r"\s+with .*$", "", name, flags=re.I).strip() or asset
                cands.append({"code": a.get("code"), "asset": asset, "name": name, "title": title})
                if len(cands) >= 8:
                    break
            times = await asyncio.gather(*[_fetch_listing_time(c, x["code"]) for x in cands]) if cands else []
            nowdt = now_utc()
            seen = set()
            for x, t in zip(cands, times):
                if t and t > nowdt and x["asset"] not in seen:
                    seen.add(x["asset"])
                    coins.append({
                        "symbol": f"{x['asset']}USDT",
                        "asset": x["asset"],
                        "name": x["name"],
                        "launchAt": iso(t),
                        "tagline": "New Binance listing",
                        "url": f"https://www.binance.com/en/support/announcement/{x['code']}",
                    })
            coins.sort(key=lambda z: z["launchAt"])
    except Exception as e:
        logger.warning(f"market_upcoming failed: {e}")
        if _UPCOMING_CACHE["data"] is not None:
            return _UPCOMING_CACHE["data"]

    result = {"coins": coins, "count": len(coins), "source": "binance", "cached_at": iso(now_utc())}
    _UPCOMING_CACHE["ts"] = now
    _UPCOMING_CACHE["data"] = result
    return result


# ==== Top Gainers / Losers across ALL Binance USDT spot pairs ====
_MOVERS_CACHE = {"ts": 0.0, "data": None}
_MOVERS_REFRESHING = {"v": False}
_LEV_SUFFIX = ("UPUSDT", "DOWNUSDT", "BULLUSDT", "BEARUSDT")


async def _movers_refresh(limit: int, min_volume: float):
    try:
        await market_movers(limit=limit, min_volume=min_volume, force=True)
    except Exception:
        pass
    finally:
        _MOVERS_REFRESHING["v"] = False


_IMG_MAP_TS = {"ts": 0.0}
BINANCE_ASSET_API = "https://www.binance.com/bapi/asset/v2/public/asset/asset/get-all-asset"


async def _ensure_symbol_images():
    """Build/refresh symbol -> official Binance logo URL map from Binance's public
    get-all-asset endpoint (~1091 assets, the exact logos the Binance app shows).
    Keyless. Cached 6h."""
    import time as _t
    if _SYMBOL_IMAGE and _t.time() - _IMG_MAP_TS["ts"] < 21600:
        return
    try:
        async with httpx.AsyncClient(timeout=15, headers={"User-Agent": _UPCOMING_UA}) as c:
            r = await c.get(BINANCE_ASSET_API)
            r.raise_for_status()
            data = (r.json() or {}).get("data") or []
        for x in data:
            if not isinstance(x, dict):
                continue
            code = (x.get("assetCode") or "").upper()
            logo = x.get("logoUrl") or x.get("fullLogoUrl")
            if code and logo:
                _SYMBOL_IMAGE[code] = logo
        if _SYMBOL_IMAGE:
            _IMG_MAP_TS["ts"] = _t.time()
    except Exception as e:
        logger.warning(f"symbol image map build failed: {e}")


@api.get("/market/movers")
async def market_movers(limit: int = 50, min_volume: float = 500000, force: bool = False):
    """Real top gainers & losers computed over the FULL Binance USDT spot universe
    (not just the top-50 by market cap). Mirrors Binance's Gainers/Losers tabs.
    Stale-while-revalidate cache, refreshed every 30s."""
    import time as _t
    now = _t.time()
    if not force and _MOVERS_CACHE["data"]:
        if now - _MOVERS_CACHE["ts"] >= 30 and not _MOVERS_REFRESHING["v"]:
            _MOVERS_REFRESHING["v"] = True
            asyncio.create_task(_movers_refresh(limit, min_volume))
        return _MOVERS_CACHE["data"]

    await _ensure_symbol_images()
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            r = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/24hr")
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning(f"market_movers failed: {e}")
        if _MOVERS_CACHE["data"]:
            return _MOVERS_CACHE["data"]
        return {"gainers": [], "losers": [], "count": 0, "error": "binance_unreachable"}

    rows = []
    for d in data:
        sym = d.get("symbol", "")
        if not sym.endswith("USDT") or sym.endswith(_LEV_SUFFIX):
            continue
        base = sym[:-4]
        if not base or base in _STABLE_SYMBOLS:
            continue
        try:
            vol = float(d.get("quoteVolume", 0))
            price = float(d.get("lastPrice", 0))
            chg = float(d.get("priceChangePercent", 0))
        except Exception:
            continue
        if price <= 0 or vol < min_volume:
            continue
        rows.append({"symbol": sym, "asset": base, "name": base,
                     "image": _SYMBOL_IMAGE.get(base),
                     "last_price": price, "change_pct": chg, "volume": vol})

    gainers = sorted(rows, key=lambda x: x["change_pct"], reverse=True)[:limit]
    losers = sorted(rows, key=lambda x: x["change_pct"])[:limit]
    result = {"gainers": gainers, "losers": losers, "count": len(rows), "cached_at": iso(now_utc())}
    _MOVERS_CACHE["ts"] = now
    _MOVERS_CACHE["data"] = result
    return result


# ==== Bot Config ====
DEFAULT_MARGIN_CONFIG = [
    {"drop": 25.0, "multiplier": 1.0},
    {"drop": 25.0, "multiplier": 1.0},
    {"drop": 25.0, "multiplier": 1.0},
    {"drop": 25.0, "multiplier": 1.0},
    {"drop": 100.0, "multiplier": 1.0},
]

DEFAULT_BOT_CFG = {
    "first_buy_amount": 10.0,
    "open_position_double": False,
    "margin_call_limit": 5,
    "whole_take_profit_ratio": 1.25,
    "whole_take_profit_callback": 0.25,
    "buy_in_callback": 0.25,
    "trade_method": "One-Shot",
    "trade_mode": "oneshot",
    "sub_take_profit_callback": 0.25,
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
        return {"drop": float(bot.get("buy_in_callback", 0.25) or 0.25), "multiplier": 1.0}
    idx = min(round_idx, len(cfg) - 1)
    r = cfg[idx]
    return {
        "drop": float(r.get("drop", 2.0) or 2.0),
        "multiplier": float(r.get("multiplier", 2.0) or 2.0),
    }


def _is_oneshot(bot: dict) -> bool:
    """One-Shot is a single concept exposed in two places (Trade Settings ->
    trade_method 'One-Shot', Trade screen quick toggle -> trade_mode 'oneshot').
    A bot is One-Shot if EITHER field says so (covers legacy / out-of-sync docs)."""
    return bot.get("trade_mode") == "oneshot" or bot.get("trade_method") == "One-Shot"


def _normalize_trade_fields(doc: dict) -> None:
    """Force trade_method and trade_mode to agree so both screens show the same state."""
    one = _is_oneshot(doc)
    doc["trade_method"] = "One-Shot" if one else "Cycle"
    doc["trade_mode"] = "oneshot" if one else "cycle"



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

    # Anchor: ladder ALWAYS chains down from the LAST BUY PRICE (not the blended
    # average). If idle, chain from current market price so user can preview.
    last_buy = float(bot.get("last_buy_price", 0) or 0)
    anchor = last_buy if last_buy > 0 else (avg_price if avg_price > 0 else float(current_price or 0))
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
    # Lifetime stats per symbol (Idle/History tab ke liye — kabhi reset nahi hote)
    stats_by_sym: dict = {}
    async for a in db.transactions.aggregate([
        {"$match": {"user_id": user["id"]}},
        {"$group": {
            "_id": {"symbol": "$symbol", "side": "$side"},
            "count": {"$sum": 1},
            "profit_sum": {"$sum": {"$ifNull": ["$profit", 0]}},
            "first_at": {"$min": "$created_at"},
            "last_at": {"$max": "$created_at"},
        }},
    ]):
        sym = a["_id"]["symbol"]
        side = a["_id"]["side"]
        s = stats_by_sym.setdefault(sym, {
            "lifetime_buy_count": 0, "lifetime_sell_count": 0,
            "cumulative_profit": 0.0, "first_at": None, "last_at": None,
        })
        if side == "BUY":
            s["lifetime_buy_count"] = a["count"]
        elif side == "SELL":
            s["lifetime_sell_count"] = a["count"]
            s["cumulative_profit"] = round(a["profit_sum"], 4)
        s["first_at"] = min(filter(None, [s["first_at"], a["first_at"]]), default=None)
        s["last_at"] = max(filter(None, [s["last_at"], a["last_at"]]), default=None)

    # Session-scoped counts + date range: har restart ke baad fresh (session_started_at se)
    sess_conds = []
    for r in rows:
        ss = r.get("session_started_at")
        cond = {"symbol": r["symbol"]}
        if ss:
            cond["created_at"] = {"$gte": ss}
        sess_conds.append(cond)
    sess_match = {"user_id": user["id"]}
    if sess_conds:
        sess_match["$or"] = sess_conds
    pipeline = [
        {"$match": sess_match},
        {"$group": {
            "_id": {"symbol": "$symbol", "side": "$side"},
            "count": {"$sum": 1},
        }},
    ]
    counts_by_sym: dict = {}
    async for a in db.transactions.aggregate(pipeline):
        sym = a["_id"]["symbol"]
        side = a["_id"]["side"]
        s = counts_by_sym.setdefault(sym, {"buy_count": 0, "sell_count": 0})
        if side == "BUY":
            s["buy_count"] = a["count"]
        elif side == "SELL":
            s["sell_count"] = a["count"]

    # First + last transaction date per symbol (session-scoped)
    range_pipeline = [
        {"$match": sess_match},
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
        _normalize_trade_fields(r)
        c = counts_by_sym.get(r["symbol"], {"buy_count": 0, "sell_count": 0})
        r["buy_count"] = c["buy_count"]
        r["sell_count"] = c["sell_count"]
        lt = stats_by_sym.get(r["symbol"], {})
        r["cumulative_profit"] = lt.get("cumulative_profit", 0.0)
        r["lifetime_buy_count"] = lt.get("lifetime_buy_count", 0)
        r["lifetime_sell_count"] = lt.get("lifetime_sell_count", 0)
        r["lifetime_first_at"] = lt.get("first_at")
        r["lifetime_last_at"] = lt.get("last_at")
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
    _normalize_trade_fields(merged)

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
    # tp_armed  → price crossed take-profit target, bot is chasing the peak
    # dca_armed → price crossed DCA target, bot is chasing the bottom
    # (HiTechBot style: no re-entry wait — first buy fires immediately)
    tp_armed = position_qty > 0 and peak > 0
    dca_armed = position_qty > 0 and trough > 0 and mc_count < mc_limit
    reentry_armed = False

    # Locked-in profit % if a peak has been recorded
    locked_profit_pct = 0.0
    if tp_armed and avg_price > 0:
        pullback_price = peak * (1 - tp_callback / 100.0)
        locked_profit_pct = ((pullback_price - avg_price) / avg_price) * 100.0

    # Recovery trigger for trailing DCA — price must climb back this high
    # from the tracked trough before the safety-order fires.
    dca_recover_trigger = trough * (1 + buy_cb / 100.0) if trough > 0 else 0.0

    if position_qty == 0:
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
    merged["reentry_trigger_price"] = 0
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
    if float(cfg.first_buy_amount or 0) < MIN_FIRST_BUY:
        raise HTTPException(400, f"Minimum First Buy Amount is ${MIN_FIRST_BUY:.0f}. Amounts below this can fail to sell due to Binance minimum order limits.")
    # Serialize margin_config (list of MarginRule pydantic objects) to plain dicts
    mc = cfg.margin_config
    mc_docs = [r.model_dump() for r in mc] if mc else DEFAULT_MARGIN_CONFIG
    # MASTER SYNC: margin_call_limit drives row counts of margin_config & sub_position_tps
    limit = max(1, min(50, int(cfg.margin_call_limit or 1)))
    mc_docs = list(mc_docs)[:limit]
    while len(mc_docs) < limit:
        last = mc_docs[-1] if mc_docs else {"drop": 2.0, "multiplier": 2.0}
        mc_docs.append({"drop": float(last.get("drop", 2.0)), "multiplier": float(last.get("multiplier", 2.0))})
    tps = [float(x) for x in (cfg.sub_position_tps or [])][:limit]
    while len(tps) < limit:
        tps.append(float(cfg.whole_take_profit_ratio or 1.5))
    doc = {
        "user_id": user["id"],
        "symbol": symbol,
        "first_buy_amount": cfg.first_buy_amount,
        "open_position_double": cfg.open_position_double,
        "margin_call_limit": limit,
        "whole_take_profit_ratio": cfg.whole_take_profit_ratio,
        "whole_take_profit_callback": cfg.whole_take_profit_callback,
        "buy_in_callback": cfg.buy_in_callback,
        "trade_method": cfg.trade_method,
        "trade_mode": "oneshot" if cfg.trade_method == "One-Shot" else "cycle",
        "sub_take_profit_callback": cfg.sub_take_profit_callback,
        "margin_config": mc_docs,
        "sub_position_tps": tps,
        "updated_at": iso(now_utc()),
    }
    existing = await db.bots.find_one({"user_id": user["id"], "symbol": symbol})
    if not existing:
        urow = await db.users.find_one({"id": user["id"]}, {"_id": 0, "active_exchange": 1})
        doc.update({
            "id": str(uuid.uuid4()),
            "status": "stopped",
            "position_amount": 0.0,
            "position_qty": 0.0,
            "avg_price": 0.0,
            "margin_call_count": 0,
            "exchange": (urow or {}).get("active_exchange", "binance"),
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
    # Block bot start if no exchange is connected — no trading until the user
    # binds an exchange (Binance/KuCoin).
    if not await _has_connected_exchange(user["id"]):
        raise HTTPException(400, "Please connect an exchange (Binance, KuCoin or LBank) from Bind API before starting the bot.")
    # Block bot start if Bot Wallet is not activated / has no balance
    w = await _get_or_create_bot_wallet(user["id"])
    if not w.get("activated"):
        raise HTTPException(400, "Bot wallet not activated. Please activate your bot from the Bot tab to start trading.")
    if float(w.get("balance", 0.0) or 0.0) < BOT_MIN_FUEL_BALANCE:
        raise HTTPException(400, f"Minimum ${BOT_MIN_FUEL_BALANCE:.0f} fuel required to run the bot. Please deposit.")

    pre = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}, {"first_buy_amount": 1})
    if pre and float(pre.get("first_buy_amount", 0) or 0) < MIN_FIRST_BUY:
        raise HTTPException(400, f"Minimum First Buy Amount is ${MIN_FIRST_BUY:.0f}. Please update your strategy before starting the bot.")

    # FRESH START: agar purani (stale) position padi hai to use pehle clear karo.
    # Demo mode: cost-basis refund (no profit, no fee). Real/testnet: market sell.
    bot = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}, {"_id": 0})
    stale_qty = float((bot or {}).get("position_qty", 0.0) or 0.0)
    if bot and stale_qty > 0:
        _, mode = await get_user_binance(user["id"])
        if mode in ("real", "testnet"):
            try:
                await _execute_trade(user_id=user["id"], symbol=symbol, side="SELL",
                                     quantity=stale_qty, source="fresh_start")
            except _TradeError as e:
                logger.warning(f"bot {symbol}: fresh-start sell failed: {e.msg}")
        else:
            cost = float(bot.get("position_amount", 0.0) or 0.0)
            if cost > 0:
                await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_usdt": cost}})
            await db.bot_events.insert_one({
                "id": str(uuid.uuid4()), "user_id": user["id"], "symbol": symbol,
                "kind": "fresh_start_refund", "amount": cost,
                "created_at": iso(now_utc()),
            })

    now = iso(now_utc())
    await db.bots.update_one(
        {"user_id": user["id"], "symbol": symbol},
        {"$set": {
            "status": "running", "started_at": now,
            "session_started_at": now,
            "position_qty": 0.0, "position_amount": 0.0, "avg_price": 0.0,
            "margin_call_count": 0, "last_buy_price": 0.0, "next_buy_price": 0.0,
            "peak_price": 0.0, "dca_bottom_price": 0.0, "sub_positions": [],
            "cycles_completed": 0, "stop_reason": "",
            "trade_mode": "oneshot" if _is_oneshot(bot or {}) else "cycle",
            "trade_method": "One-Shot" if _is_oneshot(bot or {}) else "Cycle",
        }},
        upsert=True,
    )
    return {"status": "running", "symbol": symbol, "fresh_start": True}


@api.post("/bots/{symbol}/mode")
async def set_bot_mode(symbol: str, body: dict, user: dict = Depends(get_current_user)):
    """Trade mode: 'cycle' (auto re-buy) ya 'oneshot' (agle profit book ke baad stop)."""
    symbol = symbol.upper()
    tmode = str(body.get("mode", "")).lower()
    if tmode not in ("cycle", "oneshot"):
        raise HTTPException(400, "mode must be 'cycle' or 'oneshot'")
    r = await db.bots.update_one(
        {"user_id": user["id"], "symbol": symbol},
        {"$set": {"trade_mode": tmode,
                  "trade_method": "One-Shot" if tmode == "oneshot" else "Cycle"}})
    if r.matched_count == 0:
        raise HTTPException(404, "Bot not found")
    return {"symbol": symbol, "trade_mode": tmode}


@api.post("/bots/{symbol}/sell-now")
async def sell_now(symbol: str, user: dict = Depends(get_current_user)):
    """Current position turant market par SELL (confirmation frontend par ho chuki hai)."""
    symbol = symbol.upper()
    bot = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}, {"_id": 0})
    qty = float((bot or {}).get("position_qty", 0.0) or 0.0)
    if not bot or qty <= 0:
        raise HTTPException(400, "No open position to sell")
    try:
        txn = await _execute_trade(user_id=user["id"], symbol=symbol, side="SELL",
                                   quantity=qty, source="manual_sell")
    except _TradeError as e:
        raise HTTPException(e.status_code, e.msg)
    await db.bot_events.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "symbol": symbol,
        "kind": "manual_sell", "price": txn.get("price"),
        "amount": txn.get("amount"), "profit": txn.get("profit"),
        "created_at": iso(now_utc()),
    })
    # ONE SHOT me manual sell ke baad bhi re-buy nahi hona chahiye — stop.
    # Mode One-Shot hi rehta hai (permanent) taaki restart par dobara set na karna pade.
    if _is_oneshot(bot):
        await db.bots.update_one(
            {"user_id": user["id"], "symbol": symbol},
            {"$set": {"status": "stopped", "trade_mode": "oneshot", "trade_method": "One-Shot",
                      "stopped_at": iso(now_utc())}})
    return {"ok": True, "symbol": symbol, "sold_qty": txn.get("quantity"),
            "price": txn.get("price"), "profit": txn.get("profit")}


@api.get("/bots/{symbol}/average-preview")
async def average_preview(symbol: str, amount: float = 0.0, user: dict = Depends(get_current_user)):
    """Manual DCA ('Average') preview: current avg, floating loss, suggested buy
    (amount that pulls the average down close to the live price) and the
    resulting new average price."""
    symbol = symbol.upper()
    bot = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}, {"_id": 0})
    if not bot:
        raise HTTPException(404, "Bot not found")
    qty = float(bot.get("position_qty", 0.0) or 0.0)
    avg = float(bot.get("avg_price", 0.0) or 0.0)
    if qty <= 0 or avg <= 0:
        raise HTTPException(400, "No open position to average")
    try:
        live = await fetch_price(symbol)
    except Exception:
        live = avg
    floating = qty * live - qty * avg
    floating_pct = ((live - avg) / avg) * 100 if avg > 0 else 0.0
    # Suggested buy (a sensible default — editable in the UI). Buying an amount
    # equal to the current market value of the position pulls the average down
    # to roughly the midpoint between avg and live (loss cut ~in half). Realistic
    # and meaningful; the user can raise/lower it and watch the new average live.
    suggested = 0.0
    if live < avg:
        suggested = qty * live
    suggested = max(0.0, round(suggested, 2))
    buy_amt = float(amount) if amount and amount > 0 else suggested
    if buy_amt > 0 and live > 0:
        add_qty = buy_amt / live
        new_avg = (qty * avg + buy_amt) / (qty + add_qty)
    else:
        new_avg = avg
    return {
        "symbol": symbol,
        "live_price": live,
        "position_qty": qty,
        "current_avg_price": avg,
        "current_loss": floating,
        "current_loss_pct": floating_pct,
        "suggested_buy": suggested,
        "buy_amount": round(buy_amt, 2),
        "new_avg_price": new_avg,
    }


class AverageIn(BaseModel):
    amount: float


@api.post("/bots/{symbol}/average")
async def average_position(symbol: str, body: AverageIn, user: dict = Depends(get_current_user)):
    """Manual DCA buy. Adds to the position at market price, then resets the
    Safety Call counter to C1 so the ladder restarts off the new average."""
    symbol = symbol.upper()
    if not await _has_connected_exchange(user["id"]):
        raise HTTPException(400, "Please connect an exchange (Binance, KuCoin or LBank) first.")
    bot = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}, {"_id": 0})
    if not bot:
        raise HTTPException(404, "Bot not found")
    if float(bot.get("position_qty", 0.0) or 0.0) <= 0:
        raise HTTPException(400, "No open position to average")
    amount = float(body.amount or 0.0)
    if amount < MIN_FIRST_BUY:
        raise HTTPException(400, f"Minimum average buy is ${MIN_FIRST_BUY:.0f}")
    try:
        txn = await _execute_trade(user_id=user["id"], symbol=symbol, side="BUY",
                                   usdt_amount=amount, source="manual_average")
    except _TradeError as e:
        raise HTTPException(e.status, e.msg)
    # Reset the Safety Call ladder to C1 off the new average price.
    fresh = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}, {"_id": 0})
    new_avg = float(fresh.get("avg_price", 0.0) or 0.0)
    c1 = _get_margin_rule(fresh, 0)
    next_buy_price = new_avg * (1 - c1["drop"] / 100.0) if new_avg > 0 else 0.0
    await db.bots.update_one(
        {"user_id": user["id"], "symbol": symbol},
        {"$set": {"margin_call_count": 0, "next_buy_price": next_buy_price,
                  "last_buy_price": txn.get("price"), "peak_price": 0.0,
                  "dca_bottom_price": 0.0}})
    await db.bot_events.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "symbol": symbol,
        "kind": "manual_average", "price": txn.get("price"),
        "amount": txn.get("amount"), "new_avg_price": new_avg,
        "created_at": iso(now_utc()),
    })
    return {"ok": True, "symbol": symbol, "new_avg_price": new_avg,
            "bought_qty": txn.get("quantity"), "price": txn.get("price"),
            "next_buy_price": next_buy_price}



@api.post("/bots/{symbol}/stop")
async def stop_bot(symbol: str, user: dict = Depends(get_current_user)):
    symbol = symbol.upper()
    # Stop = wahin par band: open position current market price par close hoti hai
    bot = await db.bots.find_one({"user_id": user["id"], "symbol": symbol}, {"_id": 0})
    closed_profit = None
    qty = float((bot or {}).get("position_qty", 0.0) or 0.0)
    if bot and qty > 0:
        try:
            txn = await _execute_trade(user_id=user["id"], symbol=symbol, side="SELL",
                                       quantity=qty, source="bot_stop")
            closed_profit = txn.get("profit")
            await db.bot_events.insert_one({
                "id": str(uuid.uuid4()), "user_id": user["id"], "symbol": symbol,
                "kind": "stop_close", "price": txn.get("price"),
                "amount": txn.get("amount"), "profit": closed_profit,
                "created_at": iso(now_utc()),
            })
        except _TradeError as e:
            logger.warning(f"bot {symbol}: stop-close sell failed: {e.msg}")
    await db.bots.update_one(
        {"user_id": user["id"], "symbol": symbol},
        {"$set": {"status": "stopped", "stopped_at": iso(now_utc())}},
    )
    return {"status": "stopped", "symbol": symbol,
            "position_closed": closed_profit is not None, "close_profit": closed_profit}


# ==== Trading (Real Binance orders when bound in real/testnet; Demo simulation otherwise) ====
async def fetch_price(symbol: str) -> float:
    async with httpx.AsyncClient(timeout=8) as c:
        r = await c.get(f"{BINANCE_PUBLIC}/api/v3/ticker/price", params={"symbol": symbol})
        r.raise_for_status()
        return float(r.json()["price"])


_PRICE_CACHE: dict = {}


async def fetch_price_cached(symbol: str, ttl: float = 10.0) -> float:
    now = time.time()
    hit = _PRICE_CACHE.get(symbol)
    if hit and now - hit[1] < ttl:
        return hit[0]
    p = await fetch_price(symbol)
    _PRICE_CACHE[symbol] = (p, now)
    return p


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


# ==== KuCoin Spot client (async httpx; user provides key+secret+passphrase) ====
KUCOIN_BASE_URL = os.environ.get("KUCOIN_BASE_URL", "https://api.kucoin.com")


class KuCoinError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message
        super().__init__(f"KuCoin {status}/{code}: {message}")


class KuCoinClient:
    def __init__(self, key, secret, passphrase, key_version="3", base_url=KUCOIN_BASE_URL):
        self.key, self.secret, self.passphrase = key, secret, passphrase
        self.key_version, self.base_url = key_version or "3", base_url.rstrip("/")

    @staticmethod
    def _b64(raw: bytes) -> str:
        return base64.b64encode(raw).decode()

    def _headers(self, method, endpoint, body, ts):
        prehash = ts + method.upper() + endpoint + body
        sign = self._b64(hmac.new(self.secret.encode(), prehash.encode(), hashlib.sha256).digest())
        pph = self._b64(hmac.new(self.secret.encode(), self.passphrase.encode(), hashlib.sha256).digest())
        return {
            "KC-API-KEY": self.key, "KC-API-SIGN": sign, "KC-API-TIMESTAMP": ts,
            "KC-API-PASSPHRASE": pph, "KC-API-KEY-VERSION": self.key_version,
            "Content-Type": "application/json",
        }

    async def request(self, method, endpoint, payload=None, private=True):
        body = "" if payload is None else _json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        ts = str(int(time.time() * 1000))
        headers = self._headers(method, endpoint, body, ts) if private else {"Content-Type": "application/json"}
        transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")  # force IPv4 so KuCoin sees the whitelisted IPv4
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15.0, transport=transport) as http:
            r = await http.request(method.upper(), endpoint, content=body if body else None, headers=headers)
        try:
            data = r.json()
        except ValueError:
            raise KuCoinError(r.status_code, "NON_JSON", r.text[:300])
        if r.status_code >= 400 or str(data.get("code")) != "200000":
            raise KuCoinError(r.status_code, str(data.get("code")), str(data.get("msg", data)))
        return data["data"]

    async def accounts(self, currency=None, account_type="trade"):
        q = f"?type={account_type}" + (f"&currency={currency}" if currency else "")
        return await self.request("GET", "/api/v1/accounts" + q)

    async def ticker(self, symbol):
        return await self.request("GET", f"/api/v1/market/orderbook/level1?symbol={symbol}", private=False)

    async def symbol_rules(self, symbol):
        return await self.request("GET", f"/api/v2/symbols/{symbol}", private=False)

    async def market_buy_funds(self, symbol, usdt: Decimal):
        return await self.request("POST", "/api/v1/orders", {
            "clientOid": str(uuid.uuid4()), "symbol": symbol, "type": "market",
            "side": "buy", "funds": format(usdt, "f")})

    async def market_sell_size(self, symbol, base_size: Decimal):
        return await self.request("POST", "/api/v1/orders", {
            "clientOid": str(uuid.uuid4()), "symbol": symbol, "type": "market",
            "side": "sell", "size": format(base_size, "f")})

    async def order(self, order_id, symbol=None):
        # HF-enabled accounts route /api/v1/orders into the HF system; those orders
        # are NOT visible on the standard endpoint, so fall back to the HF endpoint.
        try:
            return await self.request("GET", f"/api/v1/orders/{order_id}")
        except KuCoinError:
            q = f"?symbol={symbol}" if symbol else ""
            return await self.request("GET", f"/api/v1/hf/orders/{order_id}{q}")

    async def fills(self, symbol, order_id):
        try:
            f = await self.request("GET", f"/api/v1/fills?symbol={symbol}&orderId={order_id}&pageSize=100")
            if f.get("items"):
                return f
        except KuCoinError:
            pass
        return await self.request("GET", f"/api/v1/hf/fills?symbol={symbol}&orderId={order_id}&limit=100")

    async def execution(self, symbol, order_id):
        o = {}
        for _ in range(30):
            try:
                o = await self.order(order_id, symbol)
            except Exception:
                o = {}
            active = o.get("isActive", o.get("active", True)) if o else True
            if o and Decimal(str(o.get("dealSize", "0"))) > 0 and not active:
                break
            await asyncio.sleep(0.25)
        qty = Decimal(str(o.get("dealSize", "0"))) if o else Decimal(0)
        funds = Decimal(str(o.get("dealFunds", "0"))) if o else Decimal(0)
        fee = Decimal(str(o.get("fee", "0"))) if o else Decimal(0)
        ts_ms = o.get("createdAt") if o else None
        # Authoritative fill data from the fills feed (retried — fills can lag the order).
        for _ in range(8):
            try:
                f = await self.fills(symbol, order_id)
                items = f.get("items", [])
                if items:
                    qf = sum((Decimal(str(x["size"])) for x in items), Decimal(0))
                    ff = sum((Decimal(str(x["funds"])) for x in items), Decimal(0))
                    fe = sum((Decimal(str(x.get("fee", "0"))) for x in items), Decimal(0))
                    if qf > 0:
                        qty, funds, fee = qf, ff, fe
                        ts_ms = items[0].get("createdAt") or items[0].get("tradeTime") or ts_ms
                        break
            except Exception:
                pass
            if qty > 0:
                break
            await asyncio.sleep(0.4)
        avg = (funds / qty) if qty > 0 else Decimal(0)
        # KuCoin's actual order/fill time (epoch ms; tradeTime may be ns) → UTC ISO.
        ts_iso = None
        if ts_ms:
            try:
                ms = int(ts_ms)
                if ms > 1e15:  # nanoseconds
                    ms = ms // 1_000_000
                ts_iso = datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()
            except Exception:
                ts_iso = None
        return {"order_id": order_id, "filled_qty": float(qty), "quote": float(funds),
                "avg_price": float(avg), "fee": float(fee), "ts": ts_iso,
                "status": (o.get("status", "done") if o else "done")}


def _kucoin_symbol(symbol: str) -> str:
    """BTCUSDT -> BTC-USDT (quote assumed USDT)."""
    s = symbol.upper()
    return f"{s[:-4]}-USDT" if s.endswith("USDT") else s


async def get_user_kucoin(user_id: str):
    """Return (client, mode). client is None for demo/no-keys."""
    row = await db.kucoin_keys.find_one({"user_id": user_id})
    if not row:
        return None, "demo"
    mode = row.get("mode", "demo")
    if mode == "demo":
        return None, "demo"
    try:
        api_key = decrypt_text(row["api_key_enc"])
        api_secret = decrypt_text(row["api_secret_enc"])
        passphrase = decrypt_text(row["passphrase_enc"])
    except Exception as e:
        logger.error(f"decrypt kucoin keys failed: {e}")
        raise HTTPException(500, "Failed to load KuCoin API credentials")
    return KuCoinClient(api_key, api_secret, passphrase, row.get("key_version", "3")), mode


# ==== LBank Spot client (async httpx; user provides key+secret; HmacSHA256 signing) ====
LBANK_BASE_URL = os.environ.get("LBANK_BASE_URL", "https://api.lbank.info")


class LBankError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message
        super().__init__(f"LBank {status}/{code}: {message}")


def _lbank_symbol(symbol: str) -> str:
    """BTCUSDT -> btc_usdt (quote assumed USDT)."""
    s = symbol.upper()
    return f"{s[:-4].lower()}_usdt" if s.endswith("USDT") else s.lower()


class LBankClient:
    def __init__(self, key, secret, base_url=LBANK_BASE_URL):
        self.key, self.secret = key, secret
        self.base_url = base_url.rstrip("/")

    def _sign(self, form: dict) -> dict:
        # LBank HmacSHA256: MD5(sorted param string).upper() -> HMAC-SHA256(secret, md5).hex
        p = {k: str(v) for k, v in form.items() if v is not None}
        p["signature_method"] = "HmacSHA256"
        p["timestamp"] = str(int(time.time() * 1000))
        p["echostr"] = pysecrets.token_hex(18)  # 36-char alphanumeric
        canonical = "&".join(f"{k}={p[k]}" for k in sorted(p))
        md5u = hashlib.md5(canonical.encode("utf-8")).hexdigest().upper()
        p["sign"] = hmac.new(self.secret.encode("utf-8"), md5u.encode("utf-8"), hashlib.sha256).hexdigest()
        return p

    async def private(self, path, params=None):
        form = self._sign({"api_key": self.key, **(params or {})})
        transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")  # force IPv4 for whitelist
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15.0, transport=transport) as http:
            r = await http.post(path, data=form, headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            data = r.json()
        except ValueError:
            raise LBankError(r.status_code, "NON_JSON", r.text[:300])
        ok = str(data.get("error_code", "0")) in ("0", "") and data.get("result") not in (False, "false")
        if r.status_code >= 400 or not ok:
            raise LBankError(r.status_code, str(data.get("error_code")), str(data.get("msg", data))[:300])
        return data

    async def raw_private(self, path, params=None):
        """Signed POST that returns the FULL raw LBank JSON without raising — for diagnostics."""
        form = self._sign({"api_key": self.key, **(params or {})})
        transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15.0, transport=transport) as http:
            r = await http.post(path, data=form, headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            return {"http_status": r.status_code, "body": r.json()}
        except ValueError:
            return {"http_status": r.status_code, "body_text": r.text[:500]}

    async def public(self, path, params=None):
        transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
        async with httpx.AsyncClient(base_url=self.base_url, timeout=12.0, transport=transport) as http:
            r = await http.get(path, params=params or {})
        return r.json()

    async def user_info(self):
        return await self.private("/v2/supplement/user_info.do")

    @staticmethod
    def _parse_balances(resp: dict) -> dict:
        """Normalize LBank user_info into {ASSET: {'free':float,'locked':float}}.
        Handles both the list shape and the {'info':{'free':{...},'freeze':{...}}} shape."""
        out = {}

        def put(asset, free=0.0, locked=0.0):
            a = str(asset).upper()
            if not a:
                return
            cur = out.setdefault(a, {"free": 0.0, "locked": 0.0})
            try:
                cur["free"] += float(free or 0)
            except Exception:
                pass
            try:
                cur["locked"] += float(locked or 0)
            except Exception:
                pass

        data = resp.get("data")
        rows = None
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = data.get("balances") if isinstance(data.get("balances"), list) else None
            # dict-of-coins shape: data.free / data.freeze
            if rows is None and isinstance(data.get("free"), dict):
                for coin, v in data["free"].items():
                    put(coin, v, (data.get("freeze") or {}).get(coin, 0))
                return out
        if rows is not None:
            for b in rows:
                coin = b.get("coin") or b.get("asset") or b.get("currency")
                free = next((b[k] for k in ("usableAmt", "free", "available") if b.get(k) is not None), 0)
                locked = next((b[k] for k in ("freeze", "freezeAmt", "locked", "hold") if b.get(k) is not None), 0)
                put(coin, free, locked)
            return out
        # legacy info shape
        info = resp.get("info") if isinstance(resp.get("info"), dict) else None
        if info and isinstance(info.get("free"), dict):
            frz = info.get("freeze") or {}
            for coin, v in info["free"].items():
                put(coin, v, frz.get(coin, 0))
        return out

    async def balances_map(self) -> dict:
        try:
            return self._parse_balances(await self.user_info())
        except Exception:
            return {}

    async def free_balance(self, asset: str) -> float:
        """Best-effort free balance of a coin; returns 0.0 if unreadable."""
        m = await self.balances_map()
        row = m.get(str(asset).upper())
        return float(row["free"]) if row else 0.0

    async def accuracy(self, symbol: str) -> int:
        """Base-quantity decimal places for a symbol; 6 as a safe default."""
        try:
            data = (await self.public("/v2/accuracy.do")).get("data", [])
            for row in data or []:
                if str(row.get("symbol", "")).lower() == symbol:
                    return int(float(row.get("quantityAccuracy", 6)))
        except Exception:
            pass
        return 6

    async def _create_order(self, business: dict):
        """Place order; try supplement endpoint first, fall back to legacy /v2/create_order.do
        on 10008 (some spot accounts reject the supplement pair list). Remembers which
        endpoint worked so order lookups use the matching one."""
        try:
            res = await self.private("/v2/supplement/create_order.do", business)
            self._order_ep = "supplement"
            return res
        except LBankError as e:
            if str(e.code) != "10008":
                raise
            res = await self.private("/v2/create_order.do", business)
            self._order_ep = "legacy"
            return res

    async def market_buy_quote(self, symbol, quote: Decimal):
        return await self._create_order({"symbol": symbol, "type": "buy_market", "price": format(quote, "f")})

    async def market_sell_base(self, symbol, base_qty: Decimal):
        return await self._create_order({"symbol": symbol, "type": "sell_market", "amount": format(base_qty, "f")})

    async def order_info(self, symbol, order_id):
        ep = getattr(self, "_order_ep", "supplement")
        paths = ["/v2/supplement/orders_info.do", "/v2/orders_info.do"]
        if ep == "legacy":
            paths = ["/v2/orders_info.do", "/v2/supplement/orders_info.do"]
        last = None
        for p in paths:
            try:
                return await self.private(p, {"symbol": symbol, "orderId": order_id})
            except LBankError as e:
                last = e
                continue
        if last:
            raise last
        return {}

    async def execution(self, symbol, order_id):
        """Poll order info until the market order fills; return normalized fill data."""
        qty = funds = Decimal(0)
        status = "0"
        ts_iso = None
        for _ in range(30):
            try:
                d = (await self.order_info(symbol, order_id)).get("data")
                o = d[0] if isinstance(d, list) and d else (d if isinstance(d, dict) else {})
            except Exception:
                o = {}
            if o:
                qty = Decimal(str(o.get("executedQty", o.get("dealQuantity", "0")) or "0"))
                funds = Decimal(str(o.get("cummulativeQuoteQty", o.get("dealVolumePrice", "0")) or "0"))
                status = str(o.get("status", "0"))
                tms = o.get("updateTime") or o.get("time")
                if tms:
                    try:
                        ts_iso = datetime.fromtimestamp(int(tms) / 1000, tz=timezone.utc).isoformat()
                    except Exception:
                        ts_iso = None
                if status == "2" and qty > 0:
                    break
                if qty > 0 and status in ("-1", "3"):
                    break
            await asyncio.sleep(0.3)
        avg = (funds / qty) if qty > 0 else Decimal(0)
        return {"order_id": order_id, "filled_qty": float(qty), "quote": float(funds),
                "avg_price": float(avg), "fee": 0.0, "ts": ts_iso,
                "status": "done" if status == "2" else status}


async def get_user_lbank(user_id: str):
    """Return (client, mode). client is None for demo/no-keys."""
    row = await db.lbank_keys.find_one({"user_id": user_id})
    if not row:
        return None, "demo"
    mode = row.get("mode", "demo")
    if mode == "demo":
        return None, "demo"
    try:
        api_key = decrypt_text(row["api_key_enc"])
        api_secret = decrypt_text(row["api_secret_enc"])
    except Exception as e:
        logger.error(f"decrypt lbank keys failed: {e}")
        raise HTTPException(500, "Failed to load LBank API credentials")
    return LBankClient(api_key, api_secret), mode


def _parse_fill(order: dict, base_asset: str = "") -> tuple[float, float, float]:

    """Return (net_filled_qty, quote_spent, avg_price). Base-asset commission (Binance
    0.1% fee jo bought coin me katati hai) NET ki jati hai — warna sell fail hota hai."""
    fills = order.get("fills") or []
    if fills:
        qty = sum(float(f["qty"]) for f in fills)
        quote = sum(float(f["qty"]) * float(f["price"]) for f in fills)
        avg = quote / qty if qty > 0 else 0.0
        if base_asset:
            base_comm = sum(float(f.get("commission", 0)) for f in fills
                            if f.get("commissionAsset") == base_asset)
            qty = max(0.0, qty - base_comm)
        return qty, quote, avg
    # Fallback to top-level fields
    exec_qty = float(order.get("executedQty", 0) or 0)
    cum_quote = float(order.get("cummulativeQuoteQty", 0) or 0)
    avg = cum_quote / exec_qty if exec_qty > 0 else 0.0
    return exec_qty, cum_quote, avg


_LOT_STEP_CACHE: dict = {}


async def _get_lot_step(client, symbol: str) -> float:
    """Symbol ka LOT_SIZE step (e.g. FIL=0.01) — cached."""
    if symbol in _LOT_STEP_CACHE:
        return _LOT_STEP_CACHE[symbol]
    step = 0.000001
    try:
        info = await run_in_threadpool(client.get_symbol_info, symbol)
        for f in (info or {}).get("filters", []):
            if f.get("filterType") == "LOT_SIZE":
                step = float(f["stepSize"])
                break
    except Exception:
        pass
    _LOT_STEP_CACHE[symbol] = step
    return step


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


# ---------- Shared trade execution engine ----------
class _TradeError(Exception):
    def __init__(self, status_code: int, msg: str):
        self.status = status_code
        self.msg = msg
        super().__init__(msg)


async def _execute_kucoin_real(user_id, symbol, side, usdt_amount, quantity, source, bot, wallet, client, mode):
    """KuCoin live spot execution — mirrors the Binance real path, reads fills for avg price/qty."""
    ksym = _kucoin_symbol(symbol)
    base_asset = symbol.upper()[:-4]
    try:
        if side == "BUY":
            amount = usdt_amount or 0
            if amount <= 0:
                raise _TradeError(400, "usdt_amount required for BUY")
            accepted = await client.market_buy_funds(ksym, Decimal(str(round(amount, 2))))
            res = await client.execution(ksym, accepted["orderId"])
        else:
            qty = quantity or bot.get("position_qty", 0.0)
            if qty <= 0:
                raise _TradeError(400, "No position to sell")
            try:
                accs = await client.accounts(currency=base_asset, account_type="trade")
                free = float((accs[0].get("available") if accs else 0) or 0)
                if free > 0:
                    qty = min(qty, free)
            except Exception:
                pass
            try:
                rules = await client.symbol_rules(ksym)
                inc = Decimal(str(rules.get("baseIncrement", "0.00000001")))
                qty = float((Decimal(str(qty)) // inc) * inc)
            except Exception:
                pass
            if qty <= 0:
                raise _TradeError(400, "No sellable balance on KuCoin")
            accepted = await client.market_sell_size(ksym, Decimal(str(qty)))
            res = await client.execution(ksym, accepted["orderId"])
    except _TradeError:
        raise
    except KuCoinError as e:
        if str(e.code) == "400500":
            msg = f"KuCoin does not allow trading {base_asset} from this server's region. Please choose a different coin (e.g. BTC, ETH, XRP, SOL)."
        else:
            msg = f"KuCoin rejected order ({e.code}): {e.message}"
        logger.error(f"[kucoin trade] {symbol} {side}: {msg}")
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": {"last_trade_error": msg, "last_error_at": iso(now_utc())}})
        raise _TradeError(400, msg)
    except Exception as e:
        msg = f"KuCoin order failed: {e}"
        logger.error(f"[kucoin trade] {symbol} {side}: {msg}")
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": {"last_trade_error": msg, "last_error_at": iso(now_utc())}})
        raise _TradeError(400, msg)

    filled_qty, quote_spent, avg_price = res["filled_qty"], res["quote"], res["avg_price"]
    if filled_qty <= 0 or avg_price <= 0:
        oid = res.get("order_id")
        msg = f"KuCoin order {oid} placed but fill could not be read back — will retry"
        logger.error(f"[kucoin trade] {symbol} {side}: {msg} (res={res})")
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": {"last_trade_error": msg, "last_error_at": iso(now_utc())}})
        raise _TradeError(400, msg)

    if side == "BUY":
        new_qty = bot.get("position_qty", 0.0) + filled_qty
        new_amt = bot.get("position_amount", 0.0) + quote_spent
        new_avg = new_amt / new_qty if new_qty > 0 else 0.0
        new_wallet = max(0.0, wallet - quote_spent)
        new_mc = bot.get("margin_call_count", 0) + (1 if bot.get("position_amount", 0) > 0 else 0)
        rule = _get_margin_rule(bot, new_mc)
        next_buy = avg_price * (1 - rule["drop"] / 100.0)
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": {
            "position_amount": new_amt, "position_qty": new_qty, "avg_price": new_avg,
            "last_buy_price": avg_price, "next_buy_price": next_buy, "peak_price": 0.0,
            "dca_bottom_price": 0.0, "margin_call_count": new_mc}}, upsert=True)
        await db.users.update_one({"id": user_id}, {"$set": {"wallet_usdt": new_wallet}})
        profit = 0.0
    else:
        cost = filled_qty * bot.get("avg_price", 0.0)
        profit = quote_spent - cost
        remaining_qty = max(0.0, bot.get("position_qty", 0.0) - filled_qty)
        if remaining_qty < 1e-9:
            remaining_qty = 0.0
        remaining_amt = remaining_qty * bot.get("avg_price", 0.0)
        new_wallet = wallet + quote_spent
        update_set = {"position_qty": remaining_qty, "position_amount": remaining_amt,
                      "avg_price": bot.get("avg_price", 0.0) if remaining_qty > 0 else 0.0}
        if remaining_qty == 0:
            update_set.update({"margin_call_count": 0, "last_buy_price": 0.0, "next_buy_price": 0.0,
                               "peak_price": 0.0, "dca_bottom_price": 0.0, "last_sell_price": avg_price,
                               "cycles_completed": bot.get("cycles_completed", 0) + 1})
            if bot.get("trade_method") == "One-Shot":
                update_set["status"] = "stopped"
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": update_set})
        await db.users.update_one({"id": user_id}, {"$set": {"wallet_usdt": new_wallet}})

    txn = {"id": str(uuid.uuid4()), "user_id": user_id, "symbol": symbol, "side": side,
           "price": avg_price, "quantity": filled_qty, "amount": quote_spent, "profit": profit,
           "mode": mode, "source": source, "exchange": "kucoin",
           "binance_order_id": res.get("order_id"), "binance_status": res.get("status"),
           "created_at": res.get("ts") or iso(now_utc())}
    await db.transactions.insert_one(txn)
    if side == "SELL" and profit > 0 and source not in ("bot_stop", "fresh_start"):
        await _charge_trading_fee(user_id, profit, symbol)
    txn.pop("_id", None)
    return txn


async def _execute_lbank_real(user_id, symbol, side, usdt_amount, quantity, source, bot, wallet, client, mode):
    """LBank live spot execution — mirrors the KuCoin real path, reads fills for avg price/qty."""
    lsym = _lbank_symbol(symbol)
    base_asset = symbol.upper()[:-4]
    try:
        if side == "BUY":
            amount = usdt_amount or 0
            if amount <= 0:
                raise _TradeError(400, "usdt_amount required for BUY")
            accepted = await client.market_buy_quote(lsym, Decimal(str(round(amount, 2))))
            oid = (accepted.get("data") or {}).get("order_id") or (accepted.get("data") or {}).get("orderId")
            res = await client.execution(lsym, oid)
        else:
            qty = quantity or bot.get("position_qty", 0.0)
            if qty <= 0:
                raise _TradeError(400, "No position to sell")
            free = await client.free_balance(base_asset)
            if free > 0:
                qty = min(qty, free)
            acc = await client.accuracy(lsym)
            q = Decimal(str(qty))
            step = Decimal(1).scaleb(-acc)  # 10^-acc
            qty = float((q // step) * step)
            if qty <= 0:
                raise _TradeError(400, "No sellable balance on LBank")
            accepted = await client.market_sell_base(lsym, Decimal(str(qty)))
            oid = (accepted.get("data") or {}).get("order_id") or (accepted.get("data") or {}).get("orderId")
            res = await client.execution(lsym, oid)
    except _TradeError:
        raise
    except LBankError as e:
        hints = {
            "10008": "LBank disabled API trading (placing orders) for retail/individual accounts from October 2025 — it is now open only to institutional partners. That's why orders are rejected even when your keys, IP and permissions are correct. For live bots, please connect Binance or KuCoin; LBank will work for viewing balance only.",
            "10022": "LBank API permission/IP problem. Whitelist this server's IP on your LBank key and keep Spot Trading permission ON.",
            "10023": "LBank: market trading is not supported for this pair.",
            "10024": "LBank: your account is not allowed to trade this pair.",
            "10020": "LBank: order amount is below the minimum. Increase your first buy amount a little.",
            "10126": "LBank: minimum order amount not met. Increase the amount.",
            "10127": "LBank: quantity precision is incorrect.",
        }
        hint = hints.get(str(e.code))
        msg = f"LBank rejected order ({e.code}): {e.message}" + (f" — {hint}" if hint else "")
        logger.error(f"[lbank trade] {symbol} {side}: {msg}")
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": {"last_trade_error": msg, "last_error_at": iso(now_utc())}})
        raise _TradeError(400, msg)
    except Exception as e:
        msg = f"LBank order failed: {e}"
        logger.error(f"[lbank trade] {symbol} {side}: {msg}")
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": {"last_trade_error": msg, "last_error_at": iso(now_utc())}})
        raise _TradeError(400, msg)

    filled_qty, quote_spent, avg_price = res["filled_qty"], res["quote"], res["avg_price"]
    if filled_qty <= 0 or avg_price <= 0:
        msg = f"LBank order {res.get('order_id')} placed but fill could not be read back — will retry"
        logger.error(f"[lbank trade] {symbol} {side}: {msg} (res={res})")
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": {"last_trade_error": msg, "last_error_at": iso(now_utc())}})
        raise _TradeError(400, msg)

    if side == "BUY":
        new_qty = bot.get("position_qty", 0.0) + filled_qty
        new_amt = bot.get("position_amount", 0.0) + quote_spent
        new_avg = new_amt / new_qty if new_qty > 0 else 0.0
        new_wallet = max(0.0, wallet - quote_spent)
        new_mc = bot.get("margin_call_count", 0) + (1 if bot.get("position_amount", 0) > 0 else 0)
        rule = _get_margin_rule(bot, new_mc)
        next_buy = avg_price * (1 - rule["drop"] / 100.0)
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": {
            "position_amount": new_amt, "position_qty": new_qty, "avg_price": new_avg,
            "last_buy_price": avg_price, "next_buy_price": next_buy, "peak_price": 0.0,
            "dca_bottom_price": 0.0, "margin_call_count": new_mc}}, upsert=True)
        await db.users.update_one({"id": user_id}, {"$set": {"wallet_usdt": new_wallet}})
        profit = 0.0
    else:
        cost = filled_qty * bot.get("avg_price", 0.0)
        profit = quote_spent - cost
        remaining_qty = max(0.0, bot.get("position_qty", 0.0) - filled_qty)
        if remaining_qty < 1e-9:
            remaining_qty = 0.0
        remaining_amt = remaining_qty * bot.get("avg_price", 0.0)
        new_wallet = wallet + quote_spent
        update_set = {"position_qty": remaining_qty, "position_amount": remaining_amt,
                      "avg_price": bot.get("avg_price", 0.0) if remaining_qty > 0 else 0.0}
        if remaining_qty == 0:
            update_set.update({"margin_call_count": 0, "last_buy_price": 0.0, "next_buy_price": 0.0,
                               "peak_price": 0.0, "dca_bottom_price": 0.0, "last_sell_price": avg_price,
                               "cycles_completed": bot.get("cycles_completed", 0) + 1})
            if bot.get("trade_method") == "One-Shot":
                update_set["status"] = "stopped"
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": update_set})
        await db.users.update_one({"id": user_id}, {"$set": {"wallet_usdt": new_wallet}})

    txn = {"id": str(uuid.uuid4()), "user_id": user_id, "symbol": symbol, "side": side,
           "price": avg_price, "quantity": filled_qty, "amount": quote_spent, "profit": profit,
           "mode": mode, "source": source, "exchange": "lbank",
           "binance_order_id": res.get("order_id"), "binance_status": res.get("status"),
           "created_at": res.get("ts") or iso(now_utc())}
    await db.transactions.insert_one(txn)
    if side == "SELL" and profit > 0 and source not in ("bot_stop", "fresh_start"):
        await _charge_trading_fee(user_id, profit, symbol)
    txn.pop("_id", None)
    return txn


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
        "exchange": "binance",
    }

    # Resolve the user's ACTUAL connected exchange at execution time (one exchange per
    # account). bot.exchange is frozen at creation and can be stale (e.g. bot made before
    # the user bound LBank), so we trust the live bind records and self-heal the bot doc.
    if await db.lbank_keys.find_one({"user_id": user_id}, {"_id": 1}):
        conn_ex = "lbank"
    elif await db.kucoin_keys.find_one({"user_id": user_id}, {"_id": 1}):
        conn_ex = "kucoin"
    elif await db.binance_keys.find_one({"user_id": user_id}, {"_id": 1}):
        conn_ex = "binance"
    else:
        conn_ex = None
    if conn_ex and bot.get("exchange") != conn_ex:
        bot["exchange"] = conn_ex
        await db.bots.update_one({"user_id": user_id, "symbol": symbol}, {"$set": {"exchange": conn_ex}})

    # Route to KuCoin live engine when this bot is a KuCoin bot with real keys.
    if bot.get("exchange") == "kucoin":
        kc, kmode = await get_user_kucoin(user_id)
        if kc and kmode == "real":
            return await _execute_kucoin_real(user_id, symbol, side, usdt_amount, quantity, source, bot, wallet, kc, kmode)
        client, mode = None, "demo"  # KuCoin demo -> shared simulation below

    # Route to LBank live engine when this bot is an LBank bot with real keys.
    if bot.get("exchange") == "lbank":
        lb, lmode = await get_user_lbank(user_id)
        if lb and lmode == "real":
            return await _execute_lbank_real(user_id, symbol, side, usdt_amount, quantity, source, bot, wallet, lb, lmode)
        client, mode = None, "demo"  # LBank demo -> shared simulation below

    # ----- LIVE (real / testnet) -----
    if client and mode in ("real", "testnet"):
        base_asset = symbol.replace("USDT", "")
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
                # Binance ka ACTUAL free balance se clamp (fee ki wajah se tracked > held ho sakta hai)
                try:
                    bal = await run_in_threadpool(client.get_asset_balance, asset=base_asset)
                    free = float((bal or {}).get("free", 0) or 0)
                    if free > 0:
                        qty = min(qty, free)
                except Exception:
                    pass
                # LOT_SIZE step par floor (warna invalid quantity reject)
                step = await _get_lot_step(client, symbol)
                if step > 0:
                    qty = math.floor(qty / step + 1e-9) * step
                if qty <= 0:
                    raise _TradeError(400, "No sellable balance on Binance")
                order = await run_in_threadpool(
                    client.order_market_sell, symbol=symbol, quantity=float(f"{qty:.8f}"),
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

        filled_qty, quote_spent, avg_price = _parse_fill(order, base_asset if side == "BUY" else "")
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
            # Dust (fee/lot-step ka bacha tracked amount) ko 0 mano — warna cycle reset nahi hota
            step = _LOT_STEP_CACHE.get(symbol, 0.000001)
            if remaining_qty < max(step, 0.000001) * 1.05:
                remaining_qty = 0.0
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
                    "peak_price": 0.0,
                    "dca_bottom_price": 0.0,
                    "last_sell_price": avg_price,
                    "cycles_completed": bot.get("cycles_completed", 0) + 1,
                })
                # Only halt after cycle for explicit One-Shot bots. If trade_method
                # is missing/None we default to Cycle behaviour (safer).
                if bot.get("trade_method") == "One-Shot":
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
            if profit > 0 and source not in ("bot_stop", "fresh_start"):
                await _charge_trading_fee(user_id, profit, symbol)
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
        avg = float(bot.get("avg_price", 0.0) or 0.0)
        # Safety: refuse to sell if the bot doc has a corrupt/zero avg price.
        # Otherwise `profit = proceeds - qty*0` would spike ROI to ~∞%.
        if avg <= 0:
            raise _TradeError(400, "Bot has no valid average price — refresh or restart the bot")
        proceeds = qty * price
        cost = qty * avg
        profit = proceeds - cost
        remaining_qty = bot.get("position_qty", 0.0) - qty
        remaining_amt = remaining_qty * avg
        new_wallet = wallet + proceeds
        reset = remaining_qty == 0
        update_set = {
            "position_qty": remaining_qty,
            "position_amount": remaining_amt,
            "avg_price": avg if remaining_qty > 0 else 0.0,
        }
        if reset:
            update_set.update({
                "margin_call_count": 0,
                "last_buy_price": 0.0,
                "next_buy_price": 0.0,
                "peak_price": 0.0,
                "dca_bottom_price": 0.0,
                "last_sell_price": price,
                "sub_positions": [],
                "cycles_completed": bot.get("cycles_completed", 0) + 1,
            })
            # Only halt after cycle for explicit One-Shot bots. If trade_method
            # is missing/None we default to Cycle behaviour (safer).
            if bot.get("trade_method") == "One-Shot":
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
    txn.pop("_id", None)
    if side == "SELL":
        # Fuel sirf profit-book (TP/manual) par — stop/fresh-start close par NAHI (double-fee complaint fix)
        if profit > 0 and source not in ("bot_stop", "fresh_start"):
            await _charge_trading_fee(user_id, profit, symbol)
    return txn


# ---------- Bot Engine (background trader) ----------
async def _has_connected_exchange(user_id: str) -> bool:
    """True only if the user has bound an exchange (Binance, KuCoin or LBank).
    No exchange connected → bot must NOT trade (demo included)."""
    if await db.binance_keys.find_one({"user_id": user_id}, {"_id": 1}):
        return True
    if await db.kucoin_keys.find_one({"user_id": user_id}, {"_id": 1}):
        return True
    if await db.lbank_keys.find_one({"user_id": user_id}, {"_id": 1}):
        return True
    return False


async def _bot_tick(bot: dict):
    """Evaluate a single running bot: place first buy, DCA (margin call),
    or take-profit sell based on the strategy. Records events in bot_events."""
    user_id = bot["user_id"]
    symbol = bot["symbol"]

    # No exchange connected → do NOT trade. Auto-stop so it stays idle until the
    # user binds Binance/KuCoin.
    if not await _has_connected_exchange(user_id):
        await db.bots.update_one(
            {"user_id": user_id, "symbol": symbol},
            {"$set": {"status": "idle", "stop_reason": "no_exchange"}})
        return

    try:
        price = await fetch_price(symbol)
    except Exception as e:
        logger.warning(f"bot {symbol}: price fetch failed: {e}")
        return

    position_qty = float(bot.get("position_qty", 0.0) or 0)
    # Fuel gate: at $0 fuel the bot HOLDS — it will NOT sell (even if target hits)
    # until the user tops up. Buying/DCA and position-holding continue as normal.
    _bw = await _get_or_create_bot_wallet(user_id)
    can_sell = float(_bw.get("balance", 0.0) or 0.0) > 0
    avg_price = float(bot.get("avg_price", 0.0) or 0)
    first_buy = float(bot.get("first_buy_amount", 20.0) or 20.0)
    mc_count = int(bot.get("margin_call_count", 0) or 0)
    mc_limit = int(bot.get("margin_call_limit", 10) or 10)
    sub_positions = list(bot.get("sub_positions") or [])
    tp_ratio = float(bot.get("whole_take_profit_ratio", 1.5) or 1.5)
    tp_callback = float(bot.get("whole_take_profit_callback", 0.3) or 0.3)
    dca_callback = float(bot.get("buy_in_callback", 0.25) or 0.25)
    next_buy = float(bot.get("next_buy_price", 0.0) or 0)
    peak = float(bot.get("peak_price", 0.0) or 0)
    trough = float(bot.get("dca_bottom_price", 0.0) or 0)

    # === FIRST BUY (HiTechBot style — immediate re-entry after SELL) ===
    # DCA safety orders below handle the averaging, so we don't wait for
    # a pullback before entering the next cycle. Bot always stays in market.
    if position_qty == 0:
        try:
            await _execute_trade(
                user_id=user_id, symbol=symbol, side="BUY",
                usdt_amount=first_buy, source="bot",
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

    # === SUB-POSITION TAKE PROFIT (calls 5+) ===
    # Har sub-position apne tp_price (pichhle call ka average price) par
    # principal + profit ke saath exit hoti hai.
    if sub_positions and position_qty > 0 and can_sell:
        remaining_subs = []
        sold_any = False
        for sp in sub_positions:
            sp_tp = float(sp.get("tp_price", 0) or 0)
            sp_qty = float(sp.get("qty", 0) or 0)
            if sp_tp > 0 and sp_qty > 0 and price >= sp_tp:
                try:
                    await _execute_trade(
                        user_id=user_id, symbol=symbol, side="SELL",
                        quantity=min(sp_qty, position_qty), source="bot",
                    )
                    position_qty = max(0.0, position_qty - sp_qty)
                    sold_any = True
                    await db.bot_events.insert_one({
                        "id": str(uuid.uuid4()), "user_id": user_id, "symbol": symbol,
                        "kind": "sub_position_tp", "call": sp.get("call"),
                        "qty": sp_qty, "buy_price": sp.get("buy_price"),
                        "tp_price": sp_tp, "price": price,
                        "created_at": iso(now_utc()),
                    })
                    logger.info(
                        f"bot {symbol}: SUB-POSITION TP C{sp.get('call')} sold {sp_qty} "
                        f"at {price} (target {sp_tp})")
                except _TradeError as e:
                    logger.warning(f"bot {symbol}: sub TP sell failed: {e.msg}")
                    remaining_subs.append(sp)
            else:
                remaining_subs.append(sp)
        if sold_any:
            await db.bots.update_one(
                {"user_id": user_id, "symbol": symbol},
                {"$set": {"sub_positions": remaining_subs}})
            sub_positions = remaining_subs
            if position_qty <= 0:
                return

    # === TAKE PROFIT (trailing) ===
    # Peak arms once price crosses the TP target. After arming, the trailing
    # pullback sell stays ACTIVE even if price falls back below the target —
    # so a spike to +1.6% followed by a drop still books profit (e.g. at +1.3%).
    tp_trigger = avg_price * (1 + tp_ratio / 100.0)
    if price >= tp_trigger and price > peak:
        await db.bots.update_one(
            {"user_id": user_id, "symbol": symbol},
            {"$set": {"peak_price": price}},
        )
        peak = price
    if peak > 0:
        pullback_trigger = peak * (1 - tp_callback / 100.0)
        if price <= pullback_trigger and price > avg_price and can_sell:
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
                # ONE SHOT mode: profit book hote hi bot ruk jata hai — re-buy nahi.
                # Mode One-Shot hi rehta hai (permanent) taaki restart par dobara set na karna pade.
                if _is_oneshot(bot):
                    await db.bots.update_one(
                        {"user_id": user_id, "symbol": symbol},
                        {"$set": {"status": "stopped", "trade_mode": "oneshot", "trade_method": "One-Shot",
                                  "stopped_at": iso(now_utc())}})
                    await db.bot_events.insert_one({
                        "id": str(uuid.uuid4()), "user_id": user_id, "symbol": symbol,
                        "kind": "oneshot_complete", "created_at": iso(now_utc()),
                    })
                    logger.info(f"bot {symbol}: ONE SHOT complete — bot stopped, no re-buy")
            except _TradeError as e:
                logger.warning(f"bot {symbol}: TP sell failed: {e.msg}")
            return
        if price <= avg_price:
            # Crashed below entry — disarm TP so DCA logic can take over below
            await db.bots.update_one(
                {"user_id": user_id, "symbol": symbol},
                {"$set": {"peak_price": 0.0}},
            )
            peak = 0.0
        else:
            return  # armed — holding, waiting for pullback to hit

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
                call_num = mc_count + 1  # is safety order ka call number (C1, C2 ...)
                prev_avg = avg_price  # is call se PEHLE ka average price
                try:
                    txn = await _execute_trade(
                        user_id=user_id, symbol=symbol, side="BUY",
                        usdt_amount=amount, source="bot",
                    )
                    # SUB-POSITION MODE: Call 5 se aage har buy alag sub-position
                    # hai jiska TP = pichhle call ka average price.
                    if call_num >= SUB_POSITION_START and prev_avg > 0:
                        sub = {
                            "id": str(uuid.uuid4()), "call": call_num,
                            "qty": float(txn.get("quantity", 0)),
                            "buy_price": float(txn.get("price", price)),
                            "amount": amount, "tp_price": round(prev_avg, 6),
                            "created_at": iso(now_utc()),
                        }
                        await db.bots.update_one(
                            {"user_id": user_id, "symbol": symbol},
                            {"$push": {"sub_positions": sub}})
                        logger.info(
                            f"bot {symbol}: SUB-POSITION C{call_num} opened "
                            f"qty={sub['qty']} tp={sub['tp_price']} (prev avg)")
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
_royalty_task = None


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
@api.get("/revenue/income")
async def revenue_income(user: dict = Depends(get_current_user)):
    uid = user["id"]
    kinds = ["team_commission", "direct_bonus", "activation_difference", "support_income", "social_bonus", "royalty_income", "bonanza"]
    txns = await db.bot_transactions.find(
        {"user_id": uid, "kind": {"$in": kinds}, "amount": {"$gt": 0}},
        {"_id": 0}).sort("created_at", -1).to_list(3000)
    sells = await db.transactions.find(
        {"user_id": uid, "side": "SELL"},
        {"_id": 0, "id": 1, "profit": 1, "created_at": 1, "symbol": 1,
         "quantity": 1, "amount": 1, "binance_order_id": 1, "binance_status": 1, "exchange": 1}).sort("created_at", -1).to_list(3000)

    def cat_of(t):
        k = t["kind"]
        if k == "direct_bonus":
            return "direct_income", None
        if k == "activation_difference":
            return "bot_difference", None
        if k in ("support_income", "social_bonus"):
            return "support_income", None
        if k == "bonanza":
            return "bonanza", None
        if k == "royalty_income":
            # "Daily royalty - Level 2 - Activation pool" → Global Royalty Level 2
            m = re.search(r"Level\s*(\d+)", t.get("note") or "")
            lvl = min(int(m.group(1)), 10) if m else None
            return "royalty_income", lvl
        if k == "team_commission":  # team's trading commission (level/rank wise)
            m = re.search(r"· L(\d+)$", t.get("note") or "")
            lvl = min(int(m.group(1)) if m else 1, 10)
            return "trading_commission", lvl
        return "other", None

    history = []
    for t in txns:
        c, lvl = cat_of(t)
        history.append({"id": t["id"], "category": c, "level": lvl, "amount": t["amount"],
                        "created_at": t["created_at"], "note": t.get("note", "")})
    for s in sells:
        p = float(s.get("profit") or 0.0)
        if p <= 0:
            continue
        history.append({"id": s.get("id") or s["created_at"], "category": "trading_profit",
                        "level": None, "amount": round(p, 4), "created_at": s["created_at"],
                        "note": s.get("symbol", ""),
                        "trade": {
                            "symbol": s.get("symbol", ""),
                            "order_id": s.get("binance_order_id") or s.get("id", ""),
                            "quantity": s.get("quantity"),
                            "deal_amount": s.get("amount"),
                            "exchange": s.get("exchange", "binance"),
                            "status": "Completed",
                        }})
    history.sort(key=lambda x: x["created_at"] or "", reverse=True)

    today_str = ist_today()
    cats, trend = {}, {}
    all_today = all_total = 0.0
    for h in history:
        d = ist_date(h["created_at"])
        is_today = d == today_str
        all_total += h["amount"]
        if is_today:
            all_today += h["amount"]
        buckets = [h["category"]]
        if h.get("level"):
            buckets.append(f"global_{h['level']}")
        for b in buckets:
            cc = cats.setdefault(b, {"today": 0.0, "total": 0.0})
            cc["total"] += h["amount"]
            if is_today:
                cc["today"] += h["amount"]
        trend[d] = trend.get(d, 0.0) + h["amount"]

    days = [((now_utc() + IST_OFFSET) - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(29, -1, -1)]
    return {
        "all": {"today": round(all_today, 4), "total": round(all_total, 4)},
        "categories": {k: {"today": round(v["today"], 4), "total": round(v["total"], 4)}
                       for k, v in cats.items()},
        "trend": [{"date": d, "total": round(trend.get(d, 0.0), 4)} for d in days],
        "history": history[:400],
    }


@api.get("/revenue/summary")
async def revenue_summary(user: dict = Depends(get_current_user)):
    rows = await db.transactions.find(
        {"user_id": user["id"], "side": "SELL"}, {"_id": 0, "profit": 1, "created_at": 1, "symbol": 1}
    ).to_list(1000)
    total = sum(r.get("profit", 0.0) for r in rows)

    # last 14 days by date + today's total (IST daily boundary)
    today_str = ist_today()
    by_day = {}
    by_day_count = {}
    by_day_symbols = {}
    today_profit = 0.0
    today_trades = 0
    for r in rows:
        try:
            d = ist_date(r["created_at"])
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
    today_str = ist_today()
    today = sum(r.get("profit", 0.0) for r in sells if ist_date(r.get("created_at")) == today_str)
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
    open_bots = [b for b in bots if b.get("position_qty", 0) > 0]

    async def _price_of(b):
        try:
            return await fetch_price_cached(b["symbol"])
        except Exception:
            return b.get("avg_price", 0.0)

    prices = await asyncio.gather(*[_price_of(b) for b in open_bots])
    for b, price in zip(open_bots, prices):
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

    # Determine which wallet balance to show as the "spot" cash portion.
    # In real/testnet mode we prefer the live Binance USDT balance; if Binance is
    # unreachable we report 0 (with `wallet_error`) instead of leaking the demo
    # balance, so the UI doesn't mislead the user about their real funds.
    demo_balance = float(user.get("wallet_usdt", 0.0))
    _, mode = await get_user_binance(user["id"])
    wallet_mode = mode if mode in ("real", "testnet") else "demo"
    # ---- Asset page ka balance HAMESHA Trade Skill bot-wallet hota hai.
    # Binance ka fund yahan kabhi add nahi hota (user request) — wo sirf
    # Trade page ke exchange card par dikhta hai.
    bw = await _get_or_create_bot_wallet(user["id"])
    unified = round(float(bw.get("balance", 0.0) or 0.0), 4)
    wallet_usdt = unified
    total = unified
    return {
        "wallet_usdt": round(wallet_usdt, 4),
        "positions_value_usdt": round(positions_value, 4),
        "total_usdt": total,
        "bot_wallet_balance": unified,
        "positions": positions,
        "wallet_mode": wallet_mode,
        "wallet_connected": wallet_mode != "demo",
        "wallet_error": None,
        "demo_wallet_usdt": round(demo_balance, 4),
        "fuel_balance": unified,
        "fuel_low": unified < BOT_FUEL_WARN_BALANCE,
        "fuel_empty": unified <= 0,
        "fuel_warn_threshold": BOT_FUEL_WARN_BALANCE,
    }


@api.get("/wallet/spot")
async def wallet_spot(user: dict = Depends(get_current_user)):
    """Returns the user's spot USDT balance from whichever exchange is bound
    (LBank / KuCoin / Binance). No API bound → demo wallet balance.
    Response includes an `exchange` field so the UI can label it correctly."""
    uid = user["id"]
    demo_balance = round(float(user.get("wallet_usdt", 0.0)), 4)

    # LBank
    lb, lmode = await get_user_lbank(uid)
    if lb and lmode == "real":
        try:
            usdt = await lb.free_balance("usdt")
            return {"exchange": "lbank", "mode": lmode, "connected": True, "usdt_balance": round(usdt, 4)}
        except Exception as e:
            logger.warning(f"wallet/spot lbank fetch failed for {uid}: {e}")
            return {"exchange": "lbank", "mode": lmode, "connected": False, "usdt_balance": 0.0,
                    "error": f"LBank connection failed: {str(e)[:120]}"}

    # KuCoin
    kc, kmode = await get_user_kucoin(uid)
    if kc and kmode == "real":
        try:
            accts = await kc.accounts(account_type="trade")
            usdt = next((float(b.get("available", 0) or 0) for b in (accts or []) if b.get("currency") == "USDT"), 0.0)
            return {"exchange": "kucoin", "mode": kmode, "connected": True, "usdt_balance": round(usdt, 4)}
        except Exception as e:
            logger.warning(f"wallet/spot kucoin fetch failed for {uid}: {e}")
            return {"exchange": "kucoin", "mode": kmode, "connected": False, "usdt_balance": 0.0,
                    "error": f"KuCoin connection failed: {str(e)[:120]}"}

    # Binance
    client, mode = await get_user_binance(uid)
    if not client:
        return {"exchange": "binance", "mode": "demo", "connected": False, "usdt_balance": demo_balance}
    try:
        data = await run_in_threadpool(client.get_account)
        usdt = 0.0
        for b in data.get("balances", []):
            if b.get("asset") == "USDT":
                usdt = float(b.get("free", 0))
                break
        return {"exchange": "binance", "mode": mode, "connected": True, "usdt_balance": round(usdt, 4)}
    except Exception as e:
        msg = str(e)
        logger.warning(f"wallet/spot binance fetch failed for {uid}: {msg}")
        friendly = (
            "Binance is unreachable from this server region (geo-restriction). "
            "Your funds are safe in Binance — we just cannot read the balance from here. "
            "Switch mode to Demo, or deploy to a supported region."
            if "restricted location" in msg.lower() or "eligibility" in msg.lower()
            else f"Binance connection failed: {msg[:120]}"
        )
        return {"exchange": "binance", "mode": mode, "connected": False, "usdt_balance": 0.0, "error": friendly}


# ==== Referral ====
@api.get("/referral")
async def referral(user: dict = Depends(get_current_user)):
    directs = await db.users.find(
        {"referred_by": user["id"]},
        {"_id": 0, "id": 1, "email": 1, "name": 1, "rank": 1, "created_at": 1, "activated": 1},
    ).to_list(500)

    # BFS whole team (UNLIMITED levels; 100k-user safety cap), attributing each member to their root direct
    root_of = {d["id"]: d["id"] for d in directs}
    seen = {user["id"], *root_of.keys()}
    frontier = list(root_of.keys())
    team_total = len(directs)
    team_activated = sum(1 for d in directs if d.get("activated"))
    subtree = {d["id"]: 0 for d in directs}
    while frontier and len(seen) <= 100000:
        rows = await db.users.find(
            {"referred_by": {"$in": frontier}},
            {"_id": 0, "id": 1, "referred_by": 1, "activated": 1},
        ).to_list(5000)
        nxt = []
        for r in rows:
            if r["id"] in seen:
                continue
            seen.add(r["id"])
            nxt.append(r["id"])
            root = root_of.get(r["referred_by"])
            if root:
                root_of[r["id"]] = root
                subtree[root] += 1
            team_total += 1
            if r.get("activated"):
                team_activated += 1
        frontier = nxt

    earnings = await db.rewards.find({"user_id": user["id"], "type": "referral"}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total_earned = sum(e.get("amount", 0) for e in earnings if e.get("status") == "claimed")
    pending = sum(e.get("amount", 0) for e in earnings if e.get("status") == "claimable")
    today = ist_today()
    today_profit = sum(e.get("amount", 0) for e in earnings if ist_date(e.get("created_at")) == today)
    total_profit = sum(e.get("amount", 0) for e in earnings)

    direct_activated = sum(1 for d in directs if d.get("activated"))
    team = [
        {
            "email": d["email"],
            "name": d.get("name"),
            "rank": d.get("rank", "Level 1"),
            "activated": bool(d.get("activated")),
            "created_at": d.get("created_at"),
            "team_size": subtree.get(d["id"], 0),
        }
        for d in directs
    ]
    return {
        "referral_code": user.get("referral_code"),
        "team_size": len(directs),
        "team": team,
        "total_earned": round(total_earned, 4),
        "pending": round(pending, 4),
        "earnings": earnings,
        "today_profit": round(today_profit, 4),
        "total_profit": round(total_profit, 4),
        "direct_stats": {"activated": direct_activated, "not_activated": len(directs) - direct_activated},
        "team_stats": {
            "total": team_total,
            "activated": team_activated,
            "not_activated": team_total - team_activated,
        },
    }


@api.get("/referral/team-by-rank")
async def referral_team_by_rank(user: dict = Depends(get_current_user)):
    """Whole downline (unlimited levels) grouped by rank V1..V10. Each member
    carries name, activation, rank, joining date and their own total team size."""
    members: dict = {}   # id -> user doc
    parent: dict = {}    # id -> referred_by
    depth_of: dict = {}  # id -> genealogy depth below the logged-in user (direct = 1)
    seen = {user["id"]}
    frontier = [user["id"]]
    CAP = 50000
    depth = 0
    while frontier and len(seen) <= CAP:
        depth += 1
        rows = await db.users.find(
            {"referred_by": {"$in": frontier}},
            {"_id": 0, "id": 1, "email": 1, "name": 1, "rank": 1,
             "created_at": 1, "activated": 1, "referred_by": 1},
        ).to_list(5000)
        nxt = []
        for r in rows:
            if r["id"] in seen:
                continue
            seen.add(r["id"])
            nxt.append(r["id"])
            members[r["id"]] = r
            parent[r["id"]] = r.get("referred_by")
            depth_of[r["id"]] = depth
        frontier = nxt

    # Each member's own subtree size: walk ancestors, +1 for every upline in team
    subtree = {mid: 0 for mid in members}
    for mid in members:
        p = parent.get(mid)
        hops = 0
        while p and p != user["id"] and p in subtree and hops <= CAP:
            subtree[p] += 1
            p = parent.get(p)
            hops += 1

    by_level: dict = {i: [] for i in range(1, 11)}
    for mid, d in members.items():
        lvl = _rank_level_of(d)
        by_level.setdefault(lvl, []).append({
            "email": d.get("email", ""),
            "name": d.get("name"),
            "rank": d.get("rank", "LEVEL 1"),
            "activated": bool(d.get("activated")),
            "created_at": d.get("created_at"),
            "team_size": subtree.get(mid, 0),
            "depth": depth_of.get(mid, 0),
        })
    for i in by_level:
        by_level[i].sort(key=lambda m: m.get("created_at") or "", reverse=True)

    ranks = [{"level": i, "count": len(by_level.get(i, []))} for i in range(1, 11)]
    return {
        "ranks": ranks,
        "members_by_level": {str(i): by_level.get(i, []) for i in range(1, 11)},
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
    return {"app": "Trade Skill", "status": "ok"}


# ==== Rank endpoints ====
@api.get("/ranks/config")
async def ranks_config():
    """Public list of all rank tiers (used by the /rank page)."""
    prev_direct = 0.0
    prev_pct = 0.0
    out = []
    for r in RANKS:
        lvl = int(r["level"])
        d = dict(r)
        d["trading_royalty_pct"] = TRADING_ROYALTY_BY_LEVEL.get(lvl, 0.0)
        d["activation_pool_usd"] = ACTIVATION_ROYALTY_PER_LEVEL if lvl in ACTIVATION_ROYALTY_LEVELS else 0.0
        d["bot_difference_usd"] = round(float(r["direct_income"]) - prev_direct, 2)
        d["commission_difference_pct"] = round(float(r["commission_pct"]) - prev_pct, 2)
        out.append(d)
        prev_direct = float(r["direct_income"])
        prev_pct = float(r["commission_pct"])
    return {"ranks": out}


async def _pool_levels(kind: str) -> list:
    rows = await db.company_ledger.aggregate([
        {"$match": {"kind": kind}},
        {"$group": {"_id": "$level", "total": {"$sum": "$amount"}}},
    ]).to_list(20)
    m = {r["_id"]: r["total"] for r in rows}
    paid = await db.royalty_distributions.aggregate([
        {"$match": {"pool_kind": kind}},
        {"$group": {"_id": "$level", "total": {"$sum": "$total"}}},
    ]).to_list(20)
    pm = {r["_id"]: r["total"] for r in paid}
    return [{"level": lvl, "balance": round(float(m.get(lvl, 0.0)) - float(pm.get(lvl, 0.0)), 4)}
            for lvl in range(2, 11)]


async def _run_royalty_distribution(date_str: str):
    """Daily royalty pool close at 00:00 UTC. Each level's pool balance is split
    equally among activated users of that level; unclaimed levels sweep to
    company reserve so ALL pools reset to $0 at every cutoff."""
    existing = await db.royalty_closes.find_one_and_update(
        {"date": date_str},
        {"$setOnInsert": {"date": date_str, "status": "running", "created_at": iso(now_utc())}},
        upsert=True)
    if existing is not None:
        return
    logger.info(f"royalty close {date_str}: distributing pools (00:00 UTC cutoff)")
    for kind in ("activation_royalty", "trading_royalty"):
        pool_label = "Activation" if kind == "activation_royalty" else "Trading"
        for row in await _pool_levels(kind):
            lvl, balance = row["level"], row["balance"]
            if balance < 0.0001:
                continue
            users = await db.users.find({"rank": f"Level {lvl}"}, {"_id": 0, "id": 1}).to_list(200000)
            qualified = []
            for u in users:
                w = await db.bot_wallets.find_one({"user_id": u["id"]}, {"activated": 1})
                if w and w.get("activated"):
                    qualified.append(u["id"])
            per_user = math.floor(balance / len(qualified) * 10000) / 10000.0 if qualified else 0.0
            paid = 0.0
            if per_user > 0:
                for uid in qualified:
                    await _credit_commission(uid, per_user, "royalty_income",
                                             f"Daily royalty · Level {lvl} · {pool_label} pool · {date_str}",
                                             from_user_id="system")
                paid = round(per_user * len(qualified), 4)
            # Pool MUST be fully empty after cutoff: unpaid remainder (no users
            # at this level, or rounding dust) sweeps to company reserve.
            leftover = round(balance - paid, 6)
            if leftover > 0:
                await _credit_admin_revenue(leftover, "royalty_reserve", "system",
                                            note=f"Unclaimed {pool_label} royalty · Level {lvl} · {date_str}")
            await db.royalty_distributions.insert_one({
                "id": str(uuid.uuid4()), "date": date_str, "pool_kind": kind, "level": lvl,
                "total": round(balance, 6), "per_user": per_user,
                "user_count": len(qualified), "paid": paid, "reserve": leftover,
                "created_at": iso(now_utc()),
            })
            logger.info(f"royalty close {date_str}: {pool_label} L{lvl} paid ${paid} to {len(qualified)} users, reserve ${leftover} — pool emptied")
    await db.royalty_closes.update_one({"date": date_str},
                                       {"$set": {"status": "done", "finished_at": iso(now_utc())}})


async def royalty_close_loop():
    """Auto-runs the daily close at 00:00 UTC — no manual action. All math in UTC."""
    while True:
        try:
            date_str = now_utc().strftime("%Y-%m-%d")
            if not await db.royalty_closes.find_one({"date": date_str}):
                await _run_royalty_distribution(date_str)
        except Exception as e:
            logger.warning(f"royalty close loop: {e}")
        await asyncio.sleep(60)


@api.get("/pool/summary")
async def pool_summary(user: dict = Depends(get_current_user)):
    """Main Pool card: Bot Activation Royalty Pool + Trading Royalty Pool (level-wise)."""
    activation = await _pool_levels("activation_royalty")
    trading = await _pool_levels("trading_royalty")
    next_cutoff = (now_utc() + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    last = await db.royalty_distributions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1)
    return {
        "activation_pool": activation,
        "trading_pool": trading,
        "activation_total": round(sum(x["balance"] for x in activation), 4),
        "trading_total": round(sum(x["balance"] for x in trading), 4),
        "cutoff_utc": "00:00 UTC",
        "next_cutoff_at": iso(next_cutoff),
        "last_distribution": last[0] if last else None,
    }


@api.get("/ranks/me")
async def ranks_me(user: dict = Depends(get_current_user)):
    """Return user's current rank, team stats and progress to next rank."""
    stats = await _compute_team_stats(user["id"])
    current_title = (user.get("rank") or "Level 1").upper()

    current_level = 1
    for rk in RANKS:
        if rk["title"] == current_title:
            current_level = rk["level"]
            break

    # Auto-promote: pick highest rank the user qualifies for.
    best_level = 1
    for rk in RANKS:
        if _rank_qualifies(stats, rk):
            best_level = rk["level"]

    if best_level != current_level:
        new_title = next(r["title"] for r in RANKS if r["level"] == best_level).title()
        await db.users.update_one({"id": user["id"]}, {"$set": {"rank": new_title}})
        current_level = best_level

    next_rank = next((r for r in RANKS if r["level"] == current_level + 1), None)
    progress = None
    if next_rank:
        progress = {
            "direct_needed": next_rank["direct_users"],
            "direct_have": stats["direct_count"],
            "team_needed": next_rank["team_size"],
            "team_have": stats["total_team"],
            "downline_requirement": next_rank.get("downline_requirement"),
            "downline_have": sum(
                v for lvl, v in stats["downline_ranks"].items()
                if next_rank.get("downline_requirement")
                and lvl >= next_rank["downline_requirement"]["min_level"]
            ),
        }
    return {
        "current_level": current_level,
        "current_title": RANKS[current_level - 1]["title"],
        "stats": stats,
        "next_rank": next_rank,
        "progress": progress,
    }


# ==== Bot Wallet (Monetization) ====
async def _credit_admin_revenue(amount: float, kind: str, from_user_id: str,
                                note: str = "", symbol: Optional[str] = None) -> Optional[str]:
    """Credit platform revenue (activation fee, trading fees) to the admin
    user's main wallet. Returns the admin user_id or None if no admin exists."""
    if amount <= 0:
        return None
    admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "id": 1})
    if not admin:
        return None
    admin_id = admin["id"]
    if admin_id == from_user_id:
        # Self-transfer (admin activating own bot) — net zero, skip.
        return admin_id
    await _get_or_create_bot_wallet(admin_id)
    res = await db.bot_wallets.find_one_and_update(
        {"user_id": admin_id}, {"$inc": {"balance": round(amount, 4)}},
        return_document=True)
    await _log_bot_txn(admin_id, "revenue", round(amount, 4),
                       note=note or kind, symbol=symbol,
                       balance_after=round(float(res.get("balance", 0.0) or 0.0), 4))
    await db.admin_revenue.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "from_user_id": from_user_id,
        "kind": kind,   # activation | trading_fee
        "amount": round(float(amount), 4),
        "symbol": symbol,
        "note": note,
        "created_at": iso(now_utc()),
    })
    return admin_id


async def _get_or_create_bot_wallet(user_id: str) -> dict:
    """Return the user's bot wallet document, creating a default if missing."""
    doc = await db.bot_wallets.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        doc = {
            "user_id": user_id,
            "balance": 0.0,
            "activated": False,
            "activated_at": None,
            "activation_fee_paid": 0.0,
            "total_fees_paid": 0.0,
            "deposit_address": BOT_WALLET_DEPOSIT_ADDRESS,
            "created_at": iso(now_utc()),
        }
        await db.bot_wallets.insert_one(dict(doc))
    return doc


async def _log_bot_txn(user_id: str, kind: str, amount: float, note: str = "",
                       symbol: Optional[str] = None, balance_after: Optional[float] = None):
    await db.bot_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "kind": kind,   # activation | deposit | withdraw | trading_fee | pause
        "amount": round(float(amount), 4),
        "note": note,
        "symbol": symbol,
        "balance_after": round(float(balance_after), 4) if balance_after is not None else None,
        "created_at": iso(now_utc()),
    })


def _rank_pct_of(user_doc) -> float:
    return RANK_PCT_BY_TITLE.get(((user_doc or {}).get("rank") or "").strip().upper(), 0.0)


def _rank_level_of(user_doc) -> int:
    title = ((user_doc or {}).get("rank") or "LEVEL 1").strip().upper()
    for r in RANKS:
        if r["title"].upper() == title:
            return int(r["level"])
    return 1


async def _genealogy_level(recipient_id: str, from_user_id: str, cache: dict) -> Optional[int]:
    """How many levels BELOW `recipient_id` the `from_user_id` sits (direct child = L1).
    Walks UP the sponsor line from from_user until recipient is reached."""
    cur = from_user_id
    seen = set()
    for hop in range(1, 101):
        if not cur or cur in seen:
            return None
        seen.add(cur)
        if cur not in cache:
            doc = await db.users.find_one({"id": cur}, {"_id": 0, "referred_by": 1})
            cache[cur] = (doc or {}).get("referred_by")
        parent = cache[cur]
        if parent == recipient_id:
            return hop
        cur = parent
    return None


async def _company_ledger(kind: str, amount: float, from_user_id: str, note: str = "", symbol: str = None, level: int = None):
    if amount <= 0:
        return
    await db.company_ledger.insert_one({
        "id": str(uuid.uuid4()), "kind": kind, "amount": round(amount, 6),
        "from_user_id": from_user_id, "note": note, "symbol": symbol,
        "level": level,
        "created_at": iso(now_utc()),
    })


async def _credit_commission(user_id: str, amount: float, kind: str, note: str,
                             from_user_id: str = None, symbol: str = None):
    """Credit an MLM earning to a user's Bot Wallet + reward record (shows on Referral page)."""
    if amount <= 0:
        return False
    w = await _get_or_create_bot_wallet(user_id)
    if not w.get("activated"):
        return False
    new_balance = round(float(w.get("balance", 0.0) or 0.0) + amount, 4)
    await db.bot_wallets.update_one({"user_id": user_id},
                                    {"$set": {"balance": new_balance},
                                     "$inc": {"total_commission_earned": round(amount, 4)}})
    await _log_bot_txn(user_id, kind, amount, note=note, symbol=symbol,
                       balance_after=new_balance)
    await db.rewards.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "type": "referral",
        "amount": round(amount, 4), "status": "claimed", "note": note,
        "from_user_id": from_user_id, "symbol": symbol, "created_at": iso(now_utc()),
    })
    return True


async def _get_bonanza_offer() -> dict:
    """Admin-editable offer config (DB) with the module default as fallback/seed."""
    doc = await db.bonanza_config.find_one({"key": "active"}, {"_id": 0, "key": 0})
    if not doc:
        doc = dict(BONANZA_OFFER)
        await db.bonanza_config.update_one(
            {"key": "active"}, {"$set": {**doc, "key": "active"}}, upsert=True)
    return doc


def _bonanza_reward_for(directs: int, offer: dict) -> tuple:
    """Highest achieved tier only → (reward, tier_directs)."""
    reward, tier_dirs = 0.0, 0
    for t in sorted(offer["tiers"], key=lambda x: x["directs"]):
        if directs >= t["directs"]:
            reward, tier_dirs = float(t["reward"]), int(t["directs"])
    return reward, tier_dirs


async def _bonanza_credit_user(user_id: str, directs: int, offer: dict) -> dict:
    """Idempotent one-time Bonanza credit → user's MAIN wallet + history.
    Returns {credited: bool, amount, reason}."""
    from pymongo import ReturnDocument
    from pymongo.errors import DuplicateKeyError
    reward, tier_dirs = _bonanza_reward_for(directs, offer)
    if reward <= 0:
        return {"credited": False, "amount": 0.0, "reason": "not_qualified"}
    try:
        await db.bonanza_claims.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "offer_id": offer["id"],
            "amount": round(reward, 4),
            "directs": directs,
            "tier_directs": tier_dirs,
            "created_at": iso(now_utc()),
        })
    except DuplicateKeyError:
        return {"credited": False, "amount": round(reward, 4), "reason": "already_claimed"}
    await _get_or_create_bot_wallet(user_id)
    res = await db.bot_wallets.find_one_and_update(
        {"user_id": user_id},
        {"$inc": {"balance": round(reward, 4)}},
        return_document=ReturnDocument.AFTER)
    new_bal = round(float(res.get("balance", 0.0) or 0.0), 4)
    note = f"Bonanza · {offer['title']} ({tier_dirs} direct IDs)"
    await _log_bot_txn(user_id, "bonanza", round(reward, 4), note=note, balance_after=new_bal)
    await db.rewards.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "type": "bonanza",
        "amount": round(reward, 4), "status": "claimed", "note": note,
        "created_at": iso(now_utc()),
    })
    return {"credited": True, "amount": round(reward, 4), "balance": new_bal}


async def _activated_direct_count(user_id: str) -> int:
    """Count direct referrals who have ACTIVATED A BOT (paid activation fee → bot_wallets.activated)."""
    direct_ids = [u["id"] async for u in db.users.find({"referred_by": user_id}, {"id": 1, "_id": 0})]
    if not direct_ids:
        return 0
    return await db.bot_wallets.count_documents({"user_id": {"$in": direct_ids}, "activated": True})


async def _bonanza_payout_sweep() -> dict:
    """Auto-credit every qualifying sponsor once the deadline passes (idempotent)."""
    offer = await _get_bonanza_offer()
    if now_utc() < datetime.fromisoformat(offer["deadline"]):
        return {"ran": False, "reason": "before_deadline", "credited": 0}
    min_dirs = min(t["directs"] for t in offer["tiers"])
    # Count sponsors by their BOT-ACTIVATED directs (bot_wallets.activated), not mere referrals.
    pipe = [
        {"$match": {"activated": True}},
        {"$lookup": {"from": "users", "localField": "user_id", "foreignField": "id", "as": "u"}},
        {"$unwind": "$u"},
        {"$match": {"u.referred_by": {"$ne": None}}},
        {"$group": {"_id": "$u.referred_by", "n": {"$sum": 1}}},
        {"$match": {"n": {"$gte": min_dirs}}},
    ]
    credited = 0
    async for row in db.bot_wallets.aggregate(pipe):
        res = await _bonanza_credit_user(row["_id"], int(row["n"]), offer)
        if res.get("credited"):
            credited += 1
    return {"ran": True, "credited": credited}


@api.get("/bonanza")
async def get_bonanza(user: dict = Depends(get_current_user)):
    offer = await _get_bonanza_offer()
    directs = await _activated_direct_count(user["id"])
    now = now_utc()
    ended = now >= datetime.fromisoformat(offer["deadline"])
    reward, tier_dirs = _bonanza_reward_for(directs, offer)
    # Lazy auto-credit: once the timer ends, credit instantly when the user opens the page.
    if ended and reward > 0:
        await _bonanza_credit_user(user["id"], directs, offer)
    claim = await db.bonanza_claims.find_one(
        {"user_id": user["id"], "offer_id": offer["id"]}, {"_id": 0})
    return {
        "id": offer["id"],
        "title": offer["title"],
        "subtitle": offer["subtitle"],
        "deadline": offer["deadline"],
        "server_time": iso(now),
        "ended": ended,
        "directs": directs,
        "tiers": offer["tiers"],
        "qualified_reward": round(reward, 4),
        "qualified_tier_directs": tier_dirs,
        "claimed": bool(claim),
        "claimed_amount": round(float(claim["amount"]), 4) if claim else None,
        "claimable": ended and reward > 0 and not claim,
    }


@api.post("/bonanza/claim")
async def claim_bonanza(user: dict = Depends(get_current_user)):
    offer = await _get_bonanza_offer()
    if now_utc() < datetime.fromisoformat(offer["deadline"]):
        raise HTTPException(400, "Offer is still running. Claim opens when the timer ends.")
    directs = await _activated_direct_count(user["id"])
    reward, _ = _bonanza_reward_for(directs, offer)
    if reward <= 0:
        need = min(t["directs"] for t in offer["tiers"])
        raise HTTPException(400, f"You need at least {need} direct IDs to claim this reward.")
    res = await _bonanza_credit_user(user["id"], directs, offer)
    if not res["credited"]:
        if res["reason"] == "already_claimed":
            raise HTTPException(400, "Bonanza reward already claimed.")
        raise HTTPException(400, "You are not eligible for this reward.")
    return {"ok": True, "amount": res["amount"], "balance": res["balance"]}


@api.post("/cron/bonanza-payout")
async def cron_bonanza_payout(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(401, "Unauthorized")
    asyncio.create_task(_bonanza_payout_sweep())
    return {"ok": True, "queued": True}




async def _distribute_trading_deduction(user_id: str, profit: float, deducted: float, symbol: str):
    """Split the 25% profit deduction:
    12% differential rank commissions (self + upline, fully paid at Level 10),
    7% royalty pool (level-wise: L2-L5 0.5%, L6-L7 0.75%, L8-L9 1%, L10 1.5%),
    5% company fee, 1% physical meetings — total 25%.
    Unpaid commission budget (compression) -> company reserve.
    All amounts scale down proportionally if only partial fuel was deducted."""
    try:
        fee_expected = profit * BOT_TRADING_FEE_PCT / 100.0
        if fee_expected <= 0 or deducted <= 0:
            return
        scale = min(1.0, deducted / fee_expected)

        company_fee = round(profit * COMPANY_FEE_PCT / 100.0 * scale, 4)
        await _credit_admin_revenue(company_fee, "company_fee", user_id,
                                    note=f"Company fee {COMPANY_FEE_PCT}% of ${profit:.2f} on {symbol}",
                                    symbol=symbol)
        meeting = round(profit * TRADING_MEETING_PCT / 100.0 * scale, 6)
        await _company_ledger("physical_meeting", meeting, user_id,
                              note=f"Physical meeting {TRADING_MEETING_PCT}% of ${profit:.2f} on {symbol}",
                              symbol=symbol)
        # Trading royalty pool — level-wise weights (total 7%)
        for lvl, pct in TRADING_ROYALTY_BY_LEVEL.items():
            amt = profit * pct / 100.0 * scale
            await _company_ledger("trading_royalty", amt, user_id,
                                  note=f"Trading royalty {pct}% · Level {lvl} · {symbol}", symbol=symbol, level=lvl)

        trader = await db.users.find_one({"id": user_id},
                                         {"_id": 0, "id": 1, "referred_by": 1, "rank": 1,
                                          "email": 1, "name": 1})
        trader_label = (trader or {}).get("name") or (trader or {}).get("email", "trader")
        # No self-commission: a trader NEVER earns commission on their OWN trade.
        # Commissions flow only UP the sponsor line (an upline earns a differential
        # override when their downline/team trades). Differential starts from 0.
        highest = 0.0

        # Differential up the sponsor line (UNLIMITED depth; stops early once the
        # full 12% budget is paid, and `seen` guards against referral cycles).
        # RULE: only an ACTIVE upline earns AND advances the differential baseline.
        # An INACTIVE upline is transparent — it neither earns nor blocks, so the
        # rank-based difference keeps flowing up to the next QUALIFIED (active) level.
        seen = {user_id}
        cur = (trader or {}).get("referred_by")
        hops = 0
        while cur and cur not in seen and highest < MAX_RANK_PCT:
            seen.add(cur)
            anc = await db.users.find_one({"id": cur},
                                          {"_id": 0, "id": 1, "referred_by": 1, "rank": 1, "email": 1})
            if not anc:
                break
            pct = _rank_pct_of(anc)
            if pct > highest:
                diff = round(pct - highest, 4)
                amt = round(profit * diff / 100.0 * scale, 4)
                ok = await _credit_commission(anc["id"], amt, "team_commission",
                                              f"Differential {diff}% from {trader_label} · {symbol} · L{hops + 1}",
                                              from_user_id=user_id, symbol=symbol)
                if ok:
                    # Only advance (occupy the rank slot) when an ACTIVE upline earns.
                    highest = pct
            cur = anc.get("referred_by")
            hops += 1

        # Whatever of the 12% rank budget NO active upline qualified for → company reserve.
        reserve_pct = max(0.0, RANK_BUDGET_PCT - highest)
        reserve = round(profit * reserve_pct / 100.0 * scale, 4)
        await _credit_admin_revenue(reserve, "company_reserve", user_id,
                                    note=f"Rank budget reserve {reserve_pct:.1f}% of ${profit:.2f} on {symbol}",
                                    symbol=symbol)
    except Exception as e:
        logger.warning(f"MLM distribution failed: {e}")


async def _charge_trading_fee(user_id: str, profit: float, symbol: str) -> dict:
    """Called after every profitable SELL. Deducts BOT_TRADING_FEE_PCT% of the
    profit ("fuel") from the user's Bot Wallet AND immediately credits it to
    the admin's main wallet. If balance falls below BOT_MIN_FUEL_BALANCE
    after the deduction, all running bots for the user are paused."""
    result = {"fee": 0.0, "deducted": 0.0, "balance_after": 0.0, "paused": False}
    if profit <= 0:
        return result
    wallet = await _get_or_create_bot_wallet(user_id)
    fee = round(profit * BOT_TRADING_FEE_PCT / 100.0, 4)
    result["fee"] = fee
    if not wallet.get("activated"):
        # Not activated → nothing to deduct (bot shouldn't even be trading, but
        # we keep this defensive).
        return result

    balance = float(wallet.get("balance", 0.0) or 0.0)
    if balance <= 0:
        # No fuel → DO NOT pause/stop bots and DO NOT touch positions.
        # Positions are simply HELD; sells are blocked in _bot_tick until the
        # user tops up fuel. (This defensive branch rarely runs since _bot_tick
        # already skips the sell when fuel <= 0.)
        return result

    deducted = min(fee, balance)
    new_balance = round(balance - deducted, 4)
    await db.bot_wallets.update_one(
        {"user_id": user_id},
        {"$set": {"balance": new_balance},
         "$inc": {"total_fees_paid": deducted}},
    )
    await _log_bot_txn(user_id, "fuel", -deducted,
                       note=f"Fuel · {BOT_TRADING_FEE_PCT}% of ${profit:.2f} profit",
                       symbol=symbol, balance_after=new_balance)
    # Fuel deducted → distribute: 5% company, 1% royalty, 19% differential ranks
    await _distribute_trading_deduction(user_id, profit, deducted, symbol)
    result["deducted"] = deducted
    result["balance_after"] = new_balance
    # NOTE: bots are intentionally NOT stopped on low fuel. They keep running
    # (holding positions) down to $0; a "please deposit fuel" popup warns the
    # user below ${BOT_FUEL_WARN_BALANCE:.0f}. Selling resumes once fuel > 0.
    return result


class BotWalletAmountIn(BaseModel):
    amount: float = Field(gt=0)


class BotWalletWithdrawIn(BaseModel):
    amount: float = Field(gt=0)
    address: Optional[str] = None
    network: Optional[str] = None
    password: Optional[str] = None


class BotWalletP2PIn(BaseModel):
    recipient_email: Optional[str] = None
    recipient_address: Optional[str] = None
    network: Optional[str] = None
    amount: float = Field(gt=0)


ALLOWED_EXTERNAL_NETWORKS = {"BEP20", "POLYGON"}  # others show "coming soon" in UI


@api.get("/bot-wallet/status")
async def bot_wallet_status(user: dict = Depends(get_current_user)):
    w = await _get_or_create_bot_wallet(user["id"])
    return {
        "activated": bool(w.get("activated", False)),
        "balance": round(float(w.get("balance", 0.0) or 0.0), 4),
        "activation_fee": BOT_ACTIVATION_FEE,
        "trading_fee_pct": BOT_TRADING_FEE_PCT,
        "min_fuel_balance": BOT_MIN_FUEL_BALANCE,
        "activated_at": w.get("activated_at"),
        "total_fees_paid": round(float(w.get("total_fees_paid", 0.0) or 0.0), 4),
        "deposit_address": w.get("deposit_address") or BOT_WALLET_DEPOSIT_ADDRESS,
        "main_wallet_usdt": round(float(w.get("balance", 0.0) or 0.0), 4),
    }


@api.post("/bot-wallet/activate")
async def bot_wallet_activate(user: dict = Depends(get_current_user)):
    w = await _get_or_create_bot_wallet(user["id"])
    if w.get("activated"):
        return {"ok": True, "already": True,
                "balance": round(float(w.get("balance", 0.0)), 4)}
    bal = float(w.get("balance", 0.0) or 0.0)
    if bal < BOT_ACTIVATION_FEE:
        raise HTTPException(400, f"Insufficient wallet balance. Deposit at least ${BOT_ACTIVATION_FEE:.2f} USDT to activate.")
    new_bal = round(bal - BOT_ACTIVATION_FEE, 4)
    await db.bot_wallets.update_one(
        {"user_id": user["id"]},
        {"$set": {"activated": True, "activated_at": iso(now_utc()),
                  "activation_fee_paid": BOT_ACTIVATION_FEE,
                  "balance": new_bal}},
    )
    await db.users.update_one({"id": user["id"]}, {"$set": {"activated": True}})
    await _log_bot_txn(user["id"], "activation", -BOT_ACTIVATION_FEE,
                       note="One-time bot activation fee",
                       balance_after=new_bal)
    # ---- MLM activation distribution ($50 full accounting) ----
    # $18 royalty ($2 × Levels 2..10) + $2.50 company (5%) + $0.50 meeting (1%)
    # + $26.36 direct-income pot (rank-slab waterfall up the sponsor line)
    # + $2.64 support income (10% of each direct payout to the recipient's upline)
    # leftover (orphan slots / no upline) → company reserve
    distributed = 0.0
    for lvl in ACTIVATION_ROYALTY_LEVELS:
        await _company_ledger("activation_royalty", ACTIVATION_ROYALTY_PER_LEVEL, user["id"],
                              note=f"Activation royalty · Level {lvl}", level=lvl)
        distributed += ACTIVATION_ROYALTY_PER_LEVEL

    company_fee = round(BOT_ACTIVATION_FEE * ACTIVATION_COMPANY_PCT / 100.0, 4)
    await _credit_admin_revenue(company_fee, "company_fee", user["id"],
                                note=f"Company fee {ACTIVATION_COMPANY_PCT:.0f}% of ${BOT_ACTIVATION_FEE:.0f} activation")
    distributed += company_fee

    meeting = round(BOT_ACTIVATION_FEE * ACTIVATION_MEETING_PCT / 100.0, 4)
    await _company_ledger("physical_meeting", meeting, user["id"],
                          note=f"Physical meeting fund {ACTIVATION_MEETING_PCT:.0f}% of ${BOT_ACTIVATION_FEE:.0f} activation")
    distributed += meeting

    # ---- Direct income pot ($26.36 fixed) + support income ($2.64 = 10%) ----
    # Build the chain of ACTIVATED uplines, nearest first (inactive can't earn).
    actor = user.get("name") or user.get("email", "user")
    direct_sponsor_id = user.get("referred_by")
    # The DIRECT sponsor defines the BASE (direct income) slot even if INACTIVE.
    direct_sponsor = await db.users.find_one(
        {"id": direct_sponsor_id},
        {"_id": 0, "id": 1, "rank": 1, "referred_by": 1, "email": 1, "name": 1}
    ) if direct_sponsor_id else None
    direct_sponsor_active = False
    if direct_sponsor:
        wa0 = await db.bot_wallets.find_one({"user_id": direct_sponsor_id}, {"activated": 1})
        direct_sponsor_active = bool(wa0 and wa0.get("activated"))

    # Activated uplines STRICTLY ABOVE the direct sponsor (nearest first) for the
    # rank-difference + support cascade. Inactive uplines are skipped (transparent).
    chain = []
    cur_id = direct_sponsor.get("referred_by") if direct_sponsor else None
    seen = {user["id"]}
    if direct_sponsor_id:
        seen.add(direct_sponsor_id)
    hops = 1
    while cur_id and cur_id not in seen:   # UNLIMITED depth (cycle-guarded by `seen`)
        seen.add(cur_id)
        anc = await db.users.find_one(
            {"id": cur_id},
            {"_id": 0, "id": 1, "rank": 1, "referred_by": 1, "email": 1, "name": 1})
        if not anc:
            break
        wa = await db.bot_wallets.find_one({"user_id": anc["id"]}, {"activated": 1})
        if wa and wa.get("activated"):
            anc["_glevel"] = hops + 1
            chain.append(anc)
        cur_id = anc.get("referred_by")
        hops += 1

    if direct_sponsor:
        base_level = _rank_level_of(direct_sponsor)
        base_income = round(min(DIRECT_INCOME_BY_LEVEL.get(base_level, 0.0), DIRECT_INCOME_POT), 4)
        slots_total = 10 - base_level
        remaining = round(DIRECT_INCOME_POT - base_income, 4)
        share = (remaining / slots_total) if slots_total > 0 else 0.0
        # Support pool = 10% of the direct pot, SHIFTED UP one rank:
        #   base-support (10% of base direct) → first activated upline above base,
        #   remaining split equally over (slots_total - 1) rank slots, cascaded up.
        support_base = round(base_income * SUPPORT_INCOME_PCT / 100.0, 4)
        support_slots_total = max(slots_total - 1, 0)
        support_remaining = round(remaining * SUPPORT_INCOME_PCT / 100.0, 4)
        support_share = (support_remaining / support_slots_total) if support_slots_total > 0 else 0.0

        # 1) BASE direct income belongs to the DIRECT sponsor. If the sponsor is
        #    INACTIVE, their OWN share goes to COMPANY RESERVE (never to a higher
        #    upline). Only an ACTIVE direct sponsor earns Direct income.
        if direct_sponsor_active and await _credit_commission(
                direct_sponsor["id"], base_income, "direct_bonus",
                f"Direct income · {actor} activated · L1", from_user_id=user["id"]):
            distributed += base_income
        elif base_income > 0:
            await _credit_admin_revenue(
                base_income, "company_reserve", user["id"],
                note=f"Direct income (direct sponsor not activated) · {actor} activated")
            distributed += base_income

        # 2) Rank-difference (bot difference) + support cascade to ACTIVATED uplines
        #    above the sponsor. Rank difference keeps flowing to qualified levels.
        highest = base_level
        s_highest = base_level + 1          # base-support conceptually covers rank (base+1)
        first_upline = True
        idx = 0
        while idx < len(chain) and (first_upline or highest < 10 or s_highest < 10):
            up = chain[idx]
            up_level = min(_rank_level_of(up), 10)
            # --- bot difference (rank cascade; only higher ranks override) ---
            if up_level > highest:
                diff_amt = round((up_level - highest) * share, 4)
                if diff_amt > 0 and await _credit_commission(
                        up["id"], diff_amt, "activation_difference",
                        f"Bot difference income · {actor} activated · L{up['_glevel']}", from_user_id=user["id"]):
                    distributed += diff_amt
                highest = up_level
            # --- support income (NOT gated by the bot-difference rank check) ---
            if first_upline:
                sup_amt = support_base
                if up_level > s_highest:
                    sup_amt = round(sup_amt + (up_level - s_highest) * support_share, 4)
                first_upline = False
            elif up_level > s_highest:
                sup_amt = round((up_level - s_highest) * support_share, 4)
            else:
                sup_amt = 0.0
            s_highest = max(s_highest, up_level)
            if sup_amt > 0 and await _credit_commission(
                    up["id"], sup_amt, "support_income",
                    f"Support income · {actor} activated · L{up['_glevel']}", from_user_id=user["id"]):
                distributed += sup_amt
            idx += 1

    distributed = round(distributed, 4)
    remainder = round(BOT_ACTIVATION_FEE - distributed, 4)
    if remainder > 0:
        await _credit_admin_revenue(remainder, "activation_reserve", user["id"],
                                    note=f"Activation unallocated reserve from {user.get('email','user')}")
    return {"ok": True, "activation_fee": BOT_ACTIVATION_FEE}


@api.post("/bot-wallet/deposit")
async def bot_wallet_deposit(body: BotWalletAmountIn,
                             user: dict = Depends(get_current_user)):
    raise HTTPException(400, "Internal transfers are disabled — the app uses one unified wallet. Deposit USDT via crypto (BSC/Polygon) instead.")


@api.post("/bot-wallet/withdraw")
async def bot_wallet_withdraw(body: BotWalletWithdrawIn,
                              user: dict = Depends(get_current_user)):
    w = await _get_or_create_bot_wallet(user["id"])
    amount = round(float(body.amount), 4)
    bal = float(w.get("balance", 0.0) or 0.0)
    if amount > bal:
        raise HTTPException(400, "Insufficient bot wallet balance")
    address = (body.address or "").strip()
    network = ((body.network or "").strip() or "BEP20").upper()

    # Admin-set withdrawal address override (User Management → Edit wallet)
    _admin_addr = (user.get("withdrawal_addresses") or {}).get(network)
    if _admin_addr:
        address = _admin_addr

    if not address:
        raise HTTPException(400, "Withdrawal address required. The app uses one unified wallet — withdraw externally or use P2P.")

    # ---- External on-chain withdrawal → manual admin approval queue ----
    if network not in ALLOWED_EXTERNAL_NETWORKS:
        raise HTTPException(400, f"{network} withdrawals are coming soon. Only BEP20 and Polygon are supported today.")
    if not (address.startswith("0x") and len(address) == 42):
        raise HTTPException(400, "Invalid wallet address")
    if amount < WITHDRAW_MIN_USDT:
        raise HTTPException(400, f"Minimum withdrawal is ${WITHDRAW_MIN_USDT:.0f} USDT")
    udoc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 1, "txn_password_hash": 1})
    txn_hash = (udoc or {}).get("txn_password_hash")
    if txn_hash:
        if not body.password or not verify_password(body.password, txn_hash):
            raise HTTPException(401, "Incorrect transaction password")
    elif not body.password or not verify_password(body.password, (udoc or {}).get("password_hash", "")):
        raise HTTPException(401, "Incorrect password")
    # ---- Atomic, race-safe money movement ----
    from pymongo import ReturnDocument
    # 1) Ensure a valid, unused OTP exists (consumed atomically below)
    otp = await db.withdraw_otps.find_one({"user_id": user["id"]}, {"_id": 0})
    otp_ok = (otp and otp.get("verified") and not otp.get("used")
              and datetime.fromisoformat(otp["created_at"]) > now_utc() - timedelta(minutes=15))
    if not otp_ok:
        raise HTTPException(400, "Email OTP verification required")
    # 2) Atomic conditional balance deduction (prevents double-spend under concurrency)
    wdoc = await db.bot_wallets.find_one_and_update(
        {"user_id": user["id"], "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}},
        return_document=ReturnDocument.AFTER)
    if not wdoc:
        raise HTTPException(400, "Insufficient bot wallet balance")
    new_balance = round(float(wdoc.get("balance", 0.0) or 0.0), 4)
    # 3) Atomic one-time OTP consume; if a concurrent request already used it, roll back balance
    otp_consumed = await db.withdraw_otps.find_one_and_update(
        {"user_id": user["id"], "verified": True, "used": {"$ne": True}},
        {"$set": {"used": True}})
    if not otp_consumed:
        await db.bot_wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": amount}})
        raise HTTPException(400, "Email OTP verification required")
    net_amount = round(amount - WITHDRAW_FEE_USDT, 4)
    req = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "email": user.get("email"),
        "amount": amount,
        "fee": WITHDRAW_FEE_USDT,
        "net_amount": net_amount,
        "address": address,
        "network": network,
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.withdrawal_requests.insert_one(dict(req))
    await _log_bot_txn(user["id"], "withdraw_request", -amount,
                       note=f"Withdrawal request → {address[:8]}…{address[-6:]} · {network} (fee ${WITHDRAW_FEE_USDT:.0f})",
                       balance_after=new_balance)
    _s = await db.app_settings.find_one({"key": "auto_withdraw"}, {"_id": 0})
    _auto = AUTO_WITHDRAW_ENABLED if _s is None else bool(_s.get("value"))
    if _auto:
        asyncio.create_task(_auto_process_withdrawal(req["id"]))
    return {"ok": True, "balance": new_balance, "kind": "withdraw_request",
            "request_id": req["id"], "fee": WITHDRAW_FEE_USDT,
            "net_amount": net_amount, "auto": _auto}


_withdraw_send_lock = asyncio.Lock()


async def _auto_process_withdrawal(req_id: str):
    """Instant auto-payout: master hot wallet (index 0) se on-chain USDT bhejta hai.
    Fail hone par request wapas pending (admin queue) me chali jati hai."""
    req = await db.withdrawal_requests.find_one_and_update(
        {"id": req_id, "status": "pending"},
        {"$set": {"status": "processing"}}, return_document=True)
    if not req:
        return
    try:
        async with _withdraw_send_lock:
            tx_hash = await asyncio.to_thread(
                chain_wallet.send_usdt, req["network"], req["address"],
                float(req["net_amount"]))
        if not tx_hash.startswith("0x"):
            tx_hash = "0x" + tx_hash
        await db.withdrawal_requests.update_one(
            {"id": req_id},
            {"$set": {"status": "completed", "method": "auto", "tx_hash": tx_hash,
                      "resolved_at": iso(now_utc())}})
        await _log_bot_txn(req["user_id"], "withdraw_paid", 0.0,
                           note=f"Withdrawal auto-paid · {req['network']} · tx {tx_hash[:12]}…")
        logger.info(f"AUTO WITHDRAW: {req['net_amount']:.4f} USDT ({req['network']}) "
                    f"-> {req['address']} tx={tx_hash}")
    except Exception as e:
        await db.withdrawal_requests.update_one(
            {"id": req_id},
            {"$set": {"status": "pending", "auto_error": str(e)[:300]}})
        logger.warning(f"AUTO WITHDRAW FAILED {req_id}: {e} — moved to admin queue")


@api.post("/bot-wallet/p2p")
async def bot_wallet_p2p(body: BotWalletP2PIn,
                         user: dict = Depends(get_current_user)):
    amount = round(float(body.amount), 4)
    recipient_email = (body.recipient_email or "").strip().lower()
    recipient_address = (body.recipient_address or "").strip()
    if not recipient_email and not recipient_address:
        raise HTTPException(400, "Provide recipient email or wallet address")
    sender_w = await _get_or_create_bot_wallet(user["id"])
    if not sender_w.get("activated"):
        raise HTTPException(400, "Activate your bot wallet first")
    sender_bal = float(sender_w.get("balance", 0.0) or 0.0)
    if amount > sender_bal:
        raise HTTPException(400, "Insufficient bot wallet balance")

    # ---- Address (internal Trade Skill deposit-address lookup) mode ----
    if recipient_address:
        rw = await db.bot_wallets.find_one(
            {"chain_deposit_address": {"$regex": f"^{re.escape(recipient_address)}$", "$options": "i"}},
            {"_id": 0, "user_id": 1})
        if not rw:
            raise HTTPException(404, "This address does not belong to any Trade Skill user")
        if rw["user_id"] == user["id"]:
            raise HTTPException(400, "Cannot send to your own wallet")
        new_sender_bal = round(sender_bal - amount, 4)
        await db.bot_wallets.update_one(
            {"user_id": user["id"]}, {"$set": {"balance": new_sender_bal}},
        )
        r_after = await db.bot_wallets.find_one_and_update(
            {"user_id": rw["user_id"]}, {"$inc": {"balance": amount}},
            return_document=True)
        r_bal = round(float(r_after.get("balance", 0.0) or 0.0), 4)
        short = f"{recipient_address[:8]}…{recipient_address[-6:]}"
        await _log_bot_txn(user["id"], "p2p_sent", -amount,
                           note=f"P2P → {short}", balance_after=new_sender_bal)
        await _log_bot_txn(rw["user_id"], "p2p_received", amount,
                           note=f"P2P ← {user.get('email') or user['id'][:8]}",
                           balance_after=r_bal)
        return {"ok": True, "balance": new_sender_bal,
                "recipient": short, "mode": "address"}

    # ---- Email (user-to-user) mode ----
    recipient = await db.users.find_one({"email": recipient_email}, {"_id": 0})
    if not recipient:
        raise HTTPException(404, "Recipient user not found")
    if recipient["id"] == user["id"]:
        raise HTTPException(400, "Cannot send to your own wallet")
    # Ensure recipient wallet exists
    await _get_or_create_bot_wallet(recipient["id"])
    new_sender_bal = round(sender_bal - amount, 4)
    await db.bot_wallets.update_one(
        {"user_id": user["id"]}, {"$set": {"balance": new_sender_bal}},
    )
    r_after = await db.bot_wallets.find_one_and_update(
        {"user_id": recipient["id"]},
        {"$inc": {"balance": amount}},
        return_document=True,
    )
    r_bal = round(float(r_after.get("balance", 0.0) or 0.0), 4)
    sender_label = user.get("email") or user["id"][:8]
    await _log_bot_txn(user["id"], "p2p_sent", -amount,
                       note=f"P2P → {recipient_email}",
                       balance_after=new_sender_bal)
    await _log_bot_txn(recipient["id"], "p2p_received", amount,
                       note=f"P2P ← {sender_label}",
                       balance_after=r_bal)
    return {"ok": True, "balance": new_sender_bal,
            "recipient": recipient_email, "mode": "email"}


@api.get("/bot-wallet/transactions")
async def bot_wallet_transactions(user: dict = Depends(get_current_user),
                                  limit: int = 50):
    rows = await db.bot_transactions.find(
        {"user_id": user["id"]}, {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    return rows


# ==== On-chain Deposit / Withdrawal (BSC + Polygon HD Wallet) ====
_watcher_task = None
_event_task = None
_deposit_processing = set()
# In-memory deposit-address index (addr_lower -> user_id). Wallet count 100 ho ya 100k,
# scanner ki speed isse INDEPENDENT rehti hai — har block ka getLogs locally filter hota hai.
_addr_index = {}
_addr_index_ts = 0.0
_scan_cursor = {}  # network -> last fully-scanned block (DB me persist bhi hota hai)


async def _refresh_addr_index(force: bool = False):
    """Deposit-address index periodically refresh (default 30s). 100k docs bhi sub-second."""
    global _addr_index, _addr_index_ts
    if not force and (time.time() - _addr_index_ts) < ADDR_INDEX_REFRESH and _addr_index:
        return _addr_index
    idx = {}
    cursor = db.bot_wallets.find(
        {"chain_deposit_address": {"$exists": True, "$ne": None}},
        {"_id": 0, "user_id": 1, "chain_deposit_address": 1})
    async for w in cursor:
        idx[w["chain_deposit_address"].lower()] = w["user_id"]
    _addr_index = idx
    _addr_index_ts = time.time()
    return _addr_index


async def _get_scan_cursor(net: str):
    doc = await db.scan_state.find_one({"_id": net})
    return doc.get("last_block") if doc else None


async def _set_scan_cursor(net: str, block: int):
    await db.scan_state.update_one(
        {"_id": net}, {"$set": {"last_block": block}}, upsert=True)


async def _process_deposit_wallet(user_id: str, net: str, sweep_to: str, detected_ts: float = None):
    """Credit fresh on-chain USDT + INSTANT sweep broadcast. Event scanner &
    backup poller dono isko call karte hain (per user+net lock, double-safe)."""
    key = f"{user_id}:{net}"
    if key in _deposit_processing:
        return
    _deposit_processing.add(key)
    try:
        w = await db.bot_wallets.find_one(
            {"user_id": user_id},
            {"_id": 0, "user_id": 1, "chain_deposit_address": 1,
             "deposit_index": 1, "onchain_credited": 1})
        if not w or not w.get("chain_deposit_address"):
            return
        try:
            chain_bal = await asyncio.to_thread(
                chain_wallet.get_usdt_balance, net, w["chain_deposit_address"])
        except Exception:
            chain_wallet.rotate_rpc(net)
            return
        credited = float((w.get("onchain_credited") or {}).get(net, 0.0))
        diff = round(chain_bal - credited, 4)
        if diff >= 0.01:
            # Atomic CAS: double-credit impossible (multi-worker safe)
            res = await db.bot_wallets.find_one_and_update(
                {"user_id": w["user_id"],
                 "$or": [{f"onchain_credited.{net}": credited},
                         {f"onchain_credited.{net}": {"$exists": False}}]},
                {"$inc": {"balance": diff,
                          "total_deposited_onchain": diff},
                 "$set": {f"onchain_credited.{net}": chain_bal}},
                return_document=True)
            if res is not None:
                await _log_bot_txn(
                    w["user_id"], "deposit_onchain", diff,
                    note=f"On-chain USDT deposit · {net}",
                    balance_after=round(float(res.get("balance", 0.0)), 4))
                await db.deposit_alerts.insert_one({
                    "id": str(uuid.uuid4()), "user_id": w["user_id"],
                    "amount": diff, "network": net, "seen": False,
                    "created_at": iso(now_utc()),
                })
                lat = f" · detect→credit {int((time.time() - detected_ts) * 1000)}ms" if detected_ts else ""
                logger.info(f"DEPOSIT CREDITED: {diff} USDT ({net}) -> {w['user_id']} at {iso(now_utc())}{lat}")

        # AUTO-SWEEP: instant broadcast to cold wallet
        if SWEEP_ENABLED and sweep_to and chain_bal >= SWEEP_MIN_USDT:
            if w.get("deposit_index") is None:
                logger.warning(f"sweep skip {w['user_id']} {net}: deposit_index missing")
                return
            try:
                t0 = time.time()
                r = await asyncio.to_thread(
                    chain_wallet.sweep_usdt, net,
                    int(w["deposit_index"]), sweep_to, SWEEP_MIN_USDT)
                if not r.get("swept"):
                    logger.warning(f"sweep skipped {w['user_id']} {net}: {r.get('reason')}")
                    return
                broadcast_ms = int((time.time() - (detected_ts or t0)) * 1000)
                await db.bot_wallets.update_one(
                    {"user_id": w["user_id"]},
                    {"$set": {f"onchain_credited.{net}": 0.0}})
                sweep_id = str(uuid.uuid4())
                await db.sweeps.insert_one({
                    "id": sweep_id, "user_id": w["user_id"],
                    "network": net, "amount": r["amount"],
                    "from_address": r["from_address"],
                    "to_address": r["to_address"],
                    "sweep_tx": r["sweep_tx"], "gas_tx": r.get("gas_tx"),
                    "detected_at": iso(datetime.fromtimestamp(detected_ts, tz=timezone.utc)) if detected_ts else None,
                    "broadcast_at": iso(now_utc()),
                    "detect_to_broadcast_ms": broadcast_ms,
                    "status": "broadcast",
                    "created_at": iso(now_utc()),
                })
                logger.info(
                    f"SWEEP BROADCAST: {r['amount']:.4f} USDT ({net}) "
                    f"{r['from_address']} -> {sweep_to} tx={r['sweep_tx']} · detect→broadcast {broadcast_ms}ms")
                asyncio.create_task(_confirm_sweep(net, r["sweep_tx"], sweep_id, time.time()))
            except Exception as e:
                logger.warning(f"sweep failed {w['user_id']} {net}: {e}")
    finally:
        _deposit_processing.discard(key)


async def _confirm_sweep(net: str, tx_hash: str, sweep_id: str, started: float):
    """Background: sweep tx confirm hone ka wait + confirm time log."""
    try:
        await asyncio.to_thread(chain_wallet.wait_receipt, net, tx_hash, 180)
        ms = int((time.time() - started) * 1000)
        await db.sweeps.update_one(
            {"id": sweep_id},
            {"$set": {"status": "confirmed", "confirmed_at": iso(now_utc()), "confirm_ms": ms}})
        logger.info(f"SWEEP CONFIRMED ({net}) tx={tx_hash} · broadcast→confirm {ms}ms")
    except Exception as e:
        logger.warning(f"sweep confirm pending ({net}) tx={tx_hash}: {e}")


async def deposit_event_loop():
    """PRIMARY detector — USDT Transfer logs se naye blocks scan (har ~2s). Local address
    filter → wallet count (100 ya 100k) se speed INDEPENDENT. Block cursor DB me persist,
    isliye restart/downtime ke baad bhi koi block miss nahi hota. BSC+Polygon parallel."""
    await asyncio.sleep(5)

    async def scan_net(net, idx, sweep_to):
        try:
            latest = await asyncio.to_thread(chain_wallet.get_latest_block, net)
            prev = _scan_cursor.get(net)
            if prev is None:
                _scan_cursor[net] = latest
                await _set_scan_cursor(net, latest)
                return
            if latest <= prev:
                return
            frm = prev + 1
            if latest - frm > MAX_SCAN_CATCHUP:
                logger.warning(f"{net} scanner {latest - frm} blocks behind — capping to last {MAX_SCAN_CATCHUP}")
                frm = latest - MAX_SCAN_CATCHUP
            transfers = await asyncio.to_thread(
                chain_wallet.get_usdt_transfers_to, net, idx, frm, latest)
            _scan_cursor[net] = latest
            await _set_scan_cursor(net, latest)
            for t in transfers:
                uid = idx.get(t["to"])
                if not uid:
                    continue
                detected_ts = time.time()
                logger.info(
                    f"DEPOSIT DETECTED (event): {t['value']:.4f} USDT ({net}) "
                    f"tx={t['tx_hash']} block={t['block']} -> user {uid} at {iso(now_utc())}")
                asyncio.create_task(
                    _process_deposit_wallet(uid, net, sweep_to, detected_ts))
        except Exception as e:
            chain_wallet.rotate_rpc(net)
            logger.warning(f"deposit event scan {net}: {e} — RPC rotated")

    for net in ("BEP20", "POLYGON"):
        _scan_cursor[net] = await _get_scan_cursor(net)
    await _refresh_addr_index(force=True)

    while True:
        try:
            idx = await _refresh_addr_index()
            if idx:
                sweep_to = os.environ.get("SWEEP_ADDRESS") or os.environ.get("ADMIN_WALLET_ADDRESS")
                t0 = time.time()
                await asyncio.gather(
                    scan_net("BEP20", idx, sweep_to),
                    scan_net("POLYGON", idx, sweep_to))
                elapsed = time.time() - t0
                if elapsed > 6:
                    logger.warning(f"deposit event scan slow: {elapsed:.1f}s — RPC latency high")
        except Exception as e:
            logger.warning(f"deposit event loop: {e}")
        await asyncio.sleep(EVENT_SCAN_INTERVAL)


async def deposit_watcher_loop():
    """BACKUP — recent blocks ka periodic DEEP re-scan (logs se, wallet-count INDEPENDENT).
    Agar primary scanner kuch miss kare (reorg / RPC blip / gap) to yahan pakda jata hai.
    _process_deposit_wallet idempotent (atomic CAS) hai, isliye double-credit impossible."""
    await asyncio.sleep(25)
    while True:
        try:
            idx = await _refresh_addr_index()
            if idx:
                sweep_to = os.environ.get("SWEEP_ADDRESS") or os.environ.get("ADMIN_WALLET_ADDRESS")
                for net in ("BEP20", "POLYGON"):
                    try:
                        latest = await asyncio.to_thread(chain_wallet.get_latest_block, net)
                        frm = max(0, latest - DEEP_RESCAN_BLOCKS)
                        transfers = await asyncio.to_thread(
                            chain_wallet.get_usdt_transfers_to, net, idx, frm, latest)
                        for t in transfers:
                            uid = idx.get(t["to"])
                            if uid:
                                await _process_deposit_wallet(uid, net, sweep_to)
                    except Exception as e:
                        chain_wallet.rotate_rpc(net)
                        logger.warning(f"deep rescan {net}: {e} — RPC rotated")
        except Exception as e:
            logger.warning(f"deposit watcher error: {e}")
        await asyncio.sleep(DEEP_RESCAN_INTERVAL)


async def _assign_deposit_address(user_id: str) -> dict:
    w = await _get_or_create_bot_wallet(user_id)
    if w.get("deposit_index") is not None and w.get("chain_deposit_address"):
        return w
    ctr = await db.counters.find_one_and_update(
        {"_id": "deposit_index"}, {"$inc": {"seq": 1}},
        upsert=True, return_document=True)
    idx = int(ctr["seq"])  # starts at 1; index 0 reserved for master/gas wallet
    addr = await asyncio.to_thread(chain_wallet.derive_address, idx)
    await db.bot_wallets.update_one(
        {"user_id": user_id},
        {"$set": {"deposit_index": idx, "chain_deposit_address": addr,
                  "onchain_credited": {}}})
    w.update({"deposit_index": idx, "chain_deposit_address": addr,
              "onchain_credited": {}})
    return w


@api.get("/bot-wallet/deposit-address")
async def bot_wallet_deposit_address(user: dict = Depends(get_current_user)):
    try:
        w = await _assign_deposit_address(user["id"])
    except Exception as e:
        logger.error(f"deposit address generation failed: {e}")
        raise HTTPException(500, "Could not generate deposit address. Try again later.")
    return {
        "address": w["chain_deposit_address"],
        "networks": [
            {"id": "BEP20", "label": "BNB Smart Chain (BEP20)", "token": "USDT", "active": True},
            {"id": "POLYGON", "label": "Polygon", "token": "USDT", "active": True},
            {"id": "TRC20", "label": "Tron (TRC20)", "token": "USDT", "active": False, "note": "Coming Soon"},
        ],
        "min_deposit": 1.0,
    }




@api.get("/bot-wallet/deposit-alerts")
async def deposit_alerts(user: dict = Depends(get_current_user)):
    return await db.deposit_alerts.find(
        {"user_id": user["id"], "seen": False}, {"_id": 0}).sort("created_at", 1).to_list(10)


class DepositAlertAck(BaseModel):
    ids: List[str]


@api.post("/bot-wallet/deposit-alerts/ack")
async def ack_deposit_alerts(body: DepositAlertAck, user: dict = Depends(get_current_user)):
    await db.deposit_alerts.update_many(
        {"user_id": user["id"], "id": {"$in": body.ids}}, {"$set": {"seen": True}})
    return {"ok": True}


@api.get("/bot-wallet/withdrawals")
async def my_withdrawals(user: dict = Depends(get_current_user), limit: int = 50):
    return await db.withdrawal_requests.find(
        {"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)


@api.post("/bot-wallet/withdrawals/{req_id}/cancel")
async def cancel_withdrawal(req_id: str, user: dict = Depends(get_current_user)):
    req = await db.withdrawal_requests.find_one_and_update(
        {"id": req_id, "user_id": user["id"], "status": "pending"},
        {"$set": {"status": "cancelled", "resolved_at": iso(now_utc())}},
        return_document=True)
    if not req:
        raise HTTPException(404, "Pending withdrawal request not found")
    res = await db.bot_wallets.find_one_and_update(
        {"user_id": user["id"]}, {"$inc": {"balance": float(req["amount"])}},
        return_document=True)
    await _log_bot_txn(user["id"], "withdraw_refund", float(req["amount"]),
                       note="Withdrawal cancelled — amount refunded",
                       balance_after=round(float(res.get("balance", 0.0)), 4))
    return {"ok": True}


# ==== Admin: Withdrawal Approval Queue + Treasury ====
ADMIN_PANEL_WALLET = os.environ.get(
    "ADMIN_PANEL_WALLET", "0x07fE8dc2d97F592C4333F30ADC47377c93b37559").lower()


async def require_admin(request: Request) -> dict:
    """Admin panel STRICTLY wallet-signature login se hi khulta hai."""
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if not payload.get("wallet_admin"):
        raise HTTPException(403, "Admin access requires wallet login")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


@api.get("/admin/backup/download")
async def admin_backup_download(admin: dict = Depends(require_admin)):
    from fastapi.responses import FileResponse
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = f"/tmp/tradeskill_backup_{ts}.gz"
    cmd = ["mongodump", "--uri", os.environ.get("MONGO_URL"),
           "--db", os.environ.get("DB_NAME"), f"--archive={path}", "--gzip"]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, err = await proc.communicate()
    if proc.returncode != 0 or not os.path.exists(path):
        raise HTTPException(500, f"Backup failed: {err.decode()[:200]}")
    return FileResponse(path, filename=f"tradeskill_backup_{ts}.gz",
                        media_type="application/gzip")


class WalletNonceIn(BaseModel):
    address: str


class WalletLoginIn(BaseModel):
    address: str
    signature: str


@api.post("/admin/wallet-nonce")
async def admin_wallet_nonce(body: WalletNonceIn):
    addr = body.address.strip().lower()
    if addr != ADMIN_PANEL_WALLET:
        raise HTTPException(403, "This wallet is not authorized for admin access")
    nonce = pysecrets.token_hex(16)
    message = (f"Trade Skill Admin Login\n\nWallet: {body.address}\nNonce: {nonce}\n\n"
               "Sign this message to access the admin panel. This does not cost any gas.")
    await db.admin_wallet_nonces.update_one(
        {"address": addr},
        {"$set": {"address": addr, "nonce": nonce, "message": message,
                  "created_at": iso(now_utc())}}, upsert=True)
    return {"message": message}


@api.post("/admin/wallet-login")
async def admin_wallet_login(body: WalletLoginIn):
    addr = body.address.strip().lower()
    if addr != ADMIN_PANEL_WALLET:
        raise HTTPException(403, "This wallet is not authorized for admin access")
    row = await db.admin_wallet_nonces.find_one({"address": addr}, {"_id": 0})
    if not row or datetime.fromisoformat(row["created_at"]) < now_utc() - timedelta(minutes=5):
        raise HTTPException(400, "Nonce expired — connect wallet again")
    from eth_account import Account
    from eth_account.messages import encode_defunct
    try:
        recovered = Account.recover_message(
            encode_defunct(text=row["message"]), signature=body.signature)
    except Exception:
        raise HTTPException(401, "Invalid signature")
    if recovered.lower() != addr:
        raise HTTPException(401, "Signature does not match the admin wallet")
    await db.admin_wallet_nonces.delete_one({"address": addr})
    admin_user = await db.users.find_one({"role": "admin"}, {"_id": 0, "id": 1, "email": 1})
    if not admin_user:
        raise HTTPException(500, "Admin user not found")
    payload = {"sub": admin_user["id"], "email": admin_user["email"],
               "wallet_admin": True, "wallet": body.address,
               "exp": now_utc() + timedelta(hours=12), "type": "access"}
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    logger.info(f"ADMIN WALLET LOGIN: {body.address}")
    return {"token": token, "expires_in_hours": 12}


class AdminApproveIn(BaseModel):
    manual: bool = False


class AdminRejectIn(BaseModel):
    reason: Optional[str] = None


@api.post("/admin/sweep-stuck")
async def admin_sweep_stuck(admin: dict = Depends(require_admin)):
    """Stuck on-chain deposits ko manually sweep karta hai (credit dobara NahI hota)."""
    sweep_to = os.environ.get("SWEEP_ADDRESS") or os.environ.get("ADMIN_WALLET_ADDRESS")
    if not sweep_to:
        raise HTTPException(400, "SWEEP_ADDRESS not configured")
    wallets = await db.bot_wallets.find(
        {"deposit_index": {"$exists": True}},
        {"_id": 0, "user_id": 1, "deposit_index": 1, "chain_deposit_address": 1}).to_list(2000)
    results = []
    for w in wallets:
        for net in ("BEP20", "POLYGON"):
            try:
                bal = await asyncio.to_thread(
                    chain_wallet.get_usdt_balance, net, w["chain_deposit_address"])
                if bal < SWEEP_MIN_USDT:
                    continue
                r = await asyncio.to_thread(
                    chain_wallet.sweep_usdt, net, int(w["deposit_index"]), sweep_to, SWEEP_MIN_USDT)
                if r.get("swept"):
                    await db.sweeps.insert_one({
                        "id": str(uuid.uuid4()), "user_id": w["user_id"], "network": net,
                        "amount": r["amount"], "from_address": r["from_address"],
                        "to_address": sweep_to, "sweep_tx": r["sweep_tx"],
                        "gas_tx": r.get("gas_tx"), "status": "broadcast",
                        "manual": True, "created_at": iso(now_utc())})
                    logger.info(f"MANUAL SWEEP: {r['amount']:.4f} USDT ({net}) user {w['user_id']} tx={r['sweep_tx']}")
                results.append({"user_id": w["user_id"], "network": net, "balance": bal, **r})
            except Exception as e:
                results.append({"user_id": w["user_id"], "network": net, "error": str(e)})
    return {"checked": len(wallets), "actions": results}


@api.get("/admin/withdrawals")
async def admin_withdrawals(status: Optional[str] = None,
                            admin: dict = Depends(require_admin),
                            limit: int = 100):
    q = {"status": status} if status else {}
    rows = await db.withdrawal_requests.find(
        q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    ids = list({r.get("user_id") for r in rows if r.get("user_id")})
    users_map = {u["id"]: u for u in await db.users.find(
        {"id": {"$in": ids}}, {"_id": 0, "id": 1, "email": 1, "name": 1}).to_list(len(ids) or 1)}
    for r in rows:
        u = users_map.get(r.get("user_id"), {})
        if not r.get("email"):
            r["email"] = u.get("email", "—")
        r["name"] = u.get("name") or ((r.get("email") or "—").split("@")[0])
    return rows


@api.post("/admin/withdrawals/{req_id}/approve")
async def admin_approve_withdrawal(req_id: str, body: AdminApproveIn,
                                   admin: dict = Depends(require_admin)):
    req = await db.withdrawal_requests.find_one(
        {"id": req_id, "status": "pending"}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Pending withdrawal request not found")
    if body.manual:
        await db.withdrawal_requests.update_one(
            {"id": req_id},
            {"$set": {"status": "completed", "method": "manual",
                      "resolved_at": iso(now_utc()), "resolved_by": admin["id"]}})
        await _log_bot_txn(req["user_id"], "withdraw_paid", 0.0,
                           note=f"Withdrawal paid manually · {req['network']}")
        return {"ok": True, "method": "manual"}
    try:
        tx_hash = await asyncio.to_thread(
            chain_wallet.send_usdt, req["network"], req["address"],
            float(req["net_amount"]))
    except Exception as e:
        raise HTTPException(400, f"On-chain send failed: {e}")
    if not tx_hash.startswith("0x"):
        tx_hash = "0x" + tx_hash
    await db.withdrawal_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "completed", "method": "onchain", "tx_hash": tx_hash,
                  "resolved_at": iso(now_utc()), "resolved_by": admin["id"]}})
    await _log_bot_txn(req["user_id"], "withdraw_paid", 0.0,
                       note=f"Withdrawal paid on-chain · {req['network']} · tx {tx_hash[:12]}…")
    return {"ok": True, "method": "onchain", "tx_hash": tx_hash}


@api.post("/admin/withdrawals/{req_id}/reject")
async def admin_reject_withdrawal(req_id: str, body: AdminRejectIn,
                                  admin: dict = Depends(require_admin)):
    req = await db.withdrawal_requests.find_one_and_update(
        {"id": req_id, "status": "pending"},
        {"$set": {"status": "rejected", "reject_reason": body.reason or "",
                  "resolved_at": iso(now_utc()), "resolved_by": admin["id"]}},
        return_document=True)
    if not req:
        raise HTTPException(404, "Pending withdrawal request not found")
    res = await db.bot_wallets.find_one_and_update(
        {"user_id": req["user_id"]}, {"$inc": {"balance": float(req["amount"])}},
        return_document=True)
    await _log_bot_txn(req["user_id"], "withdraw_refund", float(req["amount"]),
                       note=f"Withdrawal rejected — refund. {body.reason or ''}".strip(),
                       balance_after=round(float(res.get("balance", 0.0)), 4))
    return {"ok": True}


@api.get("/admin/treasury")
async def admin_treasury(admin: dict = Depends(require_admin)):
    master = await asyncio.to_thread(chain_wallet.derive_address, 0)
    out = {"master_address": master, "admin_wallet": ADMIN_WALLET_ADDRESS,
           "networks": {}}
    for net, cfg in chain_wallet.NETWORKS.items():
        try:
            usdt = await asyncio.to_thread(chain_wallet.get_usdt_balance, net, master)
            native = await asyncio.to_thread(chain_wallet.get_native_balance, net, master)
            out["networks"][net] = {"usdt": round(usdt, 4),
                                    "native": round(native, 6),
                                    "native_symbol": cfg["native"],
                                    "label": cfg["label"]}
        except Exception as e:
            out["networks"][net] = {"error": str(e), "label": cfg["label"],
                                    "native_symbol": cfg["native"]}
    return out


class AdminAdjustIn(BaseModel):
    identifier: str
    amount: float
    note: Optional[str] = ""


class AdminSettingsIn(BaseModel):
    auto_withdraw: bool


@api.get("/admin/overview")
async def admin_overview(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    active_users = await db.users.count_documents({"activated": True, "role": {"$ne": "admin"}})
    pending = await db.withdrawal_requests.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "c": {"$sum": 1}, "t": {"$sum": "$net_amount"}}}]).to_list(1)
    dep = await db.bot_transactions.aggregate([
        {"$match": {"kind": {"$in": ["deposit_onchain", "deposit"]}, "amount": {"$gt": 0}}},
        {"$group": {"_id": None, "t": {"$sum": "$amount"}}}]).to_list(1)
    earn = await db.company_ledger.aggregate([
        {"$match": {"created_at": {"$gte": ist_day_start_utc_iso()}}},
        {"$group": {"_id": None, "t": {"$sum": "$amount"}}}]).to_list(1)
    s = await db.app_settings.find_one({"key": "auto_withdraw"}, {"_id": 0})
    return {
        "total_users": total_users,
        "active_users": active_users,
        "pending_payouts": pending[0]["c"] if pending else 0,
        "pending_payout_amount": round(float(pending[0]["t"]), 2) if pending else 0.0,
        "total_deposited": round(float(dep[0]["t"]), 2) if dep else 0.0,
        "daily_earning": round(float(earn[0]["t"]), 2) if earn else 0.0,
        "auto_withdraw": AUTO_WITHDRAW_ENABLED if s is None else bool(s.get("value")),
    }


@api.get("/admin/users")
async def admin_users(q: str = "", admin: dict = Depends(require_admin)):
    filt = {"role": {"$ne": "admin"}}
    if q.strip():
        rx = {"$regex": q.strip(), "$options": "i"}
        filt["$or"] = [{"email": rx}, {"uid": rx}, {"name": rx}]
    users = await db.users.find(
        filt, {"_id": 0, "id": 1, "uid": 1, "email": 1, "name": 1, "rank": 1,
               "activated": 1, "created_at": 1, "mobile": 1, "blocked": 1,
               "withdrawal_addresses": 1}).sort("created_at", -1).to_list(200)
    ids = [u["id"] for u in users]
    wmap = {w["user_id"]: w for w in await db.bot_wallets.find(
        {"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "balance": 1, "activated": 1}).to_list(len(ids) or 1)}
    for u in users:
        w = wmap.get(u["id"], {})
        u["balance"] = round(float(w.get("balance", 0.0) or 0.0), 2)
        u["bot_activated"] = bool(w.get("activated"))
    return users


@api.post("/admin/adjust")
async def admin_adjust(body: AdminAdjustIn, admin: dict = Depends(require_admin)):
    ident = body.identifier.strip()
    u = await db.users.find_one(
        {"$or": [{"email": ident.lower()}, {"uid": ident.upper()}]}, {"_id": 0, "id": 1, "email": 1})
    if not u:
        raise HTTPException(404, "User not found (email ya UID dalo)")
    amount = float(body.amount)
    if amount == 0:
        raise HTTPException(400, "Amount cannot be 0")
    wallet = await _get_or_create_bot_wallet(u["id"])
    cur = round(float(wallet.get("balance", 0.0) or 0.0), 4)
    if cur + amount < 0:
        raise HTTPException(400, f"Insufficient balance. User only has ${cur:.2f}, cannot deduct ${abs(amount):.2f}.")
    res = await db.bot_wallets.find_one_and_update(
        {"user_id": u["id"]}, {"$inc": {"balance": amount}},
        return_document=True)
    bal = round(float(res.get("balance", 0.0)), 4)
    # Audit only — NOT written to the user's visible transaction history.
    await db.admin_adjustments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": u["id"], "email": u["email"],
        "amount": round(amount, 4), "note": (body.note or "").strip(),
        "balance_after": bal, "admin_id": admin["id"],
        "created_at": iso(now_utc()),
    })
    logger.info(f"ADMIN ADJUST (hidden): {amount:+.2f} USDT -> {u['email']} (bal {bal})")
    return {"ok": True, "email": u["email"], "balance": bal}


@api.post("/admin/users/{user_id}/impersonate")
async def admin_impersonate(user_id: str, admin: dict = Depends(require_admin)):
    """Admin-only: mint a login token for the target user so the admin can open
    that user's account. Audited. The admin's own session is untouched (the frontend
    keeps the admin token and can switch back)."""
    target = await db.users.find_one(
        {"$or": [{"id": user_id}, {"uid": user_id.upper()}]},
        {"_id": 0, "id": 1, "uid": 1, "email": 1, "name": 1, "role": 1})
    if not target:
        raise HTTPException(404, "User not found")
    if target.get("role") == "admin":
        raise HTTPException(400, "Cannot impersonate another admin")
    token = create_access_token(target["id"], target["email"])
    await db.impersonation_log.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"], "admin_email": admin.get("email"),
        "target_id": target["id"], "target_uid": target.get("uid"),
        "target_email": target.get("email"),
        "created_at": iso(now_utc()),
    })
    logger.info(f"ADMIN IMPERSONATE: {admin.get('email')} -> {target.get('uid')} ({target.get('email')})")
    return {"ok": True, "token": token,
            "user": {"uid": target.get("uid"), "name": target.get("name"), "email": target.get("email")}}


@api.get("/admin/deposits")
async def admin_deposits(admin: dict = Depends(require_admin)):
    rows = await db.bot_transactions.find(
        {"kind": {"$in": ["deposit_onchain", "deposit"]}},
        {"_id": 0}).sort("created_at", -1).to_list(50)
    ids = list({r["user_id"] for r in rows})
    users_map = {u["id"]: u for u in await db.users.find(
        {"id": {"$in": ids}}, {"_id": 0, "id": 1, "email": 1, "name": 1}).to_list(len(ids) or 1)}
    for r in rows:
        u = users_map.get(r["user_id"], {})
        r["email"] = u.get("email", "—")
        r["name"] = u.get("name") or (r["email"].split("@")[0] if r["email"] != "—" else "—")
    return rows


@api.get("/admin/settings")
async def admin_get_settings(admin: dict = Depends(require_admin)):
    s = await db.app_settings.find_one({"key": "auto_withdraw"}, {"_id": 0})
    return {"auto_withdraw": AUTO_WITHDRAW_ENABLED if s is None else bool(s.get("value"))}


@api.post("/admin/settings")
async def admin_set_settings(body: AdminSettingsIn, admin: dict = Depends(require_admin)):
    await db.app_settings.update_one(
        {"key": "auto_withdraw"}, {"$set": {"value": body.auto_withdraw}}, upsert=True)
    logger.info(f"ADMIN SETTINGS: auto_withdraw={body.auto_withdraw}")
    return {"ok": True, "auto_withdraw": body.auto_withdraw}


class BonanzaTierIn(BaseModel):
    directs: int
    reward: float


class BonanzaConfigIn(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    deadline: Optional[str] = None       # RFC3339, e.g. 2026-10-19T18:30:00+00:00
    tiers: Optional[List[BonanzaTierIn]] = None


@api.get("/admin/bonanza")
async def admin_get_bonanza(admin: dict = Depends(require_admin)):
    return await _get_bonanza_offer()


@api.post("/admin/bonanza")
async def admin_set_bonanza(body: BonanzaConfigIn, admin: dict = Depends(require_admin)):
    offer = await _get_bonanza_offer()
    update = {}
    if body.title is not None:
        update["title"] = body.title.strip()
    if body.subtitle is not None:
        update["subtitle"] = body.subtitle.strip()
    if body.deadline is not None:
        try:
            datetime.fromisoformat(body.deadline)
        except Exception:
            raise HTTPException(400, "Invalid deadline. Use RFC3339 e.g. 2026-10-19T18:30:00+00:00")
        update["deadline"] = body.deadline
    if body.tiers is not None:
        tiers = [{"directs": int(t.directs), "reward": round(float(t.reward), 4)}
                 for t in body.tiers if t.directs > 0 and t.reward > 0]
        if not tiers:
            raise HTTPException(400, "At least one valid tier (directs>0, reward>0) is required.")
        update["tiers"] = sorted(tiers, key=lambda x: x["directs"])
    if not update:
        raise HTTPException(400, "Nothing to update.")
    await db.bonanza_config.update_one(
        {"key": "active"}, {"$set": {**update, "key": "active", "id": offer["id"]}}, upsert=True)
    logger.info(f"ADMIN BONANZA updated: {list(update.keys())}")
    return await _get_bonanza_offer()



class AdminUserWalletsIn(BaseModel):
    bep20_address: Optional[str] = None
    polygon_address: Optional[str] = None


@api.post("/admin/users/{uid}/wallets")
async def admin_update_user_wallets(uid: str, body: AdminUserWalletsIn,
                                    admin: dict = Depends(require_admin)):
    u = await db.users.find_one({"uid": uid.upper()}, {"_id": 0, "id": 1, "email": 1})
    if not u:
        raise HTTPException(404, "User not found")
    wa = {}
    for key, val in (("BEP20", body.bep20_address), ("POLYGON", body.polygon_address)):
        v = (val or "").strip()
        if v:
            if not (v.startswith("0x") and len(v) == 42):
                raise HTTPException(400, f"Invalid {key} address")
            wa[f"withdrawal_addresses.{key}"] = v
    if not wa:
        raise HTTPException(400, "No address provided")
    await db.users.update_one({"id": u["id"]}, {"$set": wa})
    logger.info(f"ADMIN WALLETS UPDATE: {uid} {list(wa.keys())}")
    return {"ok": True}


@api.post("/admin/users/{uid}/block")
async def admin_block_user(uid: str, admin: dict = Depends(require_admin)):
    r = await db.users.update_one({"uid": uid.upper()}, {"$set": {"blocked": True}})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    logger.info(f"ADMIN BLOCK: {uid}")
    return {"ok": True, "blocked": True}


@api.post("/admin/users/{uid}/unblock")
async def admin_unblock_user(uid: str, admin: dict = Depends(require_admin)):
    r = await db.users.update_one({"uid": uid.upper()}, {"$set": {"blocked": False}})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    logger.info(f"ADMIN UNBLOCK: {uid}")
    return {"ok": True, "blocked": False}


class AdminResetPwIn(BaseModel):
    new_password: str


@api.post("/admin/users/{uid}/reset-password")
async def admin_reset_password(uid: str, body: AdminResetPwIn, admin: dict = Depends(require_admin)):
    pw = (body.new_password or "").strip()
    if len(pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    r = await db.users.update_one({"uid": uid.upper()}, {"$set": {"password_hash": hash_password(pw)}})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    logger.info(f"ADMIN RESET PASSWORD: {uid}")
    return {"ok": True}


class AdminNameIn(BaseModel):
    new_name: str


@api.post("/admin/users/{uid}/name")
async def admin_change_name(uid: str, body: AdminNameIn, admin: dict = Depends(require_admin)):
    name = (body.new_name or "").strip()
    if len(name) < 2:
        raise HTTPException(400, "Name must be at least 2 characters")
    r = await db.users.update_one({"uid": uid.upper()}, {"$set": {"name": name}})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    logger.info(f"ADMIN CHANGE NAME: {uid} -> {name}")
    return {"ok": True, "name": name}


class AdminEmailIn(BaseModel):
    new_email: str


@api.post("/admin/users/{uid}/email")
async def admin_change_email(uid: str, body: AdminEmailIn, admin: dict = Depends(require_admin)):
    email = (body.new_email or "").strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(400, "Invalid email address")
    target = await db.users.find_one({"uid": uid.upper()}, {"id": 1, "email": 1})
    if not target:
        raise HTTPException(404, "User not found")
    clash = await db.users.find_one({"email": email, "id": {"$ne": target["id"]}}, {"id": 1})
    if clash:
        raise HTTPException(400, "This email is already in use by another account")
    await db.users.update_one({"id": target["id"]}, {"$set": {"email": email}})
    logger.info(f"ADMIN CHANGE EMAIL: {uid} {target.get('email')} -> {email}")
    return {"ok": True, "email": email}


class AdminTxnPwIn(BaseModel):
    new_password: str


@api.post("/admin/users/{uid}/txn-password")
async def admin_set_txn_password(uid: str, body: AdminTxnPwIn, admin: dict = Depends(require_admin)):
    pw = (body.new_password or "").strip()
    if len(pw) < 4:
        raise HTTPException(400, "Transaction password must be at least 4 characters")
    r = await db.users.update_one({"uid": uid.upper()}, {"$set": {"txn_password_hash": hash_password(pw)}})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    logger.info(f"ADMIN SET TXN PASSWORD: {uid}")
    return {"ok": True}



@api.post("/admin/users/{uid}/activate-bot")
async def admin_activate_bot(uid: str, admin: dict = Depends(require_admin)):
    """Free admin activation — marks the user's bot ACTIVE so they count as an
    active member and become a valid upline for downline rewards, but distributes
    NO income anywhere (no royalty/daily pool, no direct, no difference, no support).
    This way the company bears no payout for an admin-granted activation."""
    u = await db.users.find_one({"uid": uid.upper()}, {"_id": 0, "id": 1, "email": 1})
    if not u:
        raise HTTPException(404, "User not found")
    w = await _get_or_create_bot_wallet(u["id"])
    if w.get("activated"):
        return {"ok": True, "already": True, "email": u["email"]}
    await db.bot_wallets.update_one(
        {"user_id": u["id"]},
        {"$set": {"activated": True, "activated_at": iso(now_utc()),
                  "activated_by_admin": True}})
    await db.users.update_one({"id": u["id"]}, {"$set": {"activated": True}})
    # Audit only (admin-only). NOT shown in the user's history. No reward distribution.
    await db.admin_adjustments.insert_one({
        "id": str(uuid.uuid4()), "user_id": u["id"], "email": u["email"],
        "amount": 0.0, "kind": "admin_activate_bot",
        "note": "Admin free bot activation (no rewards distributed)",
        "balance_after": round(float(w.get("balance", 0.0) or 0.0), 4),
        "admin_id": admin["id"], "created_at": iso(now_utc()),
    })
    logger.info(f"ADMIN ACTIVATE BOT (no payout): {uid}")
    return {"ok": True, "email": u["email"], "activated": True}


@api.get("/admin/finance-summary")
async def admin_finance_summary(admin: dict = Depends(require_admin)):
    """Full accounting: direct, support, both royalty pools (level-wise),
    company 5%, meeting 1% and company reserve — all tracked separately."""
    async def _ledger_total(kind):
        r = await db.company_ledger.aggregate([
            {"$match": {"kind": kind}},
            {"$group": {"_id": None, "t": {"$sum": "$amount"}}}]).to_list(1)
        return round(float(r[0]["t"]), 4) if r else 0.0

    async def _revenue_total(kind):
        r = await db.admin_revenue.aggregate([
            {"$match": {"kind": kind}},
            {"$group": {"_id": None, "t": {"$sum": "$amount"}}}]).to_list(1)
        return round(float(r[0]["t"]), 4) if r else 0.0

    async def _payout_total(kind):
        r = await db.bot_transactions.aggregate([
            {"$match": {"kind": kind, "amount": {"$gt": 0}}},
            {"$group": {"_id": None, "t": {"$sum": "$amount"}}}]).to_list(1)
        return round(float(r[0]["t"]), 4) if r else 0.0

    activation_pool = await _pool_levels("activation_royalty")
    trading_pool = await _pool_levels("trading_royalty")
    return {
        "direct_bonus_paid": await _payout_total("direct_bonus"),
        "support_income_paid": await _payout_total("support_income"),
        "activation_royalty_pool": {
            "levels": activation_pool,
            "total": round(sum(x["balance"] for x in activation_pool), 4),
        },
        "trading_royalty_pool": {
            "levels": trading_pool,
            "total": round(sum(x["balance"] for x in trading_pool), 4),
        },
        "company_fee_5pct": await _revenue_total("company_fee"),
        "physical_meeting_1pct": await _ledger_total("physical_meeting"),
        "company_reserve": round(await _revenue_total("activation_reserve") + await _revenue_total("company_reserve") + await _revenue_total("royalty_reserve"), 4),
        "legacy_royalty_pool": await _ledger_total("royalty_pool"),
    }
def _mask_email(e: str) -> str:
    name, _, dom = (e or "").partition("@")
    return f"{name[:2]}***@{dom}" if dom else "***"



# ==== Emergent managed email (OTP delivery) ====
import ipaddress as _ipaddr
from html.parser import HTMLParser as _HTMLParser
from urllib.parse import urlparse as _urlparse

EMAIL_BASE_URL = "https://integrations.emergentagent.com"

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _email_host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        _ipaddr.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _email_same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(_HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = _urlparse(low).hostname or ""
        if not _email_host_ok(host) or _urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = _urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _email_same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


def _send_otp_email(to_email: str, code: str, purpose: str = "withdrawal") -> bool:
    if EMAIL_OTP_MODE in ("smtp", "resend", "managed"):
        is_signup = purpose == "signup"
        label = {"signup": "sign up verification", "reset": "password reset",
                 "withdrawal": "withdrawal verification"}.get(purpose, "verification")
        short = {"signup": "sign up", "reset": "password reset"}.get(purpose, "withdrawal")
        subject = f"{code} is your Trade Skill {short} code"
        text = (f"Hello,\n\nYour Trade Skill {label} code is: {code}\n\n"
                "This code is valid for 5 minutes. If you did not request this, "
                "you can safely ignore this email.\n\n"
                "Thanks,\nTeam Trade Skill")
        html = f"""\
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F4F7F9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F9;padding:28px 0;">
    <tr><td align="center">
      <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E3EAEE;">
        <tr><td style="background:linear-gradient(135deg,#16A34A,#0F766E);padding:18px 24px;">
          <span style="color:#FFFFFF;font-size:19px;font-weight:800;letter-spacing:0.5px;">Trade Skill</span>
        </td></tr>
        <tr><td style="padding:26px 24px 8px;">
          <p style="margin:0;color:#083344;font-size:15px;font-weight:700;">{'Verify your email' if is_signup else ('Reset your password' if purpose == 'reset' else 'Confirm your withdrawal')}</p>
          <p style="margin:10px 0 0;color:#4B6A74;font-size:13px;line-height:1.5;">
            Use the code below to complete your {label}. It expires in 5 minutes.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:18px 24px;">
          <div style="display:inline-block;background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:12px 30px;">
            <span style="color:#083344;font-size:30px;font-weight:800;letter-spacing:8px;">{code}</span>
          </div>
        </td></tr>
        <tr><td style="padding:0 24px 24px;">
          <p style="margin:0;color:#8AA3AB;font-size:11px;line-height:1.5;">
            Never share this code with anyone. Trade Skill will never ask for it.
            If you did not request this code, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;color:#9DB3BA;font-size:10px;">© Trade Skill · Automated trading assistant</p>
    </td></tr>
  </table>
</body></html>"""
        _assert_safe_email(subject, html)
        import requests as _rq

        # Emergent managed email proxy (no Resend account/key needed)
        if EMAIL_OTP_MODE == "managed":
            payload = {"to": [to_email], "subject": subject, "html": html,
                       "from_name": os.environ.get("EMAIL_FROM_NAME", "Trade Skill")}
            reply_to = os.environ.get("EMAIL_REPLY_TO")
            if reply_to:
                payload["contact_email"] = reply_to
            r = _rq.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": os.environ["EMERGENT_EMAIL_KEY"]},
                json=payload, timeout=30)
            if r.status_code >= 400:
                logger.error(f"Email send failed {r.status_code}: {r.text[:300]}")
            r.raise_for_status()
            return True

        # Resend (production) — prefer whenever a RESEND_API_KEY is configured
        # (managed mode handled above; demo handled below). Matches pre-existing
        # behaviour so a VPS set to EMAIL_OTP_MODE="smtp" still uses Resend.
        resend_key = os.environ.get("RESEND_API_KEY")
        if resend_key:
            r = _rq.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_key}"},
                json={"from": os.environ.get("RESEND_FROM", "Trade Skill <no-reply@tradeskill.in>"),
                      "to": [to_email], "subject": subject, "html": html, "text": text,
                      "reply_to": os.environ.get("RESEND_REPLY_TO", "support@tradeskill.in")},
                timeout=15)
            if r.status_code >= 400:
                logger.error(f"Resend send failed {r.status_code}: {r.text[:300]}")
            r.raise_for_status()
            return True

        # Gmail SMTP fallback
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from email.utils import formatdate, make_msgid
        gm_user = os.environ["GMAIL_USER"]
        gm_pass = os.environ["GMAIL_APP_PASSWORD"]
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Trade Skill <{gm_user}>"
        msg["To"] = to_email
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="gmail.com")
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
            s.login(gm_user, gm_pass)
            s.send_message(msg)
        return True
    logger.info(f"[DEMO OTP] {purpose} OTP for {to_email}: {code}")
    return False


@api.post("/bot-wallet/withdraw/otp/request")
async def withdraw_otp_request(user: dict = Depends(get_current_user)):
    now = now_utc()
    existing = await db.withdraw_otps.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing and existing.get("created_at"):
        elapsed = (now - datetime.fromisoformat(existing["created_at"])).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN:
            raise HTTPException(429, f"Please wait {int(OTP_RESEND_COOLDOWN - elapsed)}s before requesting another OTP")
    code = f"{random.randint(0, 999999):06d}"
    await db.withdraw_otps.replace_one(
        {"user_id": user["id"]},
        {"user_id": user["id"],
         "code_hash": hashlib.sha256(code.encode()).hexdigest(),
         "created_at": iso(now),
         "expires_at": iso(now + timedelta(seconds=OTP_TTL_SECONDS)),
         "attempts": 0, "verified": False, "used": False},
        upsert=True)
    try:
        await asyncio.to_thread(_send_otp_email, user.get("email", ""), code)
    except Exception as e:
        logger.error(f"OTP email send failed: {e}")
        raise HTTPException(500, "Could not send OTP email. Try again later.")
    resp = {"ok": True, "email_masked": _mask_email(user.get("email", "")),
            "expires_in": OTP_TTL_SECONDS, "resend_in": OTP_RESEND_COOLDOWN,
            "mode": EMAIL_OTP_MODE}
    if EMAIL_OTP_MODE == "demo":
        resp["demo_otp"] = code
    return resp


class OtpVerifyIn(BaseModel):
    code: str


@api.post("/bot-wallet/withdraw/otp/verify")
async def withdraw_otp_verify(body: OtpVerifyIn,
                              user: dict = Depends(get_current_user)):
    doc = await db.withdraw_otps.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(400, "Request an OTP first")
    if doc.get("used"):
        raise HTTPException(400, "OTP already used — request a new one")
    if datetime.fromisoformat(doc["expires_at"]) < now_utc():
        raise HTTPException(400, "OTP expired — request a new one")
    if doc.get("attempts", 0) >= 5:
        raise HTTPException(429, "Too many wrong attempts — request a new OTP")
    if hashlib.sha256(body.code.strip().encode()).hexdigest() != doc["code_hash"]:
        await db.withdraw_otps.update_one({"user_id": user["id"]},
                                          {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect OTP")
    await db.withdraw_otps.update_one({"user_id": user["id"]},
                                      {"$set": {"verified": True}})
    return {"ok": True, "verified": True}


SOCIAL_BONUS_AMOUNT = float(os.environ.get("SOCIAL_BONUS_AMOUNT", "0.10"))
SOCIAL_PLATFORMS = [
    {"id": "telegram", "name": "Telegram", "desc": "Join our Telegram channel", "url": "https://t.me/tradeskill_in", "action": "Join our Telegram channel"},
    {"id": "whatsapp", "name": "WhatsApp", "desc": "Join our WhatsApp channel", "url": "https://whatsapp.com/channel/hubxbot", "action": "Join our WhatsApp channel"},
    {"id": "instagram", "name": "Instagram", "desc": "Follow our Instagram page", "url": "https://instagram.com/hubxbot", "action": "Follow our Instagram page"},
    {"id": "facebook", "name": "Facebook", "desc": "Follow our Facebook page", "url": "https://facebook.com/hubxbot", "action": "Follow our Facebook page"},
    {"id": "youtube", "name": "YouTube", "desc": "Subscribe our YouTube channel", "url": "https://youtube.com/@hubxbot", "action": "Subscribe our YouTube channel"},
]
_SOCIAL_IDS = {p["id"] for p in SOCIAL_PLATFORMS}
_SOCIAL_ORDER = [p["id"] for p in SOCIAL_PLATFORMS]
SOCIAL_ENABLED = set((os.environ.get("SOCIAL_ENABLED", "telegram")).split(","))


def _social_locked(claims: dict, platform: str) -> bool:
    idx = _SOCIAL_ORDER.index(platform)
    if idx == 0:
        return False
    prev = _SOCIAL_ORDER[idx - 1]
    return not (claims.get(prev) or {}).get("claimed")

SOCIAL_VERIFY_DELAY = int(os.environ.get("SOCIAL_VERIFY_DELAY", "15"))
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHANNEL = os.environ.get("TELEGRAM_CHANNEL", "")
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "hubx-tg-hook")
_TG_BOT_USERNAME = ""


def _tg_real_mode() -> bool:
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL)


async def _tg_api(method: str, **params):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}", json=params)
        return r.json()


@api.get("/social-bonus/status")
async def social_bonus_status(user: dict = Depends(get_current_user)):
    doc = await db.social_bonus.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    claims = doc.get("claims", {})
    tg = doc.get("telegram") or {}
    platforms = []
    earned = 0.0
    for p in SOCIAL_PLATFORMS:
        c = claims.get(p["id"], {})
        if c.get("claimed"):
            earned += SOCIAL_BONUS_AMOUNT
        platforms.append({**p, "reward": SOCIAL_BONUS_AMOUNT,
                          "followed": bool(c.get("followed")),
                          "claimed": bool(c.get("claimed")),
                          "locked": _social_locked(claims, p["id"]),
                          "coming_soon": p["id"] not in SOCIAL_ENABLED,
                          "follow_started_at": c.get("follow_started_at"),
                          "verify_mode": "real" if (p["id"] == "telegram" and _tg_real_mode()) else "timer"})
    return {"platforms": platforms, "reward": SOCIAL_BONUS_AMOUNT,
            "total_available": round(SOCIAL_BONUS_AMOUNT * len(SOCIAL_PLATFORMS), 2),
            "total_earned": round(earned, 2),
            "verify_delay": SOCIAL_VERIFY_DELAY,
            "telegram_linked": bool(tg.get("tg_user_id")),
            "server_time": iso(now_utc())}


@api.post("/social-bonus/follow/{platform}")
async def social_bonus_follow(platform: str,
                              user: dict = Depends(get_current_user)):
    if platform not in _SOCIAL_IDS:
        raise HTTPException(404, "Unknown platform")
    if platform not in SOCIAL_ENABLED:
        raise HTTPException(400, "Coming Soon — only Telegram is available right now")
    doc = await db.social_bonus.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    claims = doc.get("claims") or {}
    c = claims.get(platform, {})
    if c.get("claimed"):
        raise HTTPException(400, "Reward already claimed")
    if _social_locked(claims, platform):
        raise HTTPException(400, "Locked — claim the previous platform first")
    await db.social_bonus.update_one(
        {"user_id": user["id"]},
        {"$set": {f"claims.{platform}.follow_started_at": iso(now_utc()),
                  f"claims.{platform}.followed": False}}, upsert=True)
    return {"ok": True, "verify_after": SOCIAL_VERIFY_DELAY}


@api.post("/social-bonus/verify/{platform}")
async def social_bonus_verify(platform: str, user: dict = Depends(get_current_user)):
    if platform not in _SOCIAL_IDS:
        raise HTTPException(404, "Unknown platform")
    if platform not in SOCIAL_ENABLED:
        raise HTTPException(400, "Coming Soon — only Telegram is available right now")
    doc = await db.social_bonus.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    claims = doc.get("claims") or {}
    c = claims.get(platform, {})
    if c.get("claimed"):
        raise HTTPException(400, "Reward already claimed")
    if c.get("followed"):
        return {"ok": True, "verified": True}
    if _social_locked(claims, platform):
        raise HTTPException(400, "Locked — claim the previous platform first")
    if not c.get("follow_started_at"):
        raise HTTPException(400, "Follow first — tap the FOLLOW button")
    if platform == "telegram" and _tg_real_mode():
        tg = doc.get("telegram") or {}
        if not tg.get("tg_user_id"):
            raise HTTPException(428, "TG_CONNECT_REQUIRED")
        res = await _tg_api("getChatMember", chat_id=TELEGRAM_CHANNEL,
                            user_id=tg["tg_user_id"])
        st = (res.get("result") or {}).get("status")
        if not res.get("ok"):
            logger.warning(f"TG getChatMember failed: {res}")
            raise HTTPException(400, "Could not check your membership. The bot must be an ADMIN of the channel. Please contact support.")
        if st not in ("member", "administrator", "creator"):
            raise HTTPException(400, "You haven't joined the channel yet — join first, then verify")
    else:
        elapsed = (now_utc() - datetime.fromisoformat(c["follow_started_at"])).total_seconds()
        if elapsed < SOCIAL_VERIFY_DELAY:
            raise HTTPException(400, f"Verification failed — complete the follow first ({int(SOCIAL_VERIFY_DELAY - elapsed)}s)")
    await db.social_bonus.update_one(
        {"user_id": user["id"]},
        {"$set": {f"claims.{platform}.followed": True,
                  f"claims.{platform}.verified_at": iso(now_utc())}}, upsert=True)
    return {"ok": True, "verified": True}


@api.get("/social-bonus/telegram/link")
async def social_bonus_tg_link(user: dict = Depends(get_current_user)):
    global _TG_BOT_USERNAME
    if not _tg_real_mode():
        raise HTTPException(400, "Telegram verification not configured")
    code = pysecrets.token_hex(6)
    await db.tg_link_codes.update_one(
        {"user_id": user["id"]},
        {"$set": {"code": code, "created_at": iso(now_utc())}}, upsert=True)
    if not _TG_BOT_USERNAME:
        me = await _tg_api("getMe")
        _TG_BOT_USERNAME = (me.get("result") or {}).get("username", "")
    return {"url": f"https://t.me/{_TG_BOT_USERNAME}?start={code}"}


@api.post("/telegram/webhook/{secret}")
async def telegram_webhook(secret: str, request: Request):
    if secret != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(403, "Forbidden")
    upd = await request.json()
    msg = upd.get("message") or {}
    text = msg.get("text") or ""
    frm = msg.get("from") or {}
    if text.startswith("/start") and frm.get("id"):
        parts = text.split()
        code = parts[1] if len(parts) > 1 else ""
        link = await db.tg_link_codes.find_one({"code": code}) if code else None
        if link:
            await db.social_bonus.update_one(
                {"user_id": link["user_id"]},
                {"$set": {"telegram": {"tg_user_id": frm["id"],
                                       "tg_username": frm.get("username"),
                                       "linked_at": iso(now_utc())}}}, upsert=True)
            _chan = TELEGRAM_CHANNEL.lstrip("@")
            _chan_url = f"https://t.me/{_chan}" if _chan else "https://t.me/tradeskill_in"
            await _tg_api(
                "sendMessage", chat_id=msg.get("chat", {}).get("id"),
                text="✅ Account linked!\n\n📢 Now tap the button below to JOIN our channel, then return to the app and tap VERIFY.",
                reply_markup={"inline_keyboard": [[{"text": "📢 Join Channel", "url": _chan_url}]]})
    return {"ok": True}


@api.post("/social-bonus/claim/{platform}")
async def social_bonus_claim(platform: str, user: dict = Depends(get_current_user)):
    if platform not in _SOCIAL_IDS:
        raise HTTPException(404, "Unknown platform")
    if platform not in SOCIAL_ENABLED:
        raise HTTPException(400, "Coming Soon — only Telegram is available right now")
    doc = await db.social_bonus.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    claims = doc.get("claims") or {}
    c = claims.get(platform, {})
    if c.get("claimed"):
        raise HTTPException(400, "Reward already claimed")
    if _social_locked(claims, platform):
        raise HTTPException(400, "Locked — claim the previous platform first")
    if not c.get("followed"):
        raise HTTPException(400, "Please follow & verify first, then claim")
    # One Telegram account can claim only ONCE across the whole platform
    if platform == "telegram":
        tgid = (doc.get("telegram") or {}).get("tg_user_id")
        if tgid:
            dup = await db.social_bonus.find_one({
                "telegram.tg_user_id": tgid,
                "user_id": {"$ne": user["id"]},
                "claims.telegram.claimed": True})
            if dup:
                raise HTTPException(400, "This Telegram account has already claimed the reward on another account")
    # Atomic guard against double-claim
    res = await db.social_bonus.update_one(
        {"user_id": user["id"], f"claims.{platform}.claimed": {"$ne": True}},
        {"$set": {f"claims.{platform}.claimed": True,
                  f"claims.{platform}.claimed_at": iso(now_utc())}},
        upsert=True)
    if res.modified_count == 0 and res.upserted_id is None:
        raise HTTPException(400, "Reward already claimed")
    await _get_or_create_bot_wallet(user["id"])
    w = await db.bot_wallets.find_one_and_update(
        {"user_id": user["id"]},
        {"$inc": {"balance": SOCIAL_BONUS_AMOUNT}}, return_document=True)
    new_bal = round(float(w.get("balance", 0.0) or 0.0), 4)
    pname = next(p["name"] for p in SOCIAL_PLATFORMS if p["id"] == platform)
    await _log_bot_txn(user["id"], "social_bonus", SOCIAL_BONUS_AMOUNT,
                       note=f"{pname} Follow Reward", balance_after=new_bal)
    return {"ok": True, "claimed": True, "balance": new_bal,
            "amount": SOCIAL_BONUS_AMOUNT}


# ==== Startup Seeding ====
# ---------- Home Banners (admin-managed, auto-slide on Home) ----------
DEFAULT_BANNERS = [
    "https://customer-assets-lxgj4vgw.emergentagent.net/job_tgx-api-gateway/artifacts/kre3ls7n_f25808ab5bb943bf789b34c63a8ce4e0b5489ca1b979414142526e683afc4250.png",
    "https://customer-assets-lxgj4vgw.emergentagent.net/job_tgx-api-gateway/artifacts/m7uuu8he_85a8c5c47de1b09cc583e27b5fe7c1d8aa5b80483e17ec8912a7ac45a6577f6b.png",
]


@api.get("/banners")
async def list_banners():
    rows = await db.banners.find({}, {"_id": 0}).sort("order", 1).to_list(20)
    return {"banners": rows}


class BannerIn(BaseModel):
    image_url: str


def _require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")


@api.post("/admin/banners")
async def add_banner(body: BannerIn, admin: dict = Depends(require_admin)):
    count = await db.banners.count_documents({})
    row = {"id": str(uuid.uuid4()), "image_url": body.image_url,
           "order": count + 1, "created_at": iso(now_utc())}
    await db.banners.insert_one({**row})
    return row


@api.delete("/admin/banners/{banner_id}")
async def delete_banner(banner_id: str, admin: dict = Depends(require_admin)):
    res = await db.banners.delete_one({"id": banner_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Banner not found")
    return {"ok": True}


@app.on_event("startup")
async def startup():
    # Rank rename migration (idempotent): old Star names → Level names
    _RANK_MIGRATION = {"Starter": "Level 1", "1 Star": "Level 2", "2 Star": "Level 3",
                       "3 Star": "Level 4", "4 Star": "Level 5", "5 Star": "Level 6",
                       "6 Star": "Level 7", "7 Star": "Level 8", "8 Star": "Level 9",
                       "9 Star": "Level 10"}
    for _old, _new in _RANK_MIGRATION.items():
        await db.users.update_many({"rank": _old}, {"$set": {"rank": _new}})

    # Migration (idempotent): bot activate kiya but users.activated missing → fix
    _act_ids = [w["user_id"] async for w in db.bot_wallets.find(
        {"activated": True}, {"_id": 0, "user_id": 1})]
    if _act_ids:
        await db.users.update_many(
            {"id": {"$in": _act_ids}, "activated": {"$ne": True}},
            {"$set": {"activated": True}})

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("referral_code")
    await db.users.create_index("referred_by")
    await db.bots.create_index([("user_id", 1), ("symbol", 1)], unique=True)
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.bot_wallets.create_index("user_id", unique=True)
    await db.bot_transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.bonanza_claims.create_index([("user_id", 1), ("offer_id", 1)], unique=True)

    # One-time migration: make One-Shot the permanent default and turn Open-position-double OFF
    # for all existing bots (runs once, tracked via migrations flag).
    if not await db.migrations.find_one({"_id": "oneshot_default_v1"}):
        await db.bots.update_many(
            {},
            {"$set": {"trade_method": "One-Shot", "trade_mode": "oneshot",
                      "open_position_double": False}},
        )
        await db.migrations.insert_one({"_id": "oneshot_default_v1", "applied_at": iso(now_utc())})

    # Seed home banners (idempotent)
    if await db.banners.count_documents({}) == 0:
        for i, url in enumerate(DEFAULT_BANNERS):
            await db.banners.insert_one({
                "id": str(uuid.uuid4()), "image_url": url,
                "order": i + 1, "created_at": iso(now_utc()),
            })

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
            "referral_code": "TSKADMIN",
            "referred_by": None,
            "rank": "Diamond",
            "activated": True,
            "wallet_usdt": 10000.0,
            "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Migrate: sabhi users (admin included) ko sequential UID (TSK100000 se, created_at order)
    async for u in db.users.find({"uid": {"$exists": False}}, {"id": 1}).sort("created_at", 1):
        await db.users.update_one({"id": u["id"]}, {"$set": {"uid": await _next_uid()}})

    # Migrate: referral_code = UID (admin = TSKADMIN)
    await db.users.update_many({"role": "admin"}, {"$set": {"referral_code": "TSKADMIN"}})
    async for u in db.users.find(
            {"role": {"$ne": "admin"}, "uid": {"$exists": True},
             "$expr": {"$ne": ["$referral_code", "$uid"]}}, {"id": 1, "uid": 1}):
        await db.users.update_one({"id": u["id"]}, {"$set": {"referral_code": u["uid"]}})

    # Seed news
    if await db.news.count_documents({}) == 0:
        news_items = [
            {"id": str(uuid.uuid4()), "title": "Trade Skill Launches Automated Cycle Trading", "summary": "The new Cycle mode uses grid + DCA strategies to catch every dip.", "category": "Platform", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "title": "Bitcoin ETF Inflows Hit New Record", "summary": "Institutional demand pushes BTC to fresh highs this quarter.", "category": "Market", "created_at": iso(now_utc() - timedelta(hours=6))},
            {"id": str(uuid.uuid4()), "title": "Referral 2.0 Rewards Live", "summary": "Earn 10% commission on every trade your team executes.", "category": "Rewards", "created_at": iso(now_utc() - timedelta(days=1))},
            {"id": str(uuid.uuid4()), "title": "Solana Ecosystem Update", "summary": "New DEX integrations expand SOL/USDT liquidity across venues.", "category": "Market", "created_at": iso(now_utc() - timedelta(days=2))},
        ]
        await db.news.insert_many(news_items)

    # Seed guide
    if await db.guide.count_documents({}) == 0:
        guide_items = [
            {"id": str(uuid.uuid4()), "order": 1, "title": "1. Bind Your Binance API", "body": "Go to Binance API management and generate a key with Spot Trading permission. Paste the API Key and Secret in the Bind API screen. Choose Demo to try risk-free.", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "order": 2, "title": "2. Choose a Trading Pair", "body": "Select from BTC, ETH, SOL, BNB, and more. Trade Skill works best with USDT pairs.", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "order": 3, "title": "3. Configure Your Strategy", "body": "Set First Buy Amount, Margin Call Limit, and Take Profit ratio. Use Cycle for repeated grid trades, One-Shot for single-shot swing entries.", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "order": 4, "title": "4. Start the Bot", "body": "Press Start BOT to activate. Monitor position and P&L from your Dashboard.", "created_at": iso(now_utc())},
            {"id": str(uuid.uuid4()), "order": 5, "title": "5. Invite Friends & Earn", "body": "Share your unique referral code and earn a % of every trade your team makes.", "created_at": iso(now_utc())},
        ]
        await db.guide.insert_many(guide_items)

    if SWEEP_ENABLED and not (os.environ.get("SWEEP_ADDRESS") or os.environ.get("ADMIN_WALLET_ADDRESS")):
        logger.warning("SWEEP_ENABLED=1 but no SWEEP_ADDRESS/ADMIN_WALLET_ADDRESS set — auto-sweep will not run")

    # One-time: reconcile user.activated with real bot activation (bot_wallets.activated).
    # Historically, binding an exchange wrongly set user.activated=True without a bot
    # activation — this corrects such users so admin/referral show correct status.
    try:
        if not await db.app_meta.find_one({"_id": "activated_reconcile_v1"}):
            activated_ids = await db.bot_wallets.distinct("user_id", {"activated": True})
            reset = await db.users.update_many(
                {"activated": True, "id": {"$nin": activated_ids}},
                {"$set": {"activated": False}})
            fix = await db.users.update_many(
                {"activated": {"$ne": True}, "id": {"$in": activated_ids}},
                {"$set": {"activated": True}})
            await db.app_meta.insert_one({"_id": "activated_reconcile_v1", "done_at": iso(now_utc())})
            logger.info(f"activated reconcile: reset={reset.modified_count} fixed={fix.modified_count}")
    except Exception as e:
        logger.warning(f"activated reconcile failed: {e}")

    # One-time: refresh stale bot rows still holding the OLD default trade params
    # (first_buy 20 / tp_ratio 1.5 / buy_in_callback 1 / margin 2-3-4-6-10 x2) to the
    # NEW defaults. Only touches non-running bots with no open position so genuine
    # custom configs and live positions are never clobbered.
    try:
        if not await db.app_meta.find_one({"_id": "bot_defaults_refresh_v1"}):
            new_params = {
                "first_buy_amount": DEFAULT_BOT_CFG["first_buy_amount"],
                "margin_call_limit": DEFAULT_BOT_CFG["margin_call_limit"],
                "whole_take_profit_ratio": DEFAULT_BOT_CFG["whole_take_profit_ratio"],
                "whole_take_profit_callback": DEFAULT_BOT_CFG["whole_take_profit_callback"],
                "buy_in_callback": DEFAULT_BOT_CFG["buy_in_callback"],
                "sub_take_profit_callback": DEFAULT_BOT_CFG["sub_take_profit_callback"],
                "margin_config": [dict(r) for r in DEFAULT_MARGIN_CONFIG],
                "sub_position_tps": [DEFAULT_BOT_CFG["whole_take_profit_ratio"]] * DEFAULT_BOT_CFG["margin_call_limit"],
            }
            refreshed = await db.bots.update_many(
                {"first_buy_amount": 20, "whole_take_profit_ratio": 1.5, "buy_in_callback": 1,
                 "status": {"$ne": "running"},
                 "$or": [{"position_qty": {"$in": [0, 0.0, None]}}, {"position_qty": {"$exists": False}}]},
                {"$set": new_params})
            await db.app_meta.insert_one({"_id": "bot_defaults_refresh_v1", "done_at": iso(now_utc())})
            logger.info(f"bot defaults refresh: updated={refreshed.modified_count}")
    except Exception as e:
        logger.warning(f"bot defaults refresh failed: {e}")

    # One-time: backfill genealogy level (· L{n}) into OLD bot-difference / support /
    # direct income transaction notes so the Asset/wallet screen shows which level the
    # earning came from (new records already carry it). Matches from_user_id via the
    # rewards collection, then walks the sponsor line. Idempotent (skips notes w/ · L).
    try:
        if not await db.app_meta.find_one({"_id": "income_level_backfill_v1"}):
            kinds = ["activation_difference", "support_income", "social_bonus", "direct_bonus"]
            ref_cache = {}
            updated = 0
            cursor = db.bot_transactions.find(
                {"kind": {"$in": kinds}, "note": {"$not": {"$regex": r"· L\d+"}}})
            async for t in cursor:
                rw = await db.rewards.find_one(
                    {"user_id": t["user_id"], "note": t.get("note"), "amount": t.get("amount")},
                    {"_id": 0, "from_user_id": 1})
                fuid = (rw or {}).get("from_user_id")
                if not fuid:
                    continue
                lvl = await _genealogy_level(t["user_id"], fuid, ref_cache)
                if lvl:
                    await db.bot_transactions.update_one(
                        {"id": t["id"]}, {"$set": {"note": f"{t.get('note', '')} · L{lvl}"}})
                    updated += 1
            await db.app_meta.insert_one({"_id": "income_level_backfill_v1", "done_at": iso(now_utc())})
            logger.info(f"income level backfill: updated={updated}")
    except Exception as e:
        logger.warning(f"income level backfill failed: {e}")

    logger.info("Trade Skill startup complete")

    if _tg_real_mode() and os.environ.get("PUBLIC_BASE_URL"):
        try:
            await _tg_api("setWebhook", url=f"{os.environ['PUBLIC_BASE_URL'].rstrip('/')}/api/telegram/webhook/{TELEGRAM_WEBHOOK_SECRET}")
            logger.info("Telegram webhook registered")
        except Exception as e:
            logger.warning(f"Telegram webhook setup failed: {e}")

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
                and (
                    s.get("isSpotTradingAllowed")
                    or "SPOT" in (s.get("permissions") or [])
                    or any("SPOT" in ps for ps in (s.get("permissionSets") or []))
                )
            }
            if usdt_pairs:
                ALLOWED_SYMBOLS.clear()
                ALLOWED_SYMBOLS.update(usdt_pairs)
                logger.info(f"Loaded {len(ALLOWED_SYMBOLS)} tradable USDT pairs from Binance")
    except Exception as e:
        logger.warning(f"Could not load Binance exchangeInfo at startup: {e}. Using fallback list.")

    # Launch the background bot engine
    global _engine_task, _watcher_task, _royalty_task, _event_task
    if _engine_task is None or _engine_task.done():
        _engine_task = asyncio.create_task(bot_engine_loop())
    if _event_task is None or _event_task.done():
        _event_task = asyncio.create_task(deposit_event_loop())
    if _watcher_task is None or _watcher_task.done():
        _watcher_task = asyncio.create_task(deposit_watcher_loop())
    if _royalty_task is None or _royalty_task.done():
        _royalty_task = asyncio.create_task(royalty_close_loop())


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
    global _engine_task, _watcher_task, _event_task
    if _engine_task and not _engine_task.done():
        _engine_task.cancel()
    if _event_task and not _event_task.done():
        _event_task.cancel()
    if _watcher_task and not _watcher_task.done():
        _watcher_task.cancel()
    client.close()
