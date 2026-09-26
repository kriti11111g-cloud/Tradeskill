import asyncio, os, sys
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
import server

PRICES = {"v": 10.0}
async def fake_price(symbol):
    return PRICES["v"]
server.fetch_price = fake_price

async def main():
    db = server.db
    u = await db.users.find_one({"email": "level1test@tgxbot.com"}, {"_id": 0, "id": 1})
    uid = u["id"]
    sym = "TESTUSDT"
    await db.users.update_one({"id": uid}, {"$set": {"wallet_usdt": 5000.0}})
    await db.bots.delete_many({"user_id": uid, "symbol": sym})
    await db.bots.insert_one({
        "user_id": uid, "symbol": sym, "status": "running",
        "first_buy_amount": 10.0, "margin_call_limit": 10, "margin_call_count": 4,
        "position_qty": 15.0, "position_amount": 150.0, "avg_price": 10.0,
        "last_buy_price": 9.2, "next_buy_price": 9.0, "peak_price": 0.0,
        "dca_bottom_price": 0.0, "sub_positions": [],
        "whole_take_profit_ratio": 1.5, "whole_take_profit_callback": 0.3,
        "buy_in_callback": 0.3,
        "margin_config": [{"drop": 2.0, "multiplier": 2.0} for _ in range(10)],
        "trade_mode": "cycle",
    })
    bot = lambda: db.bots.find_one({"user_id": uid, "symbol": sym}, {"_id": 0})

    # Step 1: price drops below next_buy (9.0) -> trough tracking
    PRICES["v"] = 8.5
    await server._bot_tick(await bot())
    b = await bot()
    print("1) trough set:", b.get("dca_bottom_price"))

    # Step 2: price recovers 0.3% from trough -> C5 fires as SUB-POSITION
    PRICES["v"] = 8.53
    await server._bot_tick(await bot())
    b = await bot()
    subs = b.get("sub_positions", [])
    print("2) C5 fired: mc_count:", b["margin_call_count"], "subs:", len(subs))
    if subs:
        print("   sub tp_price (expect 10.0 = prev avg):", subs[0]["tp_price"], "call:", subs[0]["call"], "qty:", round(subs[0]["qty"],4))

    # Step 3: price recovers to prev avg (10.0) -> sub TP exits principal+profit
    PRICES["v"] = 10.01
    qty_before = b["position_qty"]
    await server._bot_tick(await bot())
    b = await bot()
    print("3) after sub TP: subs left:", len(b.get("sub_positions", [])),
          "| qty:", round(qty_before,4), "->", round(b["position_qty"],4),
          "| core avg:", b["avg_price"])
    ev = await db.bot_events.find({"user_id": uid, "symbol": sym}).sort("created_at", -1).to_list(5)
    for e in ev:
        print("   event:", e["kind"], e.get("call") or e.get("round"), e.get("tp_price") or "")

    # cleanup
    await db.bots.delete_many({"user_id": uid, "symbol": sym})
    await db.bot_events.delete_many({"user_id": uid, "symbol": sym})
    await db.transactions.delete_many({"user_id": uid, "symbol": sym})
    await db.users.update_one({"id": uid}, {"$set": {"wallet_usdt": 1000.0}})
    print("cleanup done")

asyncio.run(main())
