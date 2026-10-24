# Trade Skill / TGX BOT — PRD

Hindi/Hinglish crypto trading + MLM platform. React (Tailwind/Shadcn/Lucide/Sonner) frontend + FastAPI/MongoDB backend. Monolith: `/app/backend/server.py`. Admin UI: `/app/frontend/src/pages/AdminPanel.jsx`.

## Ranks & Activation economics
- Backend ranks LEVEL1–LEVEL10; frontend shows V1–V10.
- Bot activation fee $50. Direct/difference pot $26.36.
- Direct income by rank: V1 $8, V2 $9, V3 $12, V4 $15, V5 $18, V6 $20, V7 $22, V8 $23, V9 $24, V10 $26.36.
- Immediate sponsor → `direct_bonus` (rank amount). Higher strictly-higher-rank active uplines → `activation_difference` (shown as "Bot Difference"). 
- **Support income (2026-06 redesign)**: pool = 10% of direct pot ($2.636). Distributed SHIFTED UP one rank from the direct pot — base's direct sponsor gets NO support; the first upline above base (rank base+1) gets `support_base` = 10%×base_income (e.g. V2 gets $0.80); the remaining 10%×`remaining` is split equally over `(slots_total-1)` rank slots (e.g. V3–V10 get ~$0.23 each = $1.836÷8), cascaded up by rank exactly like bot difference. Top unclaimed slots → company reserve. Verified full/partial chains.
- Unclaimed higher-rank difference amounts & top support slots → company reserve (NOT redistributed). Same-rank/inactive uplines don't claim.

## Implemented
- **2026-06: New bot default settings updated** — naye bots/coins ab in defaults ke saath pre-fill hote hain: first_buy=$10, margin_call_limit=5, whole_take_profit_ratio=1.25%, whole_take_profit_callback=0.25%, buy_in_callback=0.25%, sub_take_profit_callback=0.25%, DEFAULT_MARGIN_CONFIG=[25,25,25,25,100]% × 1. Updated BotConfigIn, DEFAULT_BOT_CFG, DEFAULT_MARGIN_CONFIG + TradeSettings fallbacks. GET /bots returns `{**DEFAULT_BOT_CFG,...}` so new coins pre-fill; existing bots keep stored values (user customises via UI). Verified via get_bot('SOLUSDT').
- **2026-06: DCA buy callback default 0.25%** — buy (margin-call/DCA) pehle se trailing recovery par fire hota hai (price trough track → `buy_in_callback`% upar bounce par buy, "upar wali candle"). Default 1.0%→**0.25%** (BotCfg, DEFAULT_BOT_CFG, bot_tick fallback, _get_margin_rule fallback, TradeSettings fallback). Naye bots auto; purane bots UI "Buy in callback" se set karein. Margin drop% (DCA trigger) alag setting hai — ye sirf up-bounce confirm ke liye.
- **2026-06: "Activated" status bug (exchange bind ≠ bot active)** — binding an exchange wrongly set `user.activated=True` (lines ~696 binance, ~784 kucoin), so admin panel + referral showed users as Active before bot activation. Fix: removed `activated:True` from both bind handlers (kucoin keeps `active_exchange`). One-time startup reconcile (`activated_reconcile_v1` flag in `app_meta`) resets `user.activated` to match `bot_wallets.activated` — ran in preview: reset=23, 0 mismatches. Admin list badge now uses authoritative `u.bot_activated`. Verified.
- **2026-06: Withdraw modal overflow fix** — Get OTP ke baad OTP boxes + password + submit card se bahar nikal ke cut-off ho rahe the (chhote screens pe). Root cause: `WithdrawModal.jsx` me parent AND card dono `overflow-y-auto` (double scroll) + `max-h-[85vh]` + `my-4`. Fix: parent se scroll hataya (single scroll container), card `max-h-[88vh] overflow-y-auto`. Screenshot-verified with OTP boxes visible — sab content card ke andar, submit reachable.
- **2026-06: Bonanza reward in Asset history** — `bonanza` kind `bot_transactions` me log hota tha par `Wallet.jsx` KIND_META me nahi tha → Asset history se filter ho jaata tha. Added `bonanza: "Bonanza Reward"` (IconGift). Screenshot-verified (row renders).
- **2026-06: Direct referral card shows downline count** — har direct referral card (`Referral.jsx`) me joining date ke neeche "Total Team: N" add — N = us direct member ke neeche ka poora team (sabhi levels). Data backend `/referral` ke `team.team_size` se (already BFS se compute hota tha). Screenshot-verified.
- **2026-06: Register "Select Your Leg" removed + auto-leg** — leg field (Left/Right) UI hata diya (`Register.jsx`); backend ab leg auto-assign karta hai — sponsor ke directs ke hisaab se alternate (even→left, odd→right), no sponsor→left. `leg` backend me placement ke liye use nahi hota, sirf store hota hai.
- **2026-06: Popups Hindi→English** — Deposit popup ("Credited to your wallet!"), Rank-achieved popup ("Congratulations! You've met all the conditions."), aur exchange-switch warning (BindAPI + ExchangeList: "disconnect X first to add a new exchange") English me.
- **2026-06: Connect-exchange prompt UI** — Trade screen (`Trades.jsx`) ab ek amber banner dikhata hai "Connect an exchange to start trading" jab koi exchange bind nahi (tap → /bind-api). `TradeSettings.jsx` ka Start button "Connect Exchange to Start" me badal jaata hai + warning banner, aur tap karne par /bind-api le jaata hai. `connected = !!(binance.mode || kucoin.mode)` (backend `_has_connected_exchange` se consistent). Screenshot-verified.
- **2026-06: No trade until an exchange is connected** — bot engine was placing demo trades even when the user never bound any exchange. Added `_has_connected_exchange(uid)` (true if `binance_keys` or `kucoin_keys` record exists). Guards: `start_bot` → 400 "connect an exchange first"; `_bot_tick` → auto-sets bot to `idle` (`stop_reason=no_exchange`), no trade; manual `/average` → 400. Demo-mode binding counts as connected. Verified: no-exchange user blocked + 0 trades; demo-bound user trades normally.
- **2026-06: Asset history missing Bot Difference** — `Wallet.jsx` filters history by `KIND_META[h.kind]`; `activation_difference` was absent → those rows dropped. Added `activation_difference: "Bot Difference"` (IconCoinStack, matches Revenue). `support_income` already present. `trade_commission` (user's own trading profit) stays excluded by design. Frontend compiles clean.
- Activation payout labeling: direct vs bot-difference vs support. (tested)
- Fixed V1 getting $16.16 instead of $8 — unclaimed slots now go to reserve. (tested)
- Admin hidden balance adjust `POST /admin/adjust`: changes bot wallet, no `bot_transactions` row (hidden from user history), writes `admin_adjustments` audit, blocks overdraft. (tested)
- Admin FREE bot activation `POST /admin/users/{uid}/activate-bot`: sets `bot_wallets.activated`, `users.activated`, `activated_by_admin=True`; NO reward/pool/distribution; user counts as active member + valid upline; future downline activations pay normally. (backend tested)
- **2026-06: Fixed Admin Panel "Activate Bot" button doing nothing** — root cause: `window.confirm()` suppressed inside Android WebView wrapper. Replaced with custom in-app confirm modal (`admin-activate-modal`/`-confirm`/`-cancel`), matching other admin actions. Compiles clean.
- **2026-06: Revenue/Wallet label cleanup** — Pool page `LEVEL n` → `Vn` (V2–V10); Revenue global tabs `Global Level-0X` → `Vn`; Wallet royalty rows → `Vn`; Wallet/Asset history date → `DD/MM/YYYY`. Pool rank cells now deep-link to Revenue history (`/revenue?tab=global_X`, read via `useSearchParams`).
- **2026-06: Bonanza income tab** — Since V1 has no royalty pool, the V1 Revenue tab is replaced by a **Bonanza** card (IconGift). Revenue global tabs now Bonanza + V2–V10. Backend `/revenue/income` now includes `bonanza` kind → category `bonanza`. Verified in preview.
- **2026-06: Revenue tab labels `Global-:V2`…`Global-:V10`** — bare V2–V10 prefixed with `Global-:`. Bonanza unchanged. (frontend)
- **2026-06: Faster deposit crediting (target 10–15s)** — backend `EVENT_SCAN_INTERVAL` 3s→2s; frontend DepositCelebration poll 10s→3s; on a fresh deposit alert a `window` `tgx:deposit` event is dispatched → Asset (`Wallet.jsx`) and `BotHub.jsx` reload balance instantly. Backend restarted clean, frontend hot-reloaded.
- **2026-06: CRITICAL deposit-speed root cause + 100k-wallet scalability** —
  - ROOT CAUSE of 40s deposits: `deposit_event_loop()` (fast primary detector) was **never launched** at startup — only the 30s balance-diff backup poller ran, which got slower as users grew. Fixed: `_event_task = asyncio.create_task(deposit_event_loop())` added to startup + shutdown cancel.
  - SCALABILITY: rewrote `chain_wallet.get_usdt_transfers_to` to fetch ALL USDT Transfer logs for a block range (topic=signature only) and filter `to` **locally** against an in-memory address index — RPC cost = f(blocks), independent of wallet count. Verified ~0.14s/scan whether 100 or 100k wallets.
  - In-memory `_addr_index` (addr→uid) refreshed every `ADDR_INDEX_REFRESH`=30s (no 100k-doc query per 2s scan).
  - Persisted block cursor in `scan_state` collection (`_get/_set_scan_cursor`) + `MAX_SCAN_CATCHUP`=500 cap → restarts/downtime never miss deposits.
  - Backup `deposit_watcher_loop` converted from all-wallet `balanceOf` (infeasible at 100k) to a wallet-count-independent DEEP log re-scan of last `DEEP_RESCAN_BLOCKS`=200 blocks every `DEEP_RESCAN_INTERVAL`=60s. Idempotent via atomic CAS.
  - `GETLOGS_CHUNK` 30→10 (keeps unfiltered-log responses under RPC limits). RPC HTTP timeout 5s→4s.
  - Net effect: deposit credited ~2–5s after on-chain confirm + ≤3s frontend poll ≈ under ~8–10s, SAME speed at 100 or 100k wallets. Verified: event loop advances cursor every 2s on BSC+Polygon; local-filter scan timing measured against live RPCs.
## Deployment (user-operated, VPS /opt/tradeskill, backend tradeskill-backend port 8021)
After Save-to-GitHub:
```
cd /opt/tradeskill && git pull && cd frontend && PATH="/usr/bin:$PATH" yarn build && sudo systemctl restart tradeskill-backend && sudo systemctl reload nginx
```

## Pending P0 (financial concurrency — NOT done)
1. Withdrawal: atomic balance decrement + one-time atomic OTP consumption.
2. Activation: atomic activation-state transition before MLM distribution (prevent duplicate concurrent distribution).
3. P2P: atomic conditional sender decrement (prevent concurrent overspend).

## Backlog
- "Admin Activated" badge in user list.
- Admin audit tab (manual +/- funds + free activations log).
- Bulk free activate.

## 2026-06 — Bot defaults migration (bot_defaults_refresh_v1)
- Root cause of "new coin shows old settings on production": existing bot rows were saved while OLD defaults were active (first_buy 20 / tp_ratio 1.5 / tp_cb 0.3 / buy_cb 1 / sub_cb 0.5 / margin 2-3-4-6-10 x2). GET /bots returns saved row over defaults, so stale rows kept showing old values even after deploy.
- Fix: one-time startup migration (server.py startup, gated by app_meta _id "bot_defaults_refresh_v1") rewrites stale old-default rows to NEW defaults. Filter matches first_buy_amount=20 AND whole_take_profit_ratio=1.5 AND buy_in_callback=1, status != running, and no open position (position_qty 0/None/absent). Running bots, open positions, and genuine custom configs are preserved.
- Verified on preview: fresh coins already serve new defaults; migration filter matched only the stale stopped row in a synthetic test.
- Deploy to apply on production: cd /opt/tradeskill && git pull && cd frontend && PATH="/usr/bin:$PATH" yarn build && sudo systemctl restart tradeskill-backend && sudo systemctl reload nginx  (the backend RESTART runs the migration once).

## 2026-06 — Profile page redesign (same-to-same with reference)
- Rebuilt /app/frontend/src/pages/Profile.jsx to match user's reference design.
- Header: back arrow, centered TradeSkill logo (TS_LOGO img + Trade/Skill text), Headphones + Settings icons (both -> /guide).
- Blue gradient identity card: circular avatar + camera button (local photo upload via FileReader -> localStorage key ts_avatar_{uid}), green "Verified" pill, "Hi, {name}" + verified badge, email, Joined date, UID with copy-to-clipboard, country with 🇮🇳 flag.
- Menu rows (icon + label + chevron): Current Rank->/rank, Referral->/referral, Security Centre->/guide, Social Media->/social-bonus, Help Center->/guide, API Management->/bind-api. Admin sees Withdrawals Admin row. Logout at bottom.
- Verified visually via screenshot (admin login). Theme-aware via CSS vars; blue card constant.

## 2026-06 — LBank exchange integration (3rd connectable exchange)
- Added LBank spot exchange alongside Binance + KuCoin (one-exchange-per-account rule enforced across all three).
- Backend (server.py):
  - LBankClient (httpx async, HmacSHA256 signing: MD5(sorted params).upper() -> HMAC-SHA256(secret) hex; echostr via pysecrets.token_hex(18); IPv4-forced transport for IP whitelist). Methods: user_info/free_balance/accuracy/market_buy_quote(price=quote spend)/market_sell_base(amount=base qty)/order_info/execution/ticker. Symbol map _lbank_symbol: BTCUSDT->btc_usdt.
  - Endpoints: POST/GET/DELETE /api/lbank/bind (demo+real, real validates keys via user_info, 10022/10025 -> IP-whitelist error). active_exchange set to lbank.
  - get_user_lbank(); _has_connected_exchange() now includes lbank_keys; _execute_trade routes bot.exchange=="lbank" -> _execute_lbank_real (mirrors KuCoin: buy by quote, sell clamped to free balance + accuracy floor, avg from cummulativeQuoteQty/executedQty).
  - Storage: db.lbank_keys (api_key_enc/api_secret_enc Fernet). Env override: LBANK_BASE_URL (default https://api.lbank.info).
- Frontend: BindAPI.jsx EX.lbank entry (no passphrase) + generalized multi-"others" one-exchange blocking; ExchangeList.jsx SUPPORTED adds lbank + lbankBind state/activeId/connectedId.
- Verified on preview: bind/get/delete + both-direction one-exchange blocking via curl; signing fixture; LBank bind page + exchange-list "Bind" badge via screenshot.
- NOT testable in preview: live LBank order execution (needs user's real LBank key with this server IP whitelisted). User must bind real keys on production + whitelist the production server egress IP.

## 2026-06 — BindAPI page premium dark redesign
- Rewrote /app/frontend/src/pages/BindAPI.jsx to a hardcoded dark/glowing-blue premium theme matching user's mockup (applies to all exchanges: binance/kucoin/lbank).
- Sections: custom dark header (back + TradeSkill logo + headphones/settings), glowing Server IP whitelist card (Copy button + big mono IP), Trading Mode as two big selectable cards (DEMO/REAL, radio selectors, glowing blue when selected; 3rd mode col-span-2 for Binance testnet), contextual note/red live-trading warning banner, API Credentials card with icon inputs + eye toggles (key/secret/passphrase), glowing "Save API Settings" button.
- All prior logic preserved: load/bind/unbind, one-exchange-per-account block (multi-other), real-mode confirm modal (restyled dark), passphrase for KuCoin.
- Verified via screenshots on lbank (REAL + red banner) and kucoin (passphrase field + save button).

## 2026-06 — LBank API trading shutdown finding + OTP email (spam) fix
- LBank 10008 "currency pair nonsupport" on real orders: ROOT CAUSE = LBank discontinued public/retail API trading from Oct 2025 (now institutional-only). Confirmed via 2 independent web searches. Our code (symbol sol_usdt, /v2/supplement + legacy fallback, buy_market price=quote) matches docs exactly — not a code bug. Balance read still works (read endpoints partly open). 10008 hint message rewritten (English) to guide users to Binance/KuCoin for live bots.
  - Added diagnostic: LBankClient.raw_private() (returns full raw LBank JSON w/o raising) + GET /api/lbank/diagnose?place=&amount=&symbol= (checks currencyPairs listing + user_info + optionally attempts real $5 buy, returns LBank's exact raw response). Frontend: BindAPI.jsx LBank-only "LBank Connection Test" card (Check Connection / Test Real $5 Order buttons, shows raw JSON) — data-testid lbank-diagnose-card/check/order/result.
  - PENDING user decision: remove LBank entirely vs keep as "balance-view only". Awaiting user's diagnostic screenshot.
- OTP emails landing in SPAM + not in Resend logs: ROOT CAUSE = EMAIL_OTP_MODE="smtp" sends via Gmail SMTP (smtp.gmail.com, From a @gmail.com addr), NOT Resend. Fixed _send_otp_email: now ALWAYS sends via Resend whenever RESEND_API_KEY env present (regardless of smtp/resend mode), added reply_to + error logging. Verified in preview: signup-otp/send -> {"ok":true,"mode":"resend"} to delivered@resend.dev (Resend accepted, no errors).
  - .env is GITIGNORED (not tracked) — production VPS has its own backend/.env. Code fix deploys via git, but PRODUCTION backend/.env MUST contain RESEND_API_KEY + RESEND_FROM (Trade Skill <no-reply@tradeskill.in>) for Resend path to activate. User action needed on VPS.
