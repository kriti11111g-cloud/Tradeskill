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

## 2026-10 — Level (L{n}) shown in Bot Difference & Support income + Register login link
- Bot Difference Income & Support Income transaction notes now append "· L{level}" (genealogy depth, L1=direct) like Trading Commission's "Differential x% from Y · SYM · L{n}". Done in activation payout (server.py ~4286 chain build stores anc['_glevel']=hops+1; notes at base_note, bot-difference upline, support_income upline). Only NEW income gets level; old records unchanged. Frontend needs no change (renders note verbatim).
- Register.jsx: added "Already have an account? Login" card below Create Account button (data-testid signup-goto-login) → nav('/login'). Verified via screenshot.

## 2026-10 — Bot difference & support income: removed 50-level depth cap (now UNLIMITED)
- Activation income chain-build loop (server.py ~4277) had `hops < 50` cap. Removed → now `while cur_id and cur_id not in seen:` (cycle-guarded only), matching trading commission's unlimited-depth differential. Bot difference + support income now flow rank-to-rank with NO fixed depth limit; stop only when an equal/higher rank appears below (natural differential rule) or at rank ceiling LEVEL 10. Confirmed via code trace that logic already matched user's rank-to-rank expectation; only the depth cap was the limit.

## 2026-10 — Level shown on ALL income (retroactive backfill)
- Asset/wallet screen uses GET /bot-wallet/transactions → renders txn.note verbatim (Wallet.jsx L504). Level now shows as "· L{n}" in note for bot_difference/support/direct income.
- NEW records: level baked into note at activation payout (done earlier).
- OLD records: one-time startup migration income_level_backfill_v1 (app_meta guarded, idempotent, skips notes already matching `· L\d+`). Matches from_user_id via rewards collection (user_id+note+amount), then _genealogy_level(recipient,from_user) walks sponsor line up (direct child=L1). Social follow rewards correctly get no level (no from_user_id). Verified preview: 5 records updated, e.g. "Support income ... · L2", "Direct bonus · Test Grand activated · L1". Runs on prod DB automatically on deploy/restart.
- Added helper _genealogy_level() near _rank_level_of() (server.py ~3892).

## 2026-10 — BUGFIX: Support income blocked when immediate upline rank <= base rank
- Bug: in activation payout (server.py ~4337), support income payment was nested INSIDE the bot-difference `if up_level > highest:` rank gate. When the base's immediate activated upline had equal/lower rank (e.g. both LEVEL 1), the gate failed (1>1 false) and the upline got ZERO support income — but per design (SUPPORT_INCOME_PCT comment "10% of direct bonus to sponsor's immediate upline") they must always get support_base.
- Fix: moved support computation OUT of the rank gate; first activated upline ALWAYS receives support_base (10% of base direct income) regardless of rank; extra support slots still cascade by rank. Loop condition now `(first_upline or highest<10 or s_highest<10)`.
- Verified via simulation with real constants: A=V1($8 direct), upline V1 → support $0.80 ✓; upline V3 → bot_diff $4.08 + support $1.03 ✓.
- PAST missed support income NOT auto-recovered (went to company reserve). Optional safe recovery migration offered to user (skip already-paid, credit only missing) — pending user go-ahead.

## 2026-10 — Register: show sponsor name under referral code
- Backend: public GET /api/auth/sponsor?code= → {found, name, uid} (resolves referral_code or uid). server.py before /auth/register.
- Frontend Register.jsx: useEffect on form.referral_code (immediate async + cancelled flag; NO setTimeout — dev StrictMode cleared the timeout) fetches sponsor; renders "✓ Sponsor: {name}" green semibold (#059669 + emerald check) below referral field (data-testid signup-sponsor-name), or "Referral code not found" (signup-sponsor-invalid). Verified via screenshot (Sponsor: Test User). Dev-mode first-load timing can lag a few sec; production build instant.

## 2026-10 — Admin "Login as this User" (impersonation)
- Backend: POST /api/admin/users/{user_id}/impersonate (require_admin / wallet_admin only). Accepts uid OR id. Mints a normal user access token via create_access_token, logs to impersonation_log collection (admin_id, target). Rejects impersonating another admin. Returns {token, user:{uid,name,email}}.
- get_current_user already prefers Authorization Bearer over cookie → impersonation works by swapping localStorage tgx_token (admin cookie untouched).
- Frontend: AdminPanel.jsx user-detail → "Login as this User" button (data-testid admin-login-as-user) → confirm → saves tgx_prev_token, sets tgx_token=impersonation token + tgx_impersonating={uid,name}, hard-redirect to '/'. New component ImpersonationBanner.jsx in AppShell shows amber sticky banner "Admin view: {name} ({uid})" + "Exit to Admin" (data-testid impersonation-banner / impersonation-exit-btn) → restores admin token, redirects to /admin.
- Verified via curl: admin→impersonate returns token; token /auth/me = target user (role user); impersonation token BLOCKED from admin endpoints (403); non-wallet_admin token rejected. Frontend compiles clean.

## 2026-10 — Telegram one-account-one-claim + Hindi→English sweep + Join Channel button
- BUG FIX: same Telegram account claiming social bonus from multiple app accounts. claim_social (platform==telegram) now checks db.social_bonus for any OTHER user_id with same telegram.tg_user_id AND claims.telegram.claimed==True → rejects "already claimed on another account". server.py ~5791.
- Telegram verify: clearer error when bot can't read members (not admin) vs genuinely not joined. Bot MUST be channel admin for getChatMember.
- Telegram bot /start reply: now includes inline "📢 Join Channel" button (url from TELEGRAM_CHANNEL). English.
- Hindi→English across UI: SocialBonus (all text/toasts), WithdrawModal success popup, Trades/TradeSettings connect prompts, ExchangeList coming-soon, ForgotPassword toasts, AdminPanel (adjust/auto-withdraw/backup/free-activate), AdminWithdrawals, backend insufficient-balance + social coming-soon messages. No visible Hindi remains (only code comments).
- VPS .env needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL=@tradeskill_in; webhook setWebhook to /api/telegram/webhook/hubx-tg-hook; bot must be channel admin.

## 2026-06 — One-Shot default + permanent, Open-position-double OFF by default
- Request: One-Shot mode default & permanent (bot works in it right after settings save; no need to re-toggle on Trade screen). Open-position-double always OFF by default.
- Backend server.py: BotConfigIn defaults trade_method="One-Shot", open_position_double=False. DEFAULT_BOT_CFG trade_method="One-Shot", trade_mode="oneshot", open_position_double=False.
- PERMANENCE FIX: manual-sell (~1789) and take-profit monitor (~3038) One-Shot completion previously reset trade_mode/method back to Cycle — now keep oneshot/One-Shot so it survives restart.
- One-time startup migration "oneshot_default_v1" (db.migrations guard): update_many all bots → trade_method One-Shot, trade_mode oneshot, open_position_double False. Applied to 67 existing bots (cycle_method=0, double_on=0, oneshot_mode=67).
- Verified: TradeSettings screen shows One-Shot active + double toggle OFF (screenshot + DB counts).

## 2026-06 — Market Search pill + Binance full-coin search
- Request: style Search bar same size/style as Crypto & Futures pills; blue interactive state on touch; connect search to Binance to find ALL available coins.
- Frontend Market.jsx: added 3rd pill "Search" (data-testid pill-search) matching Crypto/Futures pill size (px-5 py-2 rounded-full). Inactive = surface+blue border+blue text+magnifier; active = solid blue (#2563EB) white text. active:scale-95 touch feedback. Toggles a search input (market-search-input, blue border, X clear) + results list (search-pair-{symbol}) that links to /trade-settings/{symbol}. Debounced 250ms.
- Backend server.py: new GET /api/market/search?q=&limit= searches ALLOWED_SYMBOLS (base asset contains), enriches price/change from cached full 24hr ticker (_all_tickers_cached, 60s TTL), sorts prefix-match-first then volume.
- BUG FIX (app-wide): startup exchangeInfo loader filtered by `"SPOT" in permissions` but Binance moved SPOT to permissionSets/isSpotTradingAllowed → ALLOWED_SYMBOLS was stuck at ~50 fallback. Now uses isSpotTradingAllowed OR permissions OR permissionSets → 518 tradable USDT pairs loaded. Whole app (market/search) now covers all coins.
- Verified: curl search (btc/pep/sol/do) + screenshot (SOL/SOLV/BNSOL/RESOLV results, blue active pill).

## 2026-06 — Sub-Beam Mode (SBM) badge + detailed card
- Request: show 'SBM' badge on active (Live/running) trades when sub-beam mode is active; replace SBM "Coming soon" with a real card detailing active sub-positions, their count, and target parameters; label safety orders under "Sub-Beam Mode".
- Frontend Trades.jsx (frontend-only, reuses GET /api/bots/{symbol}):
  - BotRow: SBM active = hasPos && margin_call_count>0. Badge `⬟ SBM {count}` (gradient) next to {sym}/USDT (data-testid bot-sbm-badge-{symbol}). SBM action button now opens SBMModal (was toast "Coming soon"); highlighted gradient when active, shows count.
  - New SBMModal component: fetches /bots/{symbol} (returns dca_ladder, sub_position_tps, margin_call_count/limit, avg_price, position_qty/amount, margin_call_trigger_price). Shows Active Sub-Positions count (X/Y), averaged-position summary (entry/size/invested/next-safety-buy), and per-level "Sub-Position N" list: FILLED (<=mc_count, green) vs PENDING, each with TP target %, drop %, amount, trigger price. testids: sbm-modal, sbm-active-count, sbm-levels, sbm-level-{n}, sbm-close, sbm-done.
- Verified via seeded NEAR running bot (mc_count=3/5): badge "SBM 3", modal "3 / 5" ACTIVE, 5 level rows (3 FILLED, 2 PENDING with triggers). Test bot + demo key cleaned up after.

## 2026-06 — P2P: recipient UID in history + transaction password required
- Request: in Asset→withdrawal history, show recipient UID next to the P2P address; require transaction password to do P2P.
- Backend server.py bot_wallet_p2p (/api/bot-wallet/p2p): added transaction_password to BotWalletP2PIn. Verifies it same as withdrawals (verify_password vs txn_password_hash; fallback to login password_hash if no txn hash set) → 401 "Incorrect transaction password"/"Incorrect password". Sender's p2p_sent note now appends "· UID {uid}" (address mode: looks up recipient user by bot_wallets.user_id; email mode: uses recipient.uid). Response also returns recipient_uid.
- Frontend BotHub.jsx P2P dialog: new Transaction Password input (data-testid input-p2p-txn-password) bound to existing `password` state (cleared on closeModal); doP2P validates it's entered and sends transaction_password in both email/address payloads.
- Wallet.jsx renders txn note as-is, so UID shows automatically. Verified via curl: no pw→401, wrong pw→401, correct pw→ok+recipient_uid TSK100000, note "P2P → 0xd71578…00cd1c · UID TSK100000"; screenshot shows the password field.
- NOTE: old P2P txns (pre-change) have no UID in note; only new transfers include it.

## 2026-06 — P2P: counter-party full UID on BOTH sides
- Follow-up: show the same full UID on the sender's side too (symmetric). Added sender's full UID to the recipient's p2p_received note (both address + email modes): "P2P ← {sender_email} · UID {sender_uid}". sender_uid = user.uid (get_current_user returns full doc incl uid). Sender note already had recipient UID.
- Verified curl: SENT "P2P → 0xd71578…00cd1c · UID TSK100000", RECEIVED "P2P ← mlm.newbie@tgxbot.com · UID TSK100068".
- Old pre-change txns still lack UID; only new transfers include it on both sides.

## 2026-06 — Admin P2P history page + old-note UID backfill
- Backfill migration p2p_uid_backfill_v1 (startup, guarded): adds counter-party UID to OLD p2p_sent/p2p_received notes that predate the UID change. Resolves address (truncated prefix…suffix regex on bot_wallets.chain_deposit_address), email, or short user-id. Preview: 27/28 updated (1 miss = fake test address). Runs once on production after deploy too.
- Backend GET /api/admin/p2p (require_admin wallet token): lists all p2p_sent txns; batch-resolves sender (by user_id) and recipient (UID parsed from note, fallback email). Returns from_name/from_uid/from_email, to_name/to_uid/to_email, amount, created_at, note.
- Frontend AdminPanel.jsx: new MENU item { id:"p2p", label:"P2P", Icon:ArrowLeftRight } after withdrawals. p2p state + loadSection fetch. New section render (testid admin-p2p): each card shows FROM (name + UID blue), ArrowLeftRight, TO (name + UID green), amount (blue) + time. testids admin-nav-p2p, admin-p2p-row/amount/from-name/from-uid/to-name/to-uid-{i}.
- Verified: curl (minted wallet_admin JWT) returns correct from/to names+UIDs+amount for address & email modes; screenshot shows 17 rows rendering correctly.

## 2026-06 — SBM card: per-sub-position Entry Price / Size / TP Target
- Request: each sub-position card in Sub-Beam Mode must individually show Average Entry Price, Position Size, and Take Profit Target (so each sub-position's working + independent target is clear).
- Backend server.py: new helper _sub_position_breakdown(bot, current_price) returns per-level (1..mc_limit) {level, filled, entry_price, qty, amount_usdt, tp_pct, tp_price, drop_pct}. Reconstructs base/first-buy price from last_buy_price ÷ Π(1-drop_k/100) over filled levels (guards drop>=100 → factor<=0), chains each level's entry via its margin_config drop, size=first_buy*multiplier (engine formula), qty=amount/entry, TP price=entry*(1+tp_pct/100) (tp_pct from sub_position_tps). Uses REAL fills from bot.sub_positions (calls>=SUB_POSITION_START=5: buy_price/qty/amount/tp_price) when present. Added to GET /api/bots/{symbol} as merged["sub_positions_detail"].
- Frontend Trades.jsx SBMModal: renders data.sub_positions_detail; each card = header (number + "Sub-Position N" + FILLED/PENDING) + 3-col grid Avg Entry Price / Position Size (qty + $amount) / TP Target (price + +pct%). testids sbm-entry/size/tp-{level}. Removed old ladder-only row layout.
- Verified: curl breakdown (level3 entry=last_buy 2.31, geometric chain, TP=entry×1.0125) + screenshot (5 cards, filled 1-3 + pending 4-5, all showing entry/size/TP). Seeded NEAR test bot + demo key cleaned up.
