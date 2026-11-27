
## 2026-06 — Perceived speed / instant navigation
- Added `src/lib/useCachedState.js`: drop-in useState replacement that persists to localStorage (stale-while-revalidate). Pages now paint last-known data instantly on tap, fresh data loads in background.
- Wired into: Dashboard (pairs/wallet/rank), Market (movers; coins already cached), Rank (ranks/me), Rewards (pool), Referral (data). Wallet & Revenue already had their own caches.
- Removed now-unused imports (Search/Bitcoin/LineChart in Dashboard; useState in Rewards/Referral).
- Verified: login + navigation across /rank /rewards /referral /market /revenue, no crashes.

## 2026-06 — Cycle / One-Shot sync fix (trade_method <-> trade_mode)
- BUG: Trade Settings saved `trade_method` ("Cycle"/"One-Shot") while Trade screen read/wrote `trade_mode` ("cycle"/"oneshot"). Two disconnected fields -> setting One-Shot in Settings still showed Cycle in Trade section; user had to re-toggle manually.
- FIX (backend/server.py): treat One-Shot as a single concept kept in lockstep.
  - Added `_is_oneshot(bot)` and `_normalize_trade_fields(doc)` helpers.
  - Settings save (POST /bots/{sym}) now also writes trade_mode synced from trade_method.
  - Mode toggle (POST /bots/{sym}/mode) now also writes trade_method synced from trade_mode.
  - Bot start preserves the chosen one-shot state (no longer force-resets to cycle).
  - sell-now + take-profit one-shot completion reset BOTH fields together.
  - GET /bots and GET /bots/{sym} normalize both fields (fixes legacy/out-of-sync docs for display).
  - DEFAULT_BOT_CFG includes trade_mode.
- Verified via API: Settings One-Shot -> both GET endpoints show method=One-Shot/mode=oneshot; toggle cycle -> both Cycle; reverse toggle oneshot -> Settings shows One-Shot.
- 'Open position double' amount logic left unchanged per user ("ise rahne do").

## 2026-06 — Referral: Direct / Team tabs + Team-by-Rank drilldown
- Added Direct + Team same-size tab cards above the referral list (Direct selected by default).
- Backend: new GET /referral/team-by-rank — BFS whole downline, groups all members by rank V1..V10, returns per-rank counts + members (name, activated, rank, created_at, own team_size).
- Frontend (Referral.jsx): Team tab -> V1..V10 rank list (with counts) -> tap a rank -> members shown in the SAME card format as Direct Referrals (name, Active/Inactive, ★rank, Joined date, Total Team). Extracted shared MemberRow component. Back button returns to rank list.
- Verified in preview: Direct list, Team rank list (18 @ V1 for demo.team1), V1 members drilldown all render correctly.

## 2026-06 — Team-by-Rank: perf fix + 20/page pagination
- ROOT CAUSE of "Team" tab long loading: no index on users.referred_by -> every BFS level did a full collection scan (very slow on large production teams). Added db.users.create_index("referred_by") at startup + created it on live DB. Rank list now loads ~0.2s.
- Added 20-per-page pagination in the rank member drilldown (Referral.jsx): "Showing X–Y of Z", Prev/Next buttons (first page auto). Client-side slicing of the fetched rank list.
- Verified in preview with 26 V1 members: page1 1–20, Next -> 21–26, Prev/Next enable/disable correctly.

## 2026-06 — Team member cards: genealogy depth "Level X" label
- team-by-rank now computes each member's depth below the logged-in user during BFS (direct = Level 1, their referrals = Level 2, ...). Added `depth` to each member payload.
- Referral MemberRow shows a thin "Level {depth}" label under the email (only when depth present). Verified: directs show Level 1, sub-members Level 2.

## 2026-06 — OTP delivery fix (signup / forgot / withdrawal)
- ROOT CAUSE: RESEND_API_KEY was invalid (401 "API key is invalid") -> every _send_otp_email raised -> "Could not send OTP email" on signup, forgot-password and withdrawal.
- FIX: switched _send_otp_email to Emergent managed email proxy (https://integrations.emergentagent.com/api/v1/email/send, X-Email-Key). No Resend account/key or domain verification needed; platform-verified domain delivers to any recipient. Added _assert_safe_email guardrail gate (no forms/credential-asks/unsafe links). Existing OTP HTML template reused.
- backend/.env (PREVIEW) added: EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME="Trade Skill". RESEND_API_KEY no longer read (left in place, harmless).
- Verified: send to delivered@resend.dev -> HTTP 200 ok:true. (demo.team1@tgxbot.com -> 422 undeliverable because tgxbot.com is a fake domain; real emails deliver.)
- PRODUCTION TODO (VPS): add EMERGENT_EMAIL_KEY=ek_0a1558a448e6abbe7684590104fe54e0 and EMAIL_FROM_NAME="Trade Skill" to /opt/tradeskill backend .env, then redeploy + restart backend. Sends draw from the Emergent account credits/Universal Key.

## 2026-06 — Admin panel: names in Deposits/Withdrawals + reliable "Login as user"
- /admin/deposits now enriches each row with `name` (fallback: email prefix). AdminPanel deposit row shows Name (bold) + email below.
- /admin/withdrawals now enriches each row with `name`. AdminWithdrawals row shows Name + email.
- "Login as this User" (impersonate): removed window.confirm() which silently fails on some mobile webviews (user reported tap did nothing). Now taps directly -> toast -> mints user token -> opens user account; ImpersonationBanner (AppShell) lets admin return. Backend endpoint + Bearer-over-cookie priority verified correct.
- Verified via minted admin JWT: deposits (30) and withdrawals (15) both return name+email.

## 2026-06 — MLM payout rule: inactive uplines (confirmed by user)
RULE: Direct referral, trading commission & support income only to ACTIVE uplines. Inactive DIRECT sponsor's own share -> company reserve. Rank-based differential keeps flowing to qualified ACTIVE uplines.
- _distribute_trading_deduction (profit 25% fuel): inactive upline is now TRANSPARENT — it neither earns nor blocks; the rank differential flows up to the next ACTIVE qualified upline. Only truly unclaimed budget (12% - highest active) -> company_reserve. (Previously inactive upline's differential went to company AND blocked higher uplines.) Tested: inactive L10 skipped -> active L8 earned $9.50, reserve $2.50, total $25.
- bot_wallet_activate distribution: BASE (direct) income slot now belongs to the DIRECT sponsor. If direct sponsor INACTIVE -> base direct income -> company_reserve (not absorbed by a higher upline). Rank difference + support still cascade to ACTIVE uplines above. Active-sponsor case unchanged (no regression). Tested both cases, each balances to $50.
- Both changes backend-only (server.py). Needs deploy.

## 2026-06 — Margin-call drop based on LAST BUY PRICE (dev instruction)
- Verified the live/demo engine ALREADY triggers each DCA from the last FILL price: every _execute_trade BUY path (KuCoin/LBank/Binance/demo) stores last_buy_price = this order's fill and next_buy_price = fill × (1 - drop%); monitor loop uses the stored next_buy_price. So triggers compound from the previous buy, not the initial entry.
- Fixed _compute_dca_ladder preview anchor: now chains from last_buy_price (was avg_price for open positions) so the Settings preview matches the engine. Numeric check: $100,10% → 90, 81, 72.9, 65.61.
- Backend-only; needs deploy.

## 2026-11-26 — SBM modal cards sized/laid out like the main Trade card (frontend)
- Widened SBM (Sub-Beam Mode) modal: max-w-sm→max-w-md, outer px-5→px-3, inner p-5→px-4 pt-5 pb-4 so cards get the same width as the main Trade bot cards.
- LevelCard (used by BOTH Initial Safety Orders and Sub-Position sections) now matches the main BotRow card: CoinIcon 32→34, title 13.5→14px, all stat values 14→15px; card gaps space-y-1.5→space-y-2.
- Header locked to a single line (title truncate + SUB-BEAM badge shrink-0/whitespace-nowrap) so Safety Order and Sub-Position cards always have identical height.
- Frontend-only; compiled clean (pre-existing html5-qrcode warnings only); needs deploy (git pull + yarn build + reload nginx).

## 2026-11-26 — Sub-Position cycle-count badge (SBM)
- Backend _sub_position_breakdown now returns `cycles` and `sub_state` per level (read from bot.sub_positions records).
- Frontend: each Sub-Position card header shows a small violet "⟳ Nx" badge when cycles>0 (data-testid sbm-cycles-<level>). Safety-order cards unaffected.
- Verified via isolated call: C5 cycles=3, C6 cycles=1. Frontend+backend compile clean. Needs deploy.

## 2026-11-26 — TP trailing (profit-lock) strip on bot card
- BotRow: when position open AND TP armed (effPeak>0), shows a green "Smart profit lock active — riding the peak ↑" strip (data-testid bot-tp-trailing-<symbol>).
- Strip shows live peak, the climbing sell trigger = peak×(1-tp_callback%), and the locked profit %. Makes trailing/smart-hold visible (sell only on red pullback). Uses existing peak_price from /bots list + live stream; no backend change needed.
- Frontend-only, compiled clean; needs deploy.

## 2026-11-26 — SBM Sub-Position trailing sell indicator
- Backend _sub_position_breakdown now returns per sub: `peak`, `trailing` (state==holding & peak>0), `trail_sell_price` = peak×(1−whole_take_profit_callback%).
- Frontend LevelCard: when a Sub-Position is riding a peak, shows a green strip "Riding peak $X ↑ — sells on a C% dip, ≈ $Y" (data-testid sbm-trailing-<level>).
- Verified: C5 holding peak 760 → trail_sell 758.1; C6 flat → no strip. Compile clean. Needs deploy (backend + frontend).

## 2026-11-27 — FIX: SBM sub-position sells recorded wrong (near-zero/negative) profit
- Root cause: _execute_trade SELL computed profit = proceeds − qty×bot.avg_price (MAIN blended average) for ALL sells. SBM sub-positions buy at a dip (lower than blended avg), so their TP scalp sells were booked against the higher main avg → profit came out ~0/negative, so Revenue showed no Trading Profit even though Binance booked a real gain.
- Fix: added optional cost_basis param to _execute_trade + all 3 real-engine helpers (binance/kucoin/lbank/hyperliquid) and the demo path. Sub sells (ceiling close + trailing scalp) now pass cost_basis=sp_entry so profit = proceeds − qty×sub_entry (matches exchange realized PnL). Main-position sells pass nothing → unchanged (use avg_price).
- Backend-only; syntax OK, backend healthy. Needs deploy + backend restart. NOTE: already-recorded (pre-fix) sub-sell transactions keep their wrong profit; only new sells are correct. A fresh cycle will show correct Trading Profit.

## 2026-11-27 — SBM cards now mirror the main Trade card (CYCLE/ONE SHOT/SELL NOW)
- Each SBM sub/safety card got the same 3-button row as the main bot card (same size/style), so SBM cards match the main card look.
- CYCLE/ONE SHOT switch the parent bot's mode (reuses /bots/{symbol}/mode); SELL NOW sells that specific sub-position via NEW endpoint POST /bots/{symbol}/sub/{call}/sell-now (uses cost_basis=sub_entry for correct profit, then removes the sub). SELL NOW enabled only for filled+holding beam subs.
- Verified e2e: sold Sub-Position 7 → correct profit vs sub entry, sub removed. Frontend+backend compile clean. Needs deploy.

## 2026-11-27 — SBM cards full parity: added AVERAGE/SBM/TP bottom row
- Each SBM card now has BOTH button rows exactly like the main Trade card: (top) CYCLE/ONE SHOT/SELL NOW and (bottom) AVERAGE/SBM/TP +X%. Bottom row is display-styled (AVERAGE dim when not filled, SBM gradient-active for beam, TP green with sub tp_pct).
- Verified visually in preview (admin ZEC demo). Frontend compile clean. Needs deploy.

## 2026-11-27 — SBM cards show Live/Pending label
- SBM card header now shows "Live" (filled/active) or "Pending" (unfilled) text like the main Trade card (data-testid sbm-live-<level>). Verified in preview. Frontend-only; needs deploy.

## 2026-11-27 — SBM card header matches main card format
- SBM card title now "SYM/USDT [ C<n> ]" and subtitle "CYCLE · RUNNING" (filled) / "CYCLE · PENDING" (unfilled), mirroring the main Trade card. SUB-BEAM + cycle badges retained. Verified in preview; needs deploy.

## 2026-11-27 — SBM "Live" indicator now green on all cards
- Live text + dot + check icon are green for all filled cards (previously violet on sub-beam). Pending stays grey. Verified in preview; needs deploy.

## 2026-11-27 — SBM card [ Cn ] call label now green
- The [ Cn ] call-number part of the SBM card title is now green (matches the green Live indicator); "SYM/USDT" stays in ink. Verified in preview; needs deploy.

## 2026-11-27 — Removed SUB-BEAM title badge (redundant)
- Removed the violet SUB-BEAM badge from the SBM card title (the bottom-row SBM button already indicates it). Cycle (⟳ Nx) badge kept. Verified in preview; needs deploy.

## 2026-11-27 — Sub-beam cards: top 3 buttons made non-interactive
- On SUB-BEAM cards only, CYCLE/ONE SHOT/SELL NOW now do nothing on tap (onClick guarded by !beam). Look unchanged. Safety-order (C1-C4) cards keep CYCLE/ONE SHOT working. Needs deploy.

## 2026-11-27 — FIX: TP update now reflects in SBM cards
- Bug: changing TP in Trade Settings updated the main card (+5%) but SBM sub cards still showed old TP (+1.25%), because per-sub TPs and stored sub_positions[].tp_pct were not updated.
- Frontend (TradeSettings): changing the main "Whole take profit ratio" now sets all sub_position_tps to the same value.
- Backend (upsert_bot): on editing an existing bot, each existing sub_positions record's tp_pct + tp_price is re-synced to the new per-sub TP. So SBM cards AND the engine use the new TP immediately.
- Verified e2e: TP 5% update -> all sub records tp_pct 1.25->5.0, breakdown shows 5% for all filled subs. Needs deploy (backend + frontend).

## 2026-11-27 — All SBM modal cards: CYCLE/ONE SHOT/SELL NOW non-interactive
- Made the top 3 buttons no-op on ALL SBM modal cards (Initial Safety Orders C1-C4 AND Sub-Beam C5+). Buttons kept for look/size parity but do nothing on tap. Frontend-only; needs deploy.

## 2026-11-27 — PERF: Rank page opens instantly from cache
- Bug: Rank.jsx viewLevel started null and was only set after /ranks/me resolved, so the page showed "Loading…" even when ranks/me were cached.
- Fix: initialize viewLevel from cached me.current_level → instant render on repeat visits; API still refreshes in background. Backend endpoints already fast (~0.13-0.18s). Frontend-only; needs deploy.

## 2026-11-27 — PERF: Referral team opens instantly (prefetch)
- Bug: team-by-rank was only fetched on Team-tab tap, so the team list appeared after a round-trip wait.
- Fix: prefetch /referral/team-by-rank on page mount (parallel with /referral) so the Team tab shows instantly; useCachedState keeps it instant on repeat visits. Backend endpoints already fast (~0.12-0.15s). Frontend-only; needs deploy.

## 2026-11-27 — Pool (Rewards) page colors reverted to neutral + instant
- Reverted the blue/green gradient headers (BLUE_HEADER/GREEN_BADGE/LEVEL_HEADER) to the earlier neutral theme: plain white cards, var(--border), gold icon, green Total text, neutral V-level headers. USDT logo kept on every amount.
- Page already uses useCachedState with no blocking loader → opens instantly from cache. Frontend-only; needs deploy.

## 2026-11-26 — Configurable SBM start (C4/C5)
- Trade Settings me naya "Sub-position mode start" option (segmented C4/C5 toggle, Trade method jaisa).
- Backend: `sub_position_start` ab per-bot config (default 5, clamp 2..limit). `_sub_position_breakdown.is_subbeam`, `_bot_tick` sub-creation, aur `/bots/{symbol}` detail sab per-bot value use karte hain.
- Distribution view ka text aur TP-input filter dynamic (start value ke hisaab se).
- Verified via curl (C4/C5 persist, is_subbeam shifts) + screenshot. Default restored to C5.

## 2026-11-27 — SBM modal: Initial Safety Orders combined view
- Initial Safety Orders cards (non-SBM) par per-card scary minus "Live P&L" hata diya.
- Ab in cards par: "Order Entry" (individual) + "Average (All)" (sab initial orders ka qty-weighted blended avg, har card same) + "Sells @" (= initAvg × (1+whole_tp%), jahan averaged block bikega).
- Sub-Beam (SBM) cards unchanged: individual Live P&L + TP Target (sell price) banaa rahe.
- Frontend only (Trades.jsx SBMModal/LevelCard). Verified via demo ZEC bot screenshot: Avg $917.90, Sells @ $927.08 (+1%).

## 2026-11-27 — SBM: base/first entry added to Initial Safety Orders
- `_sub_position_breakdown` ab level 0 "base entry" (pehla buy, jo margin_call_count increment nahi karta) emit karta hai — is_subbeam=False, header "[ Entry ]".
- Initial Safety Orders me ab Entry + C1 + C2 + C3 (4 orders); "Average (All)" aur count dono me first buy shaamil.
- Verified demo ZEC: Entry $962.55, Average(All) $924.02, "4 orders", Sells @ $933.26.

## 2026-11-27 — SBM modal: live price in header card
- Sub-Beam Mode ke top card (Active Sub-Positions / Status) me center me "Live Price" add kiya (us coin ka curPx, live-updating). testid sbm-live-price.

## 2026-11-27 — SBM modal instant open
- Backend get_bot ab fetch_price_cached (10s TTL) use karta hai (blocking 8s fetch_price hataya) — detail response fast.
- Frontend SBMModal: module-level sbmCache + background refresh; BotRow mount par prefetch (hasPos bots). Modal cache se instant khulta hai.
- Note: Entry(level-0) card + ye changes production par tabhi dikhenge jab backend restart ho (systemctl restart tradeskill-backend). Preview timing: 1st 0.8s, cached 0.19s.

## 2026-11-27 — App-wide performance pass
- Diagnosed: preview backend endpoints fast (0.1-0.2s); login 0.3s (20s spike was a transient cold-start/event-loop stall, not persistent). Major pages (Wallet, Trades, Dashboard, Market, Rank, Referral, Rewards, Revenue) already do stale-while-revalidate localStorage caching.
- Added caching to remaining pages: Transactions (tgx_txns_cache, unfiltered) + BotHub status (tgx_botwallet_status) → instant open.
- Backend: bot_engine_loop ab _TICK_SEM semaphore (env BOT_TICK_CONCURRENCY, default 20) se concurrency cap karta hai — bade bot fleet par thread-pool/event-loop saturation se API stall nahi hoga (login/pages responsive).
- Verified: PY OK, login x3 ~0.3s, frontend compiled (24 pre-existing warnings), app renders.

## 2026-11-27 — Trade Settings instant open
- TradeSettings.jsx: bot config + connected-exchange flag ab localStorage cache (tgx_botcfg_<sym>, tgx_connected) se seed hote hain → page turant paint hota hai (pehle `if(!bot) return blank` tak blank rehta tha). Background refresh fresh data laata hai; symbol-change par us symbol ka cache instantly seed hota hai.
- Pattern Wallet/Trades jaisa (proven). Clean compile; direct screenshot post-login rank-celebration redirect (automation) ki wajah se nahi liya.

## 2026-11-27 — Full-app perf pass (price warmer)
- Audit: only 2 slow endpoints found — wallet/summary (1.0s) & market/pairs (1.27s), both ONLY on cold cache-miss (~once/min). All other endpoints 0.1-0.2s.
- Added price_warmer_loop (background, every 25s) that force-refreshes the shared Binance all-tickers cache; started in startup alongside bot engine.
- fetch_price_cached now reads from that warm all-tickers map (TTL 30s) instead of a per-symbol Binance round-trip → wallet/summary, get_bot, etc. never pay cold-fetch cost.
- Result: wallet/summary 1.0s→0.18s, market/pairs 1.27s→0.13s, bots/{sym} 0.11s — stable even after TTL cycles. No more 1s stalls anywhere.
- Other minor pages (Profile, TradingPair, News, etc.) already fast (<0.35s); left as-is.

## 2026-11-27 — Referral page speed (server-side team cache)
- /referral and /referral/team-by-rank both run a whole-downline BFS; the Referral page calls BOTH on load + bg refresh, and the referral link was gated behind the BFS.
- Added per-user server-side cache _TEAM_CACHE (60s TTL, opportunistic cleanup >500 entries) for both endpoints → repeat/background calls instant; heavy BFS runs at most once/min even on large production teams. Referral code returns fast.
- Frontend already caches (useCachedState) + prefetches team-by-rank. Verified preview: referral 0.14-0.2s, team-by-rank 0.12-0.17s, code+team intact.

## 2026-11-27 — Referral/team SCALE to lakhs (materialized upline path)
- Problem: /referral & /referral/team-by-rank did full-downline BFS, loading EVERY member into app memory + returning huge JSON — breaks at 50k, impossible at 5 lakh.
- Added `upline` (ancestor id array, cap 300) on each user: set at registration ([referred_by]+ref.upline); idempotent startup backfill migration (upline_v1) for existing users; indexes: users.upline and (upline, created_at).
- /referral: team_total/activated via indexed count_documents({upline:uid}); per-direct subtree via gathered counts. No BFS.
- /referral/team-by-rank: rank COUNTS via aggregation group over {upline:uid} (server-side). members_by_level returned empty.
- NEW /referral/team-members?level&skip&limit: paginated member list per rank (20/page) + per-member team_size.
- Frontend Referral.jsx: rank member list now server-paginated (fetch on rank tap / page change) instead of client-side slicing of full list.
- Verified preview (217 users backfilled): counts match old BFS exactly (team_total 30, ranks 29+1); all endpoints 0.12-0.18s.
