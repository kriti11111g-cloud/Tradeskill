import asyncio, os, uuid, sys
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
import server
from server import db, _charge_trading_fee, iso, now_utc


async def main():
    # ---- setup: trader referred by demo.team1 ----
    tm1 = await db.users.find_one({"email": "demo.team1@tgxbot.com"})
    admin = await db.users.find_one({"email": "admin@tgxbot.com"})
    trader_email = "mlm.trader@tgxbot.com"
    await db.users.delete_many({"email": trader_email})
    trader_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": trader_id, "email": trader_email, "password_hash": "x",
        "name": "MLM Trader", "role": "user", "referral_code": "MLMT01",
        "referred_by": tm1["id"], "rank": "Starter", "activated": True,
        "wallet_usdt": 1000.0, "created_at": iso(now_utc()),
    })
    # activated bot wallets with known balances
    for uid, bal in [(trader_id, 100.0), (tm1["id"], 50.0), (admin["id"], None)]:
        w = await db.bot_wallets.find_one({"user_id": uid})
        if w is None:
            await db.bot_wallets.insert_one({"user_id": uid, "balance": bal or 0.0,
                                             "activated": True, "created_at": iso(now_utc())})
        else:
            upd = {"activated": True}
            if bal is not None:
                upd["balance"] = bal
            await db.bot_wallets.update_one({"user_id": uid}, {"$set": upd})

    b_tm1_before = (await db.bot_wallets.find_one({"user_id": tm1["id"]}))["balance"]
    b_adm_before = (await db.bot_wallets.find_one({"user_id": admin["id"]}))["balance"]

    # ---- act: $100 profit → 25% deduction & distribution ----
    res = await _charge_trading_fee(trader_id, 100.0, "BTCUSDT")
    print("charge result:", res)

    w_trader = await db.bot_wallets.find_one({"user_id": trader_id})
    w_tm1 = await db.bot_wallets.find_one({"user_id": tm1["id"]})
    w_adm = await db.bot_wallets.find_one({"user_id": admin["id"]})

    # expected: trader 100 - 25 + 3.5 self = 78.5 ; tm1 +1.0 diff ; admin +0 diff
    print("trader balance:", w_trader["balance"], "(expect 78.5)")
    print("tm1 delta:", round(w_tm1["balance"] - b_tm1_before, 4), "(expect 1.0)")
    print("admin delta:", round(w_adm["balance"] - b_adm_before, 4), "(expect 0.0)")

    ledger = await db.company_ledger.find({"from_user_id": trader_id}).to_list(10)
    print("royalty ledger:", [(l["kind"], l["amount"]) for l in ledger], "(expect royalty_pool 1.0)")

    adm_rev = await db.admin_revenue.find({"from_user_id": trader_id}).to_list(10) if "admin_revenue" in await db.list_collection_names() else []
    print("admin revenue rows:", [(r.get("kind"), r.get("amount")) for r in adm_rev])

    rewards = await db.rewards.find({"from_user_id": trader_id}).to_list(10)
    print("rewards:", [(r["user_id"][:6], r["amount"], r["note"][:40]) for r in rewards])

    ok = (abs(w_trader["balance"] - 78.5) < 0.01 and
          abs(w_tm1["balance"] - b_tm1_before - 1.0) < 0.01 and
          abs(w_adm["balance"] - b_adm_before) < 0.01)
    print("PASS" if ok else "FAIL")

asyncio.run(main())
