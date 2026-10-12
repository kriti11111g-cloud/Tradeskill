# TGX BOT — Product Requirements Document

## Update (12 Oct 2026): One exchange per account (single-bind enforcement)
- USER: ek ID me sirf ek exchange; doosra add karne ke liye pehle disconnect.
- Backend: `/binance/bind` block if kucoin_keys exists; `/kucoin/bind` block if binance_keys exists (400 clear msg). Hard guarantee.
- Frontend: BindAPI load par other-exchange check -> red notice (bind-blocked-notice) + submit disabled. ExchangeList: activeId (api_key_mask demo/real); doosre supported exchange tap -> toast "Pehle X disconnect karo".
- Verified curl both directions: blocked when other present; after DELETE binds fine.


## Update (12 Oct 2026): KuCoin added as 2nd exchange (full real-trading parity)
- USER: Binance stays; user KuCoin bhi connect/trade kar sake (apni Key+Secret+Passphrase, Binance jaisa).
- Backend: `KuCoinClient` (async httpx, KC-API v3 HMAC signing + encrypted passphrase per integration_expert playbook). Symbol map BTCUSDT->BTC-USDT. Endpoints POST/GET/DELETE `/api/kucoin/bind` (real mode VERIFIES keys before save), `/api/kucoin/account`. Keys encrypted in `kucoin_keys`. Bind real -> user.active_exchange='kucoin'.
- Routing: bots carry `exchange` (set at create from active_exchange). `_execute_trade` -> bot.exchange=='kucoin' + real -> `_execute_kucoin_real` (live order + fills readback); else shared DEMO sim. Binance path UNCHANGED.
- Frontend: BindAPI generic `/bind-api/:exchange` (KuCoin adds Passphrase, demo+real, no testnet). ExchangeList: binance+kucoin SUPPORTED -> bind form; others Coming-Soon. Trades exchange card shows connected exchange + balance (EX_META).
- Verified: testing_agent iteration_32 backend 10/10 + frontend 100%. ⚠️ LIVE KuCoin order exec NOT runtime-tested (no real keys in env); signing confirmed correct (400003).
- PENDING: LBank next. Live KuCoin needs real-key user test on prod (whitelist server IP).


## Update (11 Oct 2026): BUGFIX — Self-commission removed (self-trading)
- USER rule: user ko KHUD ke trade par kabhi self-commission nahi; commission sirf jab downline/team trade kare (upline differential override).
- `_distribute_trading_deduction`: "Self commission at trader's own rank" block HATAYA. Ab `highest=0` se differential sidha upline line ko; trader ko kuch nahi. Unpaid -> company_reserve.
- `_income_breakdown`: `trade_commission` kind ko kinds + cat_of se hataya (ye trading_profit me "Self commission X%" dikhti thi). Ab trading_profit me SIRF real SELL profits.
- Verified via live API: "self commission" notes=0; trading_profit me trade:null=0.


## Update (11 Oct 2026): Revenue group v2 — coin-wise entries + Close button
- Date group expand hone par ab har inner entry COIN dikhati hai (IncomeRow showCoin: CoinIcon + "SYM / USDT" + time); entry tap -> wahi full trade detail. trade:null -> "Trading Profit"+note fallback.
- Expanded group ke top par "Close" button (income-day-group-close, date + count) -> ek tap me wapas date card collapse. Bahar ka main card as-is.


## Update (11 Oct 2026): Revenue — Trading Profit grouped by date (UI-only)
- Income History me `trading_profit` entries ab date-wise group hoti hain (backend untouched). Ek date par >1 entry -> ONE summary card (ProfitDayGroup, testid income-day-group-trading_profit): "Trading Profit" + date + "N trades" + day TOTAL (income-day-group-total). Tap -> income-day-group-detail me us din ki saari individual entries SAME existing card design (IncomeRow, income-row-trading_profit) me khulti hain; har entry apna trade-detail/note-fallback expand karti hai.
- Single-entry date -> normal IncomeRow (no group). Baaki categories (commission/royalty/direct/etc) bilkul as-is (koi grouping nahi).
- Refactor: `IncomeRow` (self-managed expand) + `ProfitDayGroup` components extract kiye; `displayList` useMemo rows ko local-date se group karta hai; openRow shared state hata diya.
- Verified: testing_agent iteration_31 100% PASS (21 groups + 3 singles, 11 Oct=16 trades / 18 Sep=66 trades, nested expand, trade-detail + note-fallback, no grouping-leak, totals + chart regression OK).

- Confirm step ab inline nahi, ek dedicated centered dialog (average-confirm-dialog, z-110) user mockup jaisa: "?" icon (HelpCircle, blue ring), title "Confirm Average Buy" (average-confirm-title), message "Are you sure you want to buy X.XX USDT more on SYM/USDT for averaging?" (average-confirm-text), summary box {Additional Amount, Estimated New Average, Estimated New Quantity}, buttons Cancel (average-confirm-no) / Confirm (average-confirm-yes, blue #2563EB).
- Main modal me 2 naye rows: "Estimated P&L at Live Price" aur "Recovery Price" (= new avg); primary button "START AVERAGE BUY" -> setConfirming(true). Amounts 2-decimal (buy.toFixed(2)).
- Verified: testing_agent iteration_30 7/7 PASS (dialog render, Cancel return, Confirm executes POST /average 200, dialogs close, card refresh). Cosmetic 12->12.00 fix applied.
- DEPLOY (user VPS /opt/tradeskill, port 8021): Save to GitHub -> `cd /opt/tradeskill && git pull` -> `cd frontend && PATH="/usr/bin:$PATH" yarn build` -> `sudo systemctl restart tradeskill-backend` -> `sudo systemctl reload nginx`. Backend bhi change (naye average endpoints) isliye restart zaroori.

- Bottom 3 cards (AVERAGE/SBM/TP) ab top row (CYCLE/ONE SHOT/SELL NOW) ke EXACT same size/look/layout: `rounded-lg py-1.5 px-1 gap-1`, icon 12, `text-[10px] font-black`, surface bg + border. AVERAGE text/icon color `var(--ink)` (top cards jaisa); TP green, SBM ink.
- AverageModal v2: "Quick Select" chips 25/50/75/100% (average-pct-25/50/75/100) = suggested_buy ke bhaag (100% default pre-filled, active chip gradient). Custom amount input bhi. Chips row sirf tab jab suggested_buy>0.
- Two-step confirm: "Buy" (average-start) turant execute NAHI karta -> "Are you sure?" (average-confirm-text) + No (average-confirm-no) / Yes,Buy (average-confirm-yes). Yes par hi POST /bots/{symbol}/average. Min $10. Backend unchanged (margin_call_count=0 reset, next_buy C1 se).
- Verified: testing_agent iteration_29 100% pass.


## Update (11 Oct 2026): Trade card bottom row — AVERAGE / SBM / TP + manual DCA ('Average')
- USER ask (Hindi): Live bot card ke neeche CYCLE/ONE SHOT/SELL NOW jaisi hi ek nayi 3-button line banao (old DATE->NOW . ROUND + Take Profit badge line ko hata kar). 3 cards = **AVERAGE** (blue), **SBM** (middle, grey), **TP** (green, take-profit %).
- `/app/frontend/src/pages/Trades.jsx` (BotRow): replaced the date/round + TP-badge footer with a `grid-cols-3` row. AVERAGE (bot-average-btn-<SYM>) opens AverageModal; SBM (bot-sbm-btn-<SYM>) -> toast "SBM — Coming soon"; TP (bot-tp-<SYM>) display-only, shows `+{wftPct}%`.
- **AverageModal** (new): on open GET `/api/bots/{symbol}/average-preview`. Shows Current Avg Price, Current Loss, Current Position; an EDITABLE "Buy Amount (USDT)" input (testid average-amount-input) prefilled with `suggested_buy`; live "After This Buy" preview (New Position, New Avg Price, New Down %) recomputed client-side. START (average-start) POSTs `/api/bots/{symbol}/average` {amount}; min $10; buy uses exchange/demo balance (NOT fuel — fuel is only for fees).
- Backend (`server.py`, after sell_now): `GET /bots/{symbol}/average-preview` (returns current_avg_price, current_loss, current_loss_pct, position_qty, live_price, suggested_buy, new_avg_price) and `POST /bots/{symbol}/average` (AverageIn{amount}) -> BUY via _execute_trade(source="manual_average"), then **reset margin_call_count=0** and recompute next_buy_price from C1 margin rule off the NEW avg (Safety Call ladder restarts fresh at C1). Logs bot_event kind "manual_average".
- `suggested_buy` = qty*live (position market value) when in loss -> pulls avg to ~midpoint (loss ~halved); realistic/editable. (Literal "avg == current price" needs ~infinite capital, so rejected after showing user real numbers; user chose editable preview, option b.)
- Verified: backend via curl (preview + POST, mc reset, next_buy from new avg). Frontend via testing_agent iteration_28 — 9/9 acceptance checks PASS (cards render, old date/round gone, SBM toast, editable live preview, START executes + card refresh, min-$10 gating, Cancel).


## Update (06 Oct 2026): Unlimited team count + empty Team card + VPS port fix
- Team count: removed 10-level cap in `_compute_team_stats` and `/referral` BFS loops -> now walks the ENTIRE downline (while frontier; 100k-user safety cap). Note: "Level 1..10" are RANK names, NOT downline depth; team counts all levels unlimited. Affects Dashboard "Team", Rank page total_team, Referral team_stats.total.
- Referral.jsx: "Team" SectionCard (ref-team-card) emptied -> "Coming soon" placeholder (team-card-placeholder); "Direct Referrals" card keeps its data. (User will add a different card there later.) Removed unused `ts` var.
- VPS multi-project PORT conflict RESOLVED: tradego=8001, titan=8011, **tradeskill=8021**. Updated deploy/tradeskill-backend.service (--port 8021) and deploy/nginx-tradeskill.conf (proxy_pass 127.0.0.1:8021). Each project now on unique port -> no more crash-loop/login failures.
- Login incident RCA: tradeskill-backend was crash-looping because tradego/titan held port 8001/8011; nginx proxied /api to wrong project's backend -> "Invalid"/"Not Found". Fixed by dedicated port 8021. Also added Admin Panel "Reset Login Password" (POST /admin/users/{uid}/reset-password, admin-gated) so user passwords can be reset from UI (no SSH).
- VPS build MUST use Node v22 (not v18): `PATH="/usr/bin:$PATH" yarn build` (v18 -> "crypto is not defined").
- DO NOT restore old DB backups (caused jon's TSK100004 password mismatch).


## Update (06 Oct 2026): Coming Soon coins — "Arm Bot for Launch" (pre-trigger)
- USER ask: Coming Soon coin ki Trade Settings me Save ke neeche Start Bot bhi ho, taaki bot pre-armed rahe aur coin list hote hi auto-buy kar le.
- TradeSettings.jsx: Start/Stop button ab upcoming coins par bhi dikhta hai (pehle hidden tha). Labels upcoming par: "Arm Bot for Launch" / "Disarm Bot"; toast "Bot armed! It will auto-buy {COIN} the moment it lists".
- NO backend change needed — engine already safe: _bot_tick fetch_price fail hone par gracefully `return` karta hai (no crash). Bot status=running set ho jata hai; jaise hi coin Binance par list hoti hai, fetch_price succeed -> position_qty==0 -> engine auto first-buy karta hai. (Real feed listings = real Binance symbols, launch par tradable ho jate hain.)
- start_bot pehle se wallet-activation + fuel (>= BOT_MIN_FUEL_BALANCE) + first_buy >= MIN_FIRST_BUY validate karta hai, to arm karne ke liye funded wallet zaroori hai.
- Verified via curl: POST /bots/MONUSDT/start -> running; engine ne gracefully skip kiya (no traceback); disarm (stop) OK.
- NOTE: armed-but-not-listed bot har engine tick par ek warning log karta hai (harmless) jab tak coin list na ho.


## Update (06 Oct 2026): Real coin logos (Binance official) + Gainers badge removed
- USER ask #1: all coins must show real logos like Binance (small movers were showing monogram).
- Solution: backend `_ensure_symbol_images()` now builds a symbol->logo map from Binance's OWN public **get-all-asset** endpoint (`bapi/asset/v2/public/asset/asset/get-all-asset`, ~1091 assets, keyless, the exact logos the Binance app uses). Cached 6h. market_movers attaches `image` = this logo for every row -> **100% logo coverage (50/50 gainers + 50/50 losers, 0 monograms)**. Verified images load with no referer/hotlink block (200 image/png).
- Removed the earlier CoinGecko top-250/500 logo-map approach (incomplete, ~37/50 only). top_market's own list still uses CoinGecko images (fine).
- Frontend: new `CoinLogo` component (fallback chain: backend Binance logo -> coincap icon -> CoinIcon monogram) used in Market coin rows.
- Also per user: Gainers "Live · updated" badge REMOVED from UI — auto-refresh keeps running silently in background (30s poll), just not shown.
- ANSWER to user #2: yes — every 30s the backend re-scans ALL ~362 Binance USDT spot pairs and recomputes top gainers/losers, so any newly-pumping high-% coin appears automatically within ~30s (filters: >=$500k 24h vol, excludes stablecoin + leveraged UP/DOWN/BULL/BEAR pairs).


## Update (06 Oct 2026): Gainers/Losers = REAL Binance movers (full universe)
- BUG (user video): app's Gainers/Losers only re-sorted the top-50-by-market-cap list, so real high-% small-caps (RLC +144%, RAD +48%, API3 +33%, ORCA, VTHO, FIL...) never appeared — unlike Binance which ranks the whole USDT universe.
- NEW backend GET /api/market/movers (public, no auth): fetches full Binance 24hr ticker (BINANCE_PUBLIC/api/v3/ticker/24hr), filters USDT spot pairs (excludes stables + leveraged UP/DOWN/BULL/BEAR), min_volume floor $500k (drops dead/junk pairs), returns top `limit` gainers (chg desc) + losers (chg asc) across the 362-coin universe. Stale-while-revalidate cache, 30s refresh.
- Verified: matches video exactly — RLC +142%, RAD +48%, API3 +32%; losers NFP -66%, PYR -57%, VIC -43%.
- Market.jsx: new `movers` state, polls /market/movers every 30s; Gainers tab -> movers.gainers, Losers tab -> movers.losers; Hot/Market/24hVol stay on /market/top (top-50 mcap). fmtPrice now shows up to 8 decimals for sub-$0.001 coins (e.g. VTHO 0.000749). Rows with no CoinGecko image fall back to CoinIcon monogram. Tap -> /trade-settings/<symbol> works for any Binance symbol.
- Frontend compiles clean. (Screenshot tool captured only the loading spinner due to early-capture timing; verified via endpoint data + clean compile — rows reuse the already-tested Market row component.)


## Update (06 Oct 2026): Daily income resets at 00:00 IST (not UTC)
- server.py: added helpers `IST_OFFSET` (+5:30), `ist_today()`, `ist_date(created_at)` (UTC ISO -> IST calendar date), `ist_day_start_utc_iso()` (UTC ISO of current IST midnight, for Mongo $gte).
- Applied IST daily boundary to all user-facing "today" calcs:
  * `/revenue/income` — Today's Income (all + per category) + 30-day trend dates now IST
  * `/revenue/summary` — today_profit/today_trades + by_day grouping IST
  * `/revenue/pair/{symbol}` — per-pair today_profit IST
  * `/referral` — today_profit IST
  * `/admin/overview` — daily_earning uses ist_day_start_utc_iso() $gte
- Royalty pool daily close (royalty_close_loop) INTENTIONALLY stays 00:00 UTC (shared global rule per earlier PRD) — not changed.
- Verified: IST math unit-tested (20:00 UTC -> next IST day, 17:00 UTC -> same IST day; IST day start = 18:30 UTC). Live curl: revenue/income today=375.84 with trend date 2026-10-06, revenue/summary today_profit=360.52. Backend error-free. Frontend unchanged (just displays values).


## Update (06 Oct 2026): Coming Soon — REAL Binance listing feed
- New backend endpoint **GET /api/market/upcoming** (server.py, after top_market): parses Binance's keyless public "New Cryptocurrency Listing" announcements (bapi CMS, catalogId=48). Filters titles with "Will List", extracts asset via `(SYMBOL)` regex + name, fetches each article detail IN PARALLEL and pulls the first `YYYY-MM-DD HH:MM (UTC)` = trading-open time. Returns ONLY future listings, dedup by asset, sorted by soonest. Stale-while-revalidate cache, refresh every 30 min. Reachable from our US container (HTTP 200) AND user's India VPS — NO API KEY needed. (CoinMarketCal needs a key + was unreachable from container, so Binance chosen.)
- Parsing verified manually (extracted HYPE listing + time). Live endpoint returns {source:"binance", count, coins:[{symbol,asset,name,launchAt,tagline,url}]}. Currently count=0 (no pending spot listing this moment) — correct & expected; populates automatically when Binance announces a new one shortly before listing.
- Frontend /app/frontend/src/lib/upcomingCoins.js: added fetchUpcoming() (shared in-memory _feedCache), whenLabel(), getFeedCache(); getUpcoming()/isUpcoming() now check live feed first then static demo list. Hardcoded UPCOMING_COINS (MON/BERA/EIGEN/ZRO/SCR, dynamic near-term dates) kept as FALLBACK when feed empty so the tab is never blank.
- Market.jsx: Coming Soon tab now renders `comingCoins` (= live feed if any, else demo); refreshes every 5 min. TradeSettings.jsx: fetchUpcoming() on mount then re-resolves getUpcoming(sym) so the Coming Soon banner + countdown + hidden-Start also work for REAL feed coins.
- Frontend-only consumer with fallback to already-tested demo rendering (iteration_27). Webpack clean, backend no errors.


## Update (06 Oct 2026): Market tabs behaviour + Coming Soon listings
- Market.jsx tabs finalized per user:
  * **Hot** = world top 50 coins (sorted by market-cap rank, gold Flame on top 3)
  * **Gainers** = top 50 sorted by highest 24h change % (desc)
  * **Losers** = top 50 sorted by lowest 24h change % (asc)
  * **Coming Soon** (replaced old "New" tab, keeps dot) = upcoming token listings with LIVE countdown timers
- Market list auto-refresh changed 60s -> 300s (5 min) per earlier request.
- Coming Soon data in /app/frontend/src/lib/upcomingCoins.js (UPCOMING_COINS): 5 coins MON/BERA/EIGEN/ZRO/SCR. launchAt computed DYNAMICALLY at module load (now + 6h/29h/53h/77h/101h) so list always shows near-term "Today / Tomorrow / In N days" with ticking HH:MM:SS timers (never goes stale). timeLeft() also self-heals (rolls past dates forward 1yr as safety).
- Tap a Coming Soon coin -> /trade-settings/<SYMBOL>: TradeSettings.jsx shows a "COMING SOON" banner (ts-coming-soon-banner) with name/tagline + live "Launches in" countdown (ts-countdown); Start button HIDDEN (not live yet), Update button relabeled "Save Settings" so users can pre-configure bot strategy before launch. Normal coins unaffected (Start shown, no banner).
- Verified: testing_agent iteration_27 (95%, all structural/routing/regression OK; only stale-date issue flagged -> fixed with dynamic near-term dates, countdown math re-verified). Frontend-only change, webpack compiles clean.


## Update (25 Jun 2026): Trade Settings final polish
- Card order finalized: First buy, Margin call limit, Whole TP ratio, Whole TP callback, Buy-in callback, Sub TP callback, Margin config, Distribution, Open position double, Trade method
- ALL right-side inputs uniform 118×40px (#F0FDF4 bg, 12px radius): value | unit divider format; stepper − N + same size; "Time" text removed
- "Get Suggested Strategy" card REMOVED (suggest fn deleted); only Update button below
- Margin Configuration subpage rows use same uniform inputs

## Update (25 Jun 2026): Trade Settings page (Market coin tap → settings first)
- Market coin tap → /trade-settings/{SYMBOL} (TradeSettings.jsx, 3 internal views: main / Margin Configuration / Distribution And Take Profit); coin card tap → /pair/{SYMBOL} full detail
- MASTER SYNC: Margin call limit N auto-generates N rows in both Margin Config (1st..Nth call: drop % + multiplier Times) and Distribution (N sub-position TP %); limit change re-syncs instantly, backend pads/trims on save (upsert_bot)
- Backend: BotConfigIn += sub_position_tps list; symbol optional (path); server clamps limit 1..50
- NOTE: sub_position_tps stored/edited but engine still books WHOLE-position TP only (per-sub-position TP execution = future work)
- Tested: iteration_25.json — backend 100%, frontend 100%, no bugs

## Update (25 Jun 2026): Login page redesign + same DP everywhere
- Login.jsx rebuilt to reference: dark theme, green chart circle DP (generated asset on static.prod-images...b21714.jpeg), "Trade Skill" gradient, LOGIN TO YOUR ACCOUNT, Username or Email + Password (eye), Forgot Password (toast: contact support), gradient LOGIN
- Same DP used on Sign Up page (LOGO constant in Register.jsx)
- Backend: login now accepts email OR UID (username); tested both

## Update (25 Jun 2026): New Sign Up page (exact reference design)
- Register.jsx rebuilt: logo + "Trade Skill / CREATE YOUR ACCOUNT", Name, Email with in-card Send OTP pill → 6 OTP boxes inside same card → auto-verify ✓ badge (no separate verify button), +CC flag selector + Mobile in one field (no mobile OTP), Password + Transaction Password with eye toggles, Referral + QR scanner (jsQR camera modal, ?ref= URL or raw code autofill), Select Your Leg dropdown (Left/Right mandatory), Terms checkbox, gradient Create Account
- Backend: /auth/signup-otp/send + /auth/signup-otp/verify (sha256, TTL, cooldown, attempts; demo mode returns demo_otp). Register REQUIRES verified email OTP; new fields: country_code, mobile, transaction_password (bcrypt hashed as txn_password_hash), leg
- Referral lookup now matches referral_code OR uid
- E2E tested: OTP send→verify→register with all fields (UID TSK100103) + UI auto-verify flow verified

## Update (22 Jun 2026): FAST deposits — event-based detection (<10s target)
- PRIMARY: deposit_event_loop scans USDT Transfer events (eth_getLogs, 10-block chunks) every 3s on BSC+Polygon — instant per-deposit task
- BACKUP: old balance-poll watcher now runs every 60s (DEPOSIT_WATCH_INTERVAL; pod .env has 45)
- RPC failover: comma-separated URLs + auto backup list (publicnode etc.); binance dataseed blocks getLogs → auto-rotates (sticky)
- INSTANT SWEEP: on detect → credit (CAS) → sweep broadcast immediately (parallel task, per user+net lock); gas top-up wait poll 0.5s
- Dynamic gas already (live gas price +20%)
- LOGS: "DEPOSIT DETECTED (event)" with tx/block/time, "DEPOSIT CREDITED ... detect→credit Xms", "SWEEP BROADCAST ... detect→broadcast Xms", "SWEEP CONFIRMED ... broadcast→confirm Xms"; sweeps doc has detected_at/broadcast_at/confirmed_at/timings
- Verified live on BSC: real USDT transfer detected via event filter in 598ms

## Update (22 Jun 2026): Asset history tap-to-expand details
- Asset page history rows now expand on one tap (like Revenue): shows reason/note, coin (e.g. "Fuel · 25.0% of $1.53 profit · Coin: FIL/USDT") and full date-time; chevron rotates
- /bot-wallet/transactions already returns note+symbol; frontend-only change (Wallet.jsx openHist)

## Update (22 Jun 2026): Full income flow test + fixes
- BUG FIX: /revenue/income kinds was missing "royalty_income" — royalty payouts now appear on Revenue page
- Asset history fetch limit raised to 200; Hindi social-lock error → English
- Test users created in pod DB (kept): demo-child-c1 (child1@test.in, Level 3, TSK900001), demo-grand-g1 (grand1@test.in, Level 1, TSK900002) under admin (set to Level 10)
- Verified on admin test ID Asset history: Direct Income $26.36, Support Income $1.20 + $0.20 (Telegram social), Global Level-03 $7, Royalty — all with icons; self trading income excluded
- User's live-site issue: Telegram $0.20 not showing on tradeskill.in because new frontend not yet deployed there

## Update (22 Jun 2026): Asset page history — income entries added
- Wallet/Asset history now shows (with icons): Trading Commission, Royalty (crown), Direct Income, Support Income, Social Bonus (as Support Income), Global Level-02..10 (team_commission hop N → Level N+1, capped 10, bars icon)
- Self trading income (trade_commission) intentionally EXCLUDED from asset history
- Balance was already credited to bot wallet; only display added (frontend Wallet.jsx KIND_META + rowMeta)

## Update (22 Jun 2026): Daily royalty pool auto-distribution (00:00 UTC)
### Amendment: pools FULLY EMPTY at every cutoff (no carry-forward)
- Unclaimed levels (no activated users) + rounding dust sweep to admin_revenue kind "royalty_reserve"
- Verified: after close ALL 9 levels of both pools = $0.00; royalty_reserve counted inside admin finance-summary company_reserve
- royalty_close_loop background task: closes pools once per UTC day (idempotent via royalty_closes collection), all math UTC
- Each level's pool balance (activation + trading) split equally among ACTIVATED users of that level; empty levels carry forward
- Payout kind "royalty_income" → shows in Revenue as new "Royalty Income" category
- Pool balances now = ledger in − distributions out; /pool/summary returns cutoff_utc + next_cutoff_at + last_distribution
- Pool page note: "Daily cutoff is 00:00 UTC so everyone sees the same rule" + device local time equivalent
- Tested: $30 L5 pool → 3 users × $10, carry-forward for empty levels, idempotent double-run

## Update (22 Jun 2026): Final 25% trading fee distribution
- Commission (differential, cumulative): L1 3.5%, L2 4.25%, L3 5.0%, L4 5.75%, L5 6.5%, L6 7.5%, L7 8.5%, L8 9.5%, L9 10.75%, L10 12.0% (total 12%)
- Trading royalty pool (level-wise, from L2): L2-L5 0.5%, L6-L7 0.75%, L8-L9 1.0%, L10 1.5% = 7% (TRADING_ROYALTY_BY_LEVEL)
- Company 5% + physical meeting 1% = 6%. TOTAL = 25% exact
- Compression: unpaid commission budget → company_reserve. Verified: full chain $25.00 exact, solo trader $25.00 with $8.50 reserve

## Update (22 Jun 2026): Level naming + final $50 activation structure + Pools
- Ranks renamed: Starter/1-9 Star → Level 1..Level 10 (startup migration auto-renames DB users, idempotent — runs on VPS too)
- Direct/Support table: L1 8/0.80, L2 9/0.90, L3 12/1.20, L4 15/1.50, L5 18/1.80, L6 20/2.00, L7 22/2.20, L8 23/2.30, L9 24/2.40, L10 26.36/2.64 (support = 10% rounded 2dp)
- Activation royalty: $2 × Levels 2..10 = $18/activation, level-wise ledger kind activation_royalty (Level 1 gets no royalty but valid level)
- Company 5% ($2.50) + meeting 1% ($0.50) — admin-side only. L10 total: 18+3+26.36+2.64 = $50.00 exact, no reserve. Lower levels leftover → activation_reserve (backend only)
- Trading royalty (1% of profit) now level-wise: equal split L2..L10, kind trading_royalty (adjustable when new 25% trading split arrives)
- New endpoints: GET /pool/summary (both pools level-wise), GET /admin/finance-summary (direct, support, pools, company, meeting, reserve — all separate)
- Pool page (/rewards): main Pool card with Bot Activation Royalty Pool + Trading Royalty Pool, L2-L10 chips
- PENDING: user will give new 25% trading fee distribution next

## Update (22 Jun 2026): New $50 activation distribution structure
- Royalty pool: $2 × 10 levels = $20 per activation
- Company fee 5% = $2.50 (admin_revenue kind company_fee), Physical meeting 1% = $0.50 (company_ledger kind physical_meeting)
- Direct reward NEW table: L1 $8, L2 $9, L3 $12, L4 $15, L5 $18, L6 $20, L7 $21, L8 $22, L9 $23, L10 $24
- Support income = 10% of direct (sponsor's upline). L10 example: 20+2.5+0.5+24+2.4 = $49.40, $0.60 → activation_reserve (backend only, hidden from user dashboard)
- Inactive (non-activated) sponsor/upline earn nothing → their share falls into reserve (existing rule kept)
- Verified end-to-end: full $50 accounted exactly
- PENDING: user will next give new 25% trading fee distribution structure

## Update (22 Jun 2026): Profit % on Trading Profit cards
- Revenue history: profit amount now shows percentage beside it, e.g. "+0.27 USDT (+2.74%)"
- pct = profit / (deal_amount − profit) × 100, computed client-side from trade data (SELL rows only; commission rows unchanged)

## Update (20 Jun 2026): CRITICAL — Trailing TP sell bug fixed
- BUG: pullback sell only evaluated while price >= TP target. Spike to +1.6% then fast drop below +1.5% → sell never fired (user saw 1.6% → 0.9% no sell)
- FIX (_bot_tick): peak stays ARMED after crossing TP; pullback sell now fires even below the target (sells at e.g. +1.3%) as long as price > avg (profit positive). If price crashes below avg, peak disarms and DCA logic resumes
- Take Profit badge (Trades.jsx) now shows real trailing % once armed (can be below base ratio)
- Verified via live engine simulation: armed peak +1.6%, price +1.0% → SOLD, profit booked, cycle completed

## Update (20 Jun 2026): Revenue — Trading Profit details expand
- One-tap expand on Trading Profit history cards now shows: Date (with time), Order Number (real Binance order ID; internal txn id fallback for demo), Filled Quantity (coin), Deal Amount (USDT), Role: Trade Skill Bot (blue), Status: Completed (green)
- Backend: /revenue/income sell rows now carry a `trade` object (quantity, amount, binance_order_id)
- No profit repeat inside detail, same card theme, touchAction manipulation for reliable single tap

## Update (20 Jun 2026): WFT badge on trade cards
- Trades page bot card bottom row now shows a square "WFT" (Waiting For Trigger) badge with the % at which auto-sell fires
- Base = whole_take_profit_ratio; once live/peak price crosses TP, badge % trails upward with peak (peak*(1-callback) vs avg)
- Frontend-only change (Trades.jsx BotRow); data already in GET /bots

## Update (20 Jun 2026): Min $10 First Buy enforced
- Backend: MIN_FIRST_BUY=10 — strategy save (POST /bots/{symbol}) rejects <$10; bot start blocked if saved config <$10
- Frontend: client-side validation + label "First Buy In Amount (USDT) — Min $10"
- Reason: <$5 positions fail to SELL on Binance MIN_NOTIONAL

## Update (20 Jun 2026): Trade card action buttons polish
- Fixed 2-3 tap issue on One Shot/Cycle/Sell buttons (removed active:scale transform on card that cancelled mobile taps; added touchAction: manipulation)
- Slimmed the 3 action buttons (single-line, py-1.5, smaller icons) for professional look
- Confirm popup: instant action on confirm — modal closes immediately, loading toast → success toast (English)
- All Hindi/Hinglish toasts & popup texts converted to English (Trades.jsx, SocialBonus.jsx, ExchangeList.jsx)
- NOTE: Live app on user VPS (tradeskill.in) — user must Save to GitHub + git pull on VPS to apply

## Original Problem Statement
Mobile-responsive crypto trading bot web app cloning HiTechBot's UI/UX. Dark neon theme. Binance API integration for real trading + Demo mode for practice. Features: Dashboard, Trading Pairs, Bot Strategy (DCA/TP), Transactions, Revenue, Referral, Rewards, Wallet, News.

**User Language:** Hindi/Hinglish (Devanagari or Latin script based on user's message).

## Product Vision
Full HiTechBot clone with:
1. Automated DCA + Trailing TP + Trailing DCA trading engine
2. Bot monetization model (activation fee + trading fees)
3. Multi-mode support: Demo / Testnet / Real Binance
4. Mobile-first UI with dark neon aesthetic

## Personas
- **Retail Crypto Trader** — Wants passive automated income from crypto trading
- **Beginner** — Uses Demo mode to learn without risk
- **Serious Trader** — Uses Real Binance API for actual trading

## Core Requirements

### Trading Engine (COMPLETED ✅)
- [x] Immediate first-buy after SELL (HiTechBot style, no re-entry wait)
- [x] Trailing Take Profit (peak chase → sell on pullback)
- [x] Trailing DCA safety orders (trough chase → buy on rebound)
- [x] Cycle mode (infinite loop) & One-Shot mode
- [x] Configurable per-bot: TP%, DCA levels, callbacks, multipliers
- [x] Real Binance + Testnet + Demo mode support
- [x] Referral commission (10% of profit) automated
- [x] **Bot Monetization** — $70 one-time activation fee + 20% trading fee on every profitable SELL, auto-deducted from pre-funded Bot Wallet. Bots auto-pause when wallet balance hits 0. (2026-02, iteration_18 PASS)

### UI/UX (COMPLETED ✅)
- [x] 6-tab bottom nav: Home | Market | Trade | Asset | Bot | Profile
- [x] Trade page with LIVE/OFF filter chips
- [x] Trading Pair detail with DCA Ladder (10 levels visible)
- [x] Trailing states: TP Armed / DCA Armed chips + trackers
- [x] Trade History with expandable KV cards, UTC timestamps, ROI cap
- [x] Revenue page with piecewise bar chart, daily drill-down
- [x] BOT tab (new) with animated hero image (fan glow, circuit traces)
- [x] Wallet page with real vs demo mode indicator + geo-block banner
- [x] Bind API page with restructured Real-mode confirmation modal

### Bug Fixes Completed
- [x] Bot state=='OFF' when backend said running (field mismatch bot.state vs bot.status)
- [x] ROI% showing 199501% (capped display + backend safety on avg_price=0 SELL)
- [x] Bot cycle stopping after SELL when trade_method=None (fixed to check for One-Shot only)
- [x] Duplicate bot docs in DB (deduped + unique index added)
- [x] Wallet showing demo balance in real mode (now shows 0 with error banner)
- [x] Bind API confirm modal button below fold (restructured)

## Pending Backlog

### P0 — Next Session
- [x] ~~**Bot Monetization Model** (HiTechBot-style)~~ — DONE (2026-02)
  - $70 one-time activation fee (deducted from main wallet)
  - 20% trading fee per profitable SELL, auto-deducted from Bot Wallet
  - Deposit / Withdraw between main wallet ↔ bot wallet
  - Full transaction history (activation / deposit / withdraw / trading_fee / pause)
  - Bot Status card: ACTIVE / DEACTIVATE with red-lock or green-check indicator
  - `POST /api/bots/{symbol}/start` blocks trading if wallet not activated or balance = 0
  - Auto-pause: bots stop when balance drains to 0
- [ ] **DOGE Config Fix** — TP 0.001% → 1.5% (immediate impact, quick fix)

### P1 — This Week
- [ ] **Telegram Bot Integration** (`@SmartHubXBot` — token: `8930033871:AAG95Mz_12twvC0Vup5HvV-HdbiD3rxK4pM`)
  - Trade notifications on phone
  - Commands: /positions, /profit, /start_bot, /stop, /balance
  - User linking via Telegram deep link
- [ ] **Preset Buttons** on TradingPair settings — Conservative / Balanced / Aggressive

### P2 — Later
- [ ] **RSI/EMA Smart Entry Filter** — Check indicators before first buy
- [ ] **AI News Sentiment** — Emergent LLM reads news → pause/resume bots
- [ ] **Backend Refactor** — server.py (1720 lines) → routes/services modular split
- [ ] **Bot Auto-Recovery** — Restart stopped bots on balance top-up
- [ ] **Multi-Exchange Support** — Add KuCoin (backup when Binance geo-blocks)

### P3 — Deployment
- [ ] Deploy to Singapore or London region so Binance real trading works
- [ ] IP whitelist update in Binance API after deployment

## Technical Architecture

### Backend (`/app/backend/server.py` — 1720 lines)
- FastAPI + motor (MongoDB async) + python-binance
- Bot engine: async `bot_engine_loop` polls every 10s
- Trade execution: `_execute_trade` handles BUY/SELL in demo/testnet/real modes
- Geographic block: US-region server → Binance blocked. Real trades unavailable until deployment to allowed region.

### Frontend (`/app/frontend/src/`)
- React + Tailwind + Recharts + Motion (Framer)
- Routes: /, /market, /trades, /wallet, /bot, /profile, /pair/:symbol, /transactions, /revenue, /bind-api
- Global BottomNav with 6 tabs

### Database
- Users, Bots (unique index on user_id+symbol), Transactions, BotEvents, BinanceKeys, Referrals

## Test Credentials
See `/app/memory/test_credentials.md`

## Known Limitations
- **Geographic Block**: Server IP `104.198.214.223` (Google Cloud US) is blocked by Binance for both real and testnet endpoints. Fix requires deployment to Singapore/London/EU region.
- **DOGE TP misconfigured**: 0.001% (too tight). User needs to update or we auto-fix.

## Testing Status
- Iterations 8-18 all passed testing agent verification.
- Latest: iteration_18 (bot monetization + activation fee) — PASS.
- Backend pytest suite at `/app/backend/tests/` with 20+ trailing-logic + wallet tests.

## Recent Updates
- **2026-02-05** — Added all 10 Rank Card images (5⭐ Elite, 6⭐ Champion, 7⭐ Master, 8⭐ Legend, 9⭐ Grandmaster, 10⭐ Supreme Legend). Full set 1-10 now in `/app/frontend/public/ranks/`.
- **2026-02-05** — Added "Processing Bar" (progress bar) at bottom of EVERY rank card in `Rank.jsx`. Computes per-rank progress locally from `stats` (direct_count, total_team, downline_ranks). Shows overall % + detailed sub-bars for future ranks; "ACHIEVED 100%" for unlocked ranks. Screenshot-verified for ranks 1, 3, 6, 7, 9.
- **2026-06-12** — App-wide card color unification: added shared `.app-card` class in `index.css` (Home ka exact style: `var(--surface-2)` bg + `var(--border)` + blur(20px) + shadow-sm). Replaced ~40 divergent card patterns (`surface/60`, `surface/50`, `surface/70`, `bg-white/5`, custom gradients) across 14 pages (Market, Trades, Transactions, Referral, Revenue, Rewards, News, Guide, BindAPI, Wallet, TradingPair, Login, Register, BotHub). Hero cards on Wallet/Rewards/TradingPair now use `var(--hero-grad)` matching Home hero. Modals kept solid `var(--surface)`. Screenshot-verified 9 pages.
- **2026-06-12 (part 2)** — Full color palette unification beyond cards: replaced ALL remaining off-theme hex colors in real pages (#FFD700→var(--gold), #FF3B3B→var(--bad), #B8C4D8→var(--text-soft), #7C93AD/#556072→var(--text-mute), #EAECEF→var(--text), #0A0E1A/#1A1500→theme vars). Register logo now uses primary gradient like Login. Deleted 4 dead Demo theme pages (DemoTheme/DemoFintech/DemoCoinstore/DemoPremium) + their routes from App.js — they held all legacy cyan/magenta/teal/purple colors. Zero off-palette hex remains in pages/components. Screenshot-verified BotHub, Register, Trades, Transactions, Rank, Login.
- **2026-06-12 (part 3)** — OFFICIAL PALETTE LOCK (user's design spec): Pure White default (Day), Emerald #16A34A primary, Deep Teal #0F766E, Midnight Teal #083344, Gold #F59E0B (VIP/Premium/Rank only). index.css :root = light theme now; [data-theme=dark] = midnight-teal Night mode (toggle preserved, localStorage key hubxbot-theme-v2 default light). --hero-grad = 135deg emerald→teal→midnight (used on Home balance, Wallet assets, Rewards, Referral, TradingPair panels — all with forced white text). Swept ~70 text-white/bg-white classes to theme vars (dark text on white). app-card radius 20px per spec. Referral hero image replaced with hero-grad. Testing agent iteration_19: 100% pass (15 pages, both themes, 6 modals, all flows).
- Known minor (from tester code review, non-blocking): legacy shadcn HSL vars in index.css @layer base still cyan-ish (unused by pages); testid naming inconsistent between Wallet (wallet-*) and BotHub (btn-open-*).
- **2026-06-12 (part 4)** — Home-recipe gold accents rolled out app-wide (user complaint: inner pages were all-green, no gold). Profile menu icons now mixed gold/green tints (color-mix pattern from Dashboard feature tiles); Wallet hero gold "◆ PORTFOLIO" badge + gold Withdraw tile; Market top-3 rank numbers gold; Trades Exchange Wallet icon gold; BindAPI KeyRound + ShieldCheck gold; Rewards empty Gift gold; News category pills gold; Guide numbered badges alternating gold/green. Screenshot-verified Profile/Wallet/Market/Guide/BindAPI.
- **2026-06-12 (part 5)** — Added 3x2 Quick Access grid on Home (user request from HiTechBot reference video): Bind API, Transactions, Revenue, Referral, Rewards Joining, Rewards Trading. app-card style, alternating gold/green icon tints. Placed between feature tiles and Premium banner. testids: quick-bind-api, quick-transactions, quick-revenue, quick-referral, quick-rewards-joining, quick-rewards-trading. Screenshot-verified.
- **2026-06-12 (part 6)** — Quick Access grid changed to 4x2 (user: "4-4 ke hisab se"). Added User Guide + News cards to complete 8 tiles: Bind API, Transactions, Revenue, Referral, Rewards Joining, Rewards Trading, User Guide, News. Screenshot-verified.
- **2026-06-12 (part 7)** — Removed 3 quick-stat cards (Cumulative PnL, Total Trades, Bot Fuel) from Home per user request; cleaned unused bots/botWallet state from Dashboard.jsx. Screenshot-verified.
- **2026-06-12 (part 8)** — Removed LiveTicker marquee from AppShell (user: "flat hokar kyu chal raha hai"); Balance hero moved to top of Home (right after header, above search) and corners squared (rounded-3xl → rounded-xl). Screenshot-verified.
- **2026-06-12 (part 9)** — Balance hero card recolored to var(--premium-grad) (green→gold, matching Premium Reward banner) per user video request. White text, white-glass action tiles + PREMIUM badge. Screenshot-verified.
- **2026-06-12 (part 10)** — Added user-provided 3D USDT/Tether coin icon (/public/usdt-coin.jpeg) before the balance amount on Home hero card. Screenshot-verified.
- **2026-06-12 (part 11)** — Hero card: removed 24h % pill; PREMIUM badge replaced with dynamic rank badge (Crown icon + "★ Starter" for level 1, "★ N Star" for higher levels, driven by /ranks/me). Bigger $ symbol (earlier request). Screenshot-verified.
- **2026-06-12 (part 12)** — Rank system renamed per user: STARTER, 1 STAR ... 9 STAR (levels 1-10) in backend RANKS config + downline labels; migrated 42 users' rank strings in DB. Dashboard shows dynamic rank title everywhere. Rank.jsx fully rewritten WITHOUT images (user: slow loading) — clean hero-grad cards with gold star + level, rank name, income stats (direct/commission/support), gold processing bar + mini stats. Deleted /public/ranks/*.png. Screenshot-verified cards 1 & 2.
- **2026-06-12 (part 13)** — Rank-up celebration: canvas-confetti installed; Dashboard fires green/gold confetti + "RANK ACHIEVED ★ {title}" overlay when /ranks/me level increases vs localStorage baseline (hubx-rank-level). Fixed bug: Dashboard read rank?.rank but API returns current_level/current_title. Seeded 15 demo team users under admin (demo.team1-15@tgxbot.com, 2 directs + 13 depth-2) -> admin auto-promoted to 1 STAR by existing qualification logic. Screenshot-verified celebration + badge.
- **2026-06-12 (part 14)** — Professional Team view (from HiTechBot reference video): backend /referral enriched with direct_stats (activated/not), team_stats (BFS full-depth totals), today/total profit, per-direct subtree team_size. Referral.jsx redesigned: Activate Profit card, Direct/Team quantification cards (gold/green bar stats), Direct Referrals table (Grade chip + activation dot | masked Account | Team | Date). Verified via curl + screenshots.
- **2026-06-13 (part 15)** — Shared WalletHeroCard component (extracted Dashboard balance hero): used on BOTH Dashboard and Wallet page (demo mode) with identical UI (balance, change pill, rank badge, Deposit/Send/P2P/Swap). Dashboard actions deep-link to /wallet?action=deposit|withdraw which auto-opens the matching modal (useSearchParams). Wallet renamed from "Assets"; live-mode keeps its own premium card. Also: Sun/Moon icons on theme toggle, golden borders on header buttons, Referral polish (boxed stats Total/Active/Inactive order, Team card first, black+gold rank badges, deep green border for active members, compact rows). Screenshot-verified.
- **2026-06-17 (part 16)** — FULL MLM TRADING COMMISSION SYSTEM (P0 done, user's panel spec):
  * 25% profit deduction split: 5% company fee, 1% royalty pool (db.company_ledger), 19% rank budget.
  * Differential commissions: trader gets self commission at own rank %, upline chain gets (their % − highest paid) capped at Master 12%; leftover (>=7%) → company_reserve (admin revenue). Cycle-safe, 20-hop max, scales proportionally on partial fuel deduction. Recipients must have activated bot wallet.
  * New rank table: commission 3.5→12%, direct bonus $6→$33 (+$3/rank). Activation fee $70→$50 (env default changed).
  * Activation distribution: sponsor gets rank-based direct bonus, sponsor's upline gets 10% support income, $2/bot → royalty pool, remainder → admin.
  * Old flat 10% referral commission REMOVED (was double-pay risk). All credits logged as bot txns + rewards(type referral, claimed) → feeds Referral page Today/Total Profit + Commission Log.
  * Helpers in server.py: _rank_pct_of, _company_ledger, _credit_commission, _distribute_trading_deduction. Constants: COMPANY_FEE_PCT/ROYALTY_POOL_PCT/RANK_BUDGET_PCT/ROYALTY_PER_ACTIVATION/SUPPORT_INCOME_PCT.
  * TESTED: manual e2e script (tests/test_mlm_manual.py) PASS exact math; activation flow via API PASS ($50 = $9+$0.90+$2+$38.10); bot_wallet pytest 19/19 pass (expectations updated for new rules). Live verification: admin Commission Log shows real self-commissions from running bots.
  * KNOWN STALE TESTS (pre-existing, data-drift, unrelated to MLM): test_bots_list counts, test_cycle_reset, test_roi_cleanup, test_revenue_match_video, test_wallet_real_mode (admin now demo mode), test_tgx_backend start_stop (predates fuel requirement).
- **2026-06 (part 17) — REAL CRYPTO WALLET INTEGRATION (P0 DONE, iteration_20 PASS 100% backend / all frontend flows)**:
  * Master mnemonic stored SECURELY in backend/.env (MASTER_MNEMONIC — NEVER print/log). Master = gas wallet, HD index 0: `0x5aA5004E23B39D0368b765e4FDF47f6747F7e84F`. Admin collection wallet: ADMIN_WALLET_ADDRESS in .env.
  * New module `/app/backend/chain_wallet.py`: BIP44 ETH derivation (bip_utils), web3 v7 (ExtraDataToPOAMiddleware), USDT contracts BSC (18 dec) + Polygon (6 dec), get_usdt_balance/get_native_balance/send_usdt (from master index 0, gas+balance checks).
  * DEPOSIT: GET /api/bot-wallet/deposit-address assigns sequential HD index per user (db.counters), same EVM address for BSC+Polygon. deposit_watcher_loop polls both chains every 45s (DEPOSIT_WATCH_INTERVAL env), credits diff vs onchain_credited.{net} baseline → bot wallet + "deposit_onchain" txn. TRC20 = Coming Soon (mocked).
  * WITHDRAWAL: POST /api/bot-wallet/withdraw with address → pending request (2 USDT fee, $10 min, login-password verify, BEP20/POLYGON only). GET /api/bot-wallet/withdrawals, POST .../cancel (refund). Internal withdraw-to-main unchanged.
  * ADMIN QUEUE: require_admin dep. GET /api/admin/withdrawals, POST .../approve ({manual:true} = mark paid; else real on-chain USDT send from master → tx_hash stored), POST .../reject (refund + reason), GET /api/admin/treasury (master addr + USDT/gas balances both chains). Polygon RPC switched to polygon-bor-rpc.publicnode.com (polygon-rpc.com gives 401).
  * P2P by address = INTERNAL lookup of chain_deposit_address (case-insensitive) → instant free transfer; unknown address 404. Frontend By-Address tab: no network select.
  * FRONTEND: BotHub deposit modal (Crypto QR/copy/network chips + Main Wallet tabs, qrcode.react), withdraw modal (fee info, password, request rows + cancel), AdminWithdrawals.jsx page /admin/withdrawals (treasury card, pending/history tabs, Pay On-chain / Mark Paid / Reject) with role guard + Profile admin menu item.
  * NOTE: Master wallet has 0 gas/USDT — "Pay On-chain" returns 400 until user funds it with BNB/POL + USDT. Tests: /app/backend/tests/test_hd_wallet.py (20/20 pass).
- **2026-06 (part 18) — PREMIUM DEPOSIT QR REDESIGN (user's Binance-level spec, screenshot-verified)**: New /components/CryptoLogos.jsx (inline SVG official logos: BNB gold, Polygon purple, TRON red, Tether data-URI). Deposit crypto tab: 3 logo network cards (selected = gold border + green glow .net-glow), selected network name+logo above QR, QR in green→gold gradient border (rounded, qr-float CSS animation) with USDT logo excavated center (level H), "Wallet Address (TAG)" label block, copy button green-check success animation (.copy-pop) + clipboard fallback, removed "Same address works" line, single "Send only USDT on X" + "auto-credited ~1 minute" notices with check icons, bottom Coin/Network/Secure info row. ModalShell now max-h-[88vh] overflow-y-auto.
- **2026-06 (part 19) — UNIFIED BALANCE SYSTEM (user command, iteration_21 100% pass)**: Single balance source = bot_wallets.balance. Dashboard = Wallet(Assets) = Bot page, always identical. wallet_summary demo mode returns total_usdt=wallet_usdt=bot_wallet_balance. Activation fee $50 now deducted from unified (bot) wallet (user confirmed). _credit_admin_revenue credits admin BOT wallet + 'revenue' txn. DISABLED: POST /bot-wallet/deposit (main→bot, 400) and internal withdraw-without-address (400) — prevents demo-$1000 exploit. Demo wallet_usdt=1000 stays HIDDEN internally for demo trading engine only. Dashboard/Wallet action buttons deep-link /bot?action=deposit|withdraw|p2p (BotHub auto-opens via searchParams). BotHub deposit modal crypto-only (Main Wallet tab removed), withdraw requires address+password always. Wallet History = bot wallet transactions, sign derived from amount. Old tests: test_bot_wallet.py deleted (outdated), replaced by tests/test_unified_wallet.py (9/9 pass).
- **2026-06 (part 20) — PREMIUM WITHDRAW MODAL + GMAIL OTP (e2e verified via curl + playwright)**: New /components/WithdrawModal.jsx (dark green #0B2A1B + gold #F5C518 premium theme, independent of day/night): 5-step stepper (Request→Email OTP→Verify→Password→Success), balance card w/ Tether logo + Secure&Safe badge, network logo chips (TRC20 Soon), address+QR scan (own html5-qrcode id wd-qr-reader), amount + 25/50/75/Max + Maximum Available + fee preview, Gmail OTP section (masked email, Get OTP w/ Gmail icon, 6 OTP boxes auto-advance/paste, 60s resend countdown, VERIFIED badge), password w/ eye toggle, glowing submit, 4 security badges, success screen w/ details. BACKEND: POST /bot-wallet/withdraw/otp/request (6-digit sha256-hashed, 5min TTL, 60s cooldown, 5 attempts max) + /otp/verify; /bot-wallet/withdraw now REQUIRES verified+unused OTP (15min window, single-use). EMAIL_OTP_MODE=demo in .env → OTP MOCKED (returned as demo_otp + shown in UI + backend log). For real email: set EMAIL_OTP_MODE=smtp + GMAIL_USER + GMAIL_APP_PASSWORD in backend/.env (_send_otp_email ready).
- **2026-06 (part 21) — SOCIAL MEDIA BONUS CENTER (iteration_22 100% pass backend+frontend)**: /social-bonus page (SocialBonus.jsx, entry card on BotHub btn-social-bonus). 6 platforms: Telegram, Instagram, X, YouTube, Facebook, WhatsApp (user-requested add) — $0.20 each, total $1.20. Flow: FOLLOW (opens placeholder URL t.me/hubxbot etc., marks followed) → CLAIM (atomic $ne guard vs double-claim, credits unified bot wallet, logs bot txn kind=social_bonus note='<Platform> Follow Reward'). Backend: GET /api/social-bonus/status, POST /follow/{id}, POST /claim/{id} (server.py ~2653-2719, db.social_bonus {user_id, claims.{platform}.{followed,claimed,claimed_at}}). Tests: tests/test_social_bonus.py 10/10 pass. FIXES this session: missing Gift import in BotHub.jsx (crashed /bot — fixed by testing agent), Wallet history now shows txn note under kind, Wallet.jsx load() retries once on transient /wallet/summary failure (was leaving page at $0/empty). NOTE: social URLs are PLACEHOLDERS — user to provide real links later. UPDATE (user video request): Home promo banner (promo-banner, was "Premium Reward Win $100 Fuel Bonus"→/rewards) now shows "Social Media Bonus — Earn $1.20 USDT Free"→/social-bonus; BotHub entry card (btn-social-bonus) removed (shifted to Home).
- **2026-06 (part 22) — SOCIAL BONUS ANTI-CHEAT VERIFICATION (user option C: Hybrid, curl + playwright e2e verified)**: CLAIM ab bina verify ke possible nahi. New flow: FOLLOW → username input (regex @?[A-Za-z0-9_.]{3,32}) → OPEN & FOLLOW (link + follow_started_at server timestamp) → 15s "VERIFYING Ns" countdown (server_time offset-safe) → VERIFY (POST /social-bonus/verify/{id}: timer check server-side, early=400) → CLAIM. Backend: follow endpoint now requires {handle} body, verify endpoint sets followed=True only after delay; claim unchanged (requires followed). TELEGRAM REAL MODE (code-ready, needs env TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL + PUBLIC_BASE_URL): getChatMember membership check, deep-link /start CODE linking via GET /social-bonus/telegram/link + POST /api/telegram/webhook/{TELEGRAM_WEBHOOK_SECRET} (setWebhook on startup), 428 TG_CONNECT_REQUIRED → frontend CONNECT button. Without token Telegram falls back to timer mode. SOCIAL_VERIFY_DELAY env (default 15s). db.social_bonus claims.{p} now stores handle/follow_started_at/verified_at; telegram:{tg_user_id,tg_username}; db.tg_link_codes.
- **2026-06 (part 23) — SEQUENTIAL SOCIAL BONUS (user command, curl + playwright verified)**: Username submission REMOVED (follow endpoint no body now). X (Twitter) platform REMOVED. Fixed order: 1) Telegram 2) WhatsApp 3) Instagram 4) Facebook 5) YouTube — total $1.00. Sequential lock: platform N unlocks ONLY after platform N-1 claimed (_social_locked helper; enforced in follow/verify/claim = 400 "Locked — pehle pichla platform claim karein"; status returns locked flag). Frontend: locked cards greyed (opacity 0.6, grayscale logo, LOCKED badge locked-{id}, subtitle "Pehle X claim karein"). Home banner updated to $1.00 / 5 channels. Telegram real-time bot check still code-ready (needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL env; timer fallback active until then).
- **2026 (part 24) — ASSETS PAGE B&W REDESIGN (user screenshot spec, playwright verified day+night)**: User wants MOSTLY black&white combo w/ green+gold accents; applied to Assets page ONLY for now (user choice a). Wallet.jsx: hero replaced with B&W card (assets-bw-card): "Total assets converted (USDT)" + Eye/EyeOff toggle (assets-eye-toggle, ****), big 4-decimal black total + "≈ X.XX USDT", black Tether coin SVG, 3 outlined black-border buttons Deposit/Withdraw/Transfer → /bot?action=. "History record" heading + "Choose date" calendar picker (hidden date input history-date-input, client-side day filter, X clear history-clear-date — X rendered only when filtered, input removed to avoid overlay swallowing click). History rows: separate white cards, plain black lucide icon per kind (KIND_META map: deposit/withdrawal/transfer in-out/activation fee/bot fuel/trade+team commission/support income/direct bonus/revenue/trading fee/social bonus), bold title + note + M/D/YYYY H:MM:SS date, green 4-decimal "X.XXXX USDT" amount (red w/ minus for outflows) + chevron. Removed WalletHeroCard usage + rank/change24h calls from Wallet page. Night mode auto-adapts via vars. NOTE: app-wide B&W theme = user backlog ("baaki app baad me"). Also fixed lint: removed unused fastapi `status` import.
- **2026 (part 25) — MARKET PAGE "RANKING" B&W REDESIGN (user screenshot spec, playwright verified)**: Market.jsx rewritten to Binance-style Ranking: header "Ranking", 6 text tabs (Hot/Gainers/Losers/New•/24h Vol/Market, black underline active, tab-{id} testids), Crypto pill (blue→green gradient) + Futures pill (Coming Soon toast), column headers Name/Last Price⇅/24h chg%⇅ (col-sort-price, col-sort-chg toggle asc/desc override), rows = separate white cards: 42px coin icon, bold black symbol, gold Flame on top-3 in Hot, price (adaptive 2/4/5 dp) + ₹INR sub-price (live USD→INR via open.er-api.com, fallback 86), solid red/green change pill (+X.XX%). Search bar removed (not in reference). Live Binance WS ticker kept. Removed old rank#/name/sort-chips UI. UPDATE: cards compacted to reference proportions (30px icon, 13.5px symbol, 13px price, 72px change pill, py-2) after user said too big; full 50 coins verified (earlier only 8 due to CoinGecko 429 stale cache — refreshed via ?force=1). Sub-price INR→USDT per user ("Price USDT me karo"): second line now "X.XX USDT", INR/er-api fetch removed.
- **2026 (part 26) — ASSETS: OPEN POSITIONS REMOVED + SUMMARY SPEEDUP (user demo photo, verified)**: Wallet page ab sirf B&W balance card + History record dikhata hai (Open Positions section deleted per user). Backend /wallet/summary: per-bot fetch_price calls ab asyncio.gather se PARALLEL (9 positions: ~9s → 1.1s) — fixes recurring intermittent blank-wallet load. Frontend load() retry 1→2.
- **2026 (part 27) — ASSETS EXACT-MATCH POLISH (user: "same to same, ek bhi change nahi")**: PageHeader ("Wallet · Assets Portfolio") REMOVED — balance card directly at top. History rows compacted to Market card size (px-3 py-2, icon 22, title 13.5px, amount 13px). Note line removed from rows (title + datetime only). trade_commission renamed "Trade Commission"→"Trading Profit" per reference names (Support Income/Trading Profit/Trading Fee/Activation Fee/Deposit/Withdrawal already match).
- **2026 (part 28) — HISTORY LABELS LOCKED TO 6 (user command)**: History me ab SIRF ye 6 labels: Support Income (Users icon: team/direct commission, direct bonus, revenue, social bonus), Trading Profit (ChartNoAxesCombined: trade_commission), Trading Fee (Coins: trading_fee, fuel, pause — "Bot Fuel" label removed), Activation Fee (FilePlus2), Deposit (ArrowDownToLine: deposit, deposit_onchain, p2p_received), Withdrawal (ArrowUpToLine: sab withdraw kinds + p2p_sent + refund). Icons demo-photo matched. Verified no old labels remain.
- **2026 (part 29) — HISTORY ICONS: SOLID PURE-BLACK (user correction msg)**: lucide outline icons replaced with custom Material-filled inline SVGs (fill var(--ink); new CSS var --ink: #000 light / #F8FAFC dark in index.css): IconPeople (Support Income), IconProfit (bars+arrow, Trading Profit), IconCoins (stack+coin, Trading Fee), IconDocPlus (Activation Fee), IconDeposit (down arrow+tray), IconWithdraw (up arrow+tray). Row proportions matched to reference: icon 28, title 15px bold var(--ink), date 12px grey, amount 15px green/red 4dp, chevron 18 black, px-4 py-2.5 space-y-2.5. Screenshot verified.
- **2026 (part 30) — CARD SIZE STANDARD LOCKED (user mandate, /app/memory/design_standards.md created)**: History rows now EXACTLY Market card size (measured 51.25px == 51.25px): rounded-xl px-3 py-2 gap-2.5 space-y-1.5, icon 30, title 13px font-black leading-tight, sub 10px, amount 13px, chevron 16. USER RULE: EVERY future list card in the app must use this Market card size — see design_standards.md.
- **2026 (part 31) — ASSETS ACTIONS = DASHBOARD 4 (user)**: Assets balance card ke buttons ab Dashboard hero jaise 4: Deposit / Send / P2P / Swap (grid-cols-4, same B&W outlined style). Deposit→/bot?action=deposit, Send→withdraw, P2P→p2p, Swap→Coming Soon toast. testids: wallet-deposit/send/p2p/swap.
- **2026 (part 32) — REVENUE PAGE REBUILD (user mockup, backend+frontend self-tested)**: New GET /api/revenue/income: categories {trading_profit (SELL P&L from db.transactions, positive only), trading_commission (trade_commission kind), direct_income (direct_bonus), support_income (support_income+social_bonus), global_1..10 (team_commission by level parsed from note suffix "· L{n}" — note format UPDATED in MLM differential loop to append level)}; returns all/categories today+total, 30d trend (master), history[400]. Frontend Revenue.jsx rewritten per mockup: custom header (back, Revenue + subtitle, calendar), 2 stat cards TODAY'S/TOTAL INCOME (solid black bars/coin-stack icons, green +USDT, values FOLLOW selected tab), INCOME TREND green AreaChart = MASTER (never changes per tab, user rule), scrollable gradient tab pills (All active = blue→green), Income History rows in LOCKED Market card size, solid black icons (bars=Trading Profit/Commission, 3-person=Support, person+plus=Direct, crown=Global Royalty), tap row → expand detail (note + full time). Old trade-P&L Revenue UI replaced; /revenue/summary endpoint kept (unused by page now).
- **2026 (part 33) — CATEGORY EARNING CARDS (user spec doc, self-tested)**: Top overall Today's/Total Income = ALWAYS master all-data (never changes per tab). Non-All tab select → 2 new cards between tabs & history: TODAY EARNING + TOTAL EARNING of selected category (category ka apna icon, green amounts, locked card size); All tab = no extra cards. Icons SINGLE-SOURCED in /app/frontend/src/components/IncomeIcons.jsx (Wallet + Revenue dono import — user rule: Trading Profit icon = Assets exact icon). Trading Commission icon = % (percent). Verified: All=0 cards, trading_profit cards show +534.81, commission +13.08 w/ only its history, top total unchanged across tabs.
- **2026 (part 34) — COMMISSION ICON + HEADING LOGIC (user final)**: Trading Commission icon = hand holding $ coin (IconHandDollar in IncomeIcons.jsx, per user image "Use this"). "Income History" heading + subtitle ONLY on All tab; individual tabs = Today/Total Earning cards → direct history (no heading). Verified.
- **2026 (part 35) — INCOME MAPPING CORRECTED (user rule, curl verified)**: Trading Profit = SELF trading income (bot SELL P&L + trade_commission self-commission). Trading Commission = TEAM ka commission (team_commission kind, level/rank differential). Global Level-N tabs = wahi team commission LEVEL-wise filtered (backend adds level field parsed from note "· L{n}", buckets into both trading_commission + global_{n}; All total counts each row ONCE). Frontend: global tab filters category=trading_commission && level===n, rows show crown + "Global Royalty Level-0N" title on global tabs. Admin verify: trading_profit 547.89 (534.81+13.08 merged), demo.team1 has L1 team commission 1.0.
- **2026 (part 36) — ASSETS HISTORY = WALLET TXNS ONLY (user lock)**: Assets History ab sirf Deposit / Withdrawal / Activation Fee / Trading Fee dikhata hai — saare income kinds (support/commission/bonus/revenue/social) Assets se REMOVED (wo Revenue page par hain). KIND_META trimmed + rows filtered by KIND_META membership. Same locked card size/icons. Verified: labels only [Trading Fee, Withdrawal] for admin, no income labels.
- **2026 (part 37) — NAV SWAP (user)**: Bottom nav: BOT tab removed → REVENUE tab (ChartNoAxesCombined icon, nav-revenue) Asset ke bagal me. Bot entry Profile menu me top par (profile-bot → /bot). Both navigations verified.
- **2026 (part 38) — ASSETS INSTANT LOAD (user: "nano second me dikhna chahiye")**: (a) Backend: fetch_price_cached (10s TTL in-memory _PRICE_CACHE) used in /wallet/summary → response 1.1s → 0.14s. (b) Frontend: cache-first render — Wallet mount par localStorage tgx_wallet_cache se summary+history INSTANT dikhta hai, background me fresh load hokar cache update. Verified: 150ms ke andar balance 86.4197 + history rows visible.
- **2026 (part 39) — REVENUE INSTANT LOAD (user)**: Same cache-first pattern on Revenue (localStorage tgx_revenue_cache) — 150ms me total +549.99 & 100 rows verified.
- **2026 (part 40) — TRADE PAGE CLASSIC REBUILD (user spec + mockup, self-tested)**: Trades.jsx (nav Trade tab) fully rewritten: header "Trade" + "{n} BOTS · {r} RUNNING" + Guide btn (→/bot), Binance exchange card (→/bind-api, Live green dot if bound else Demo), 3 equal summary cards (Active/Total/Total Profit green), Live|All|Idle segmented filter (selected = black pill), bot cards (PAIR/USDT, CYCLE·RUNNING/IDLE, ●Live/Idle + kebab, Live Price via useBinanceStream, Floating P&L green/red w/ %, dates start→NOW/end · ROUND n, Buys green · Sells red), full-width New Bot btn (blue→emerald gradient →/market). Pure white bg (.trade-page css, dark-mode fallback), locked card family style, cache-first instant load (tgx_trade_cache). Filters verified 1/9/8. UPDATE: All filter tab removed (user) — only Live | Idle, default ALWAYS "live" on entry.
- **2026 (part 41) — MARKET INSTANT LOAD (user)**: (a) Backend /market/top: stale-while-revalidate — expired cache turant serve, CoinGecko refresh background task me (_TOP_REFRESHING flag) → response always ~0.13s. (b) Frontend Market.jsx cache-first (tgx_market_cache) + empty-response guard (never wipes list). Verified: 50 coins 150ms me visible.
- **2026 (part 42) — SESSION MISC (all verified)**: Trade page: header centered medium (Revenue-style) + back arrow left (trade-back), Live/Idle selected pill = blue→green gradient, All tab removed, default filter always "live". Assets: balance number + Tether coin GREEN (var(--good)), balance card STICKY top (scroll par fixed, history neeche slide — sticky top-0 z-20 wrapper w/ bg). Market instant cache. Bot card pair names PAIR/USDT format.
- **2026 (part 43) — REVENUE STICKY TOP + STICKY ROOT-CAUSE FIX (verified)**: Revenue header + Today's/Total Income cards ab sticky top (scroll par fixed, trend/tabs/history neeche slide). CRITICAL FIX: AppShell ke outer div se `overflow-x-hidden` REMOVED — ye position:sticky ko app-wide tod raha tha (shell sticky-containing scrollport ban jata tha jo khud scroll nahi hota). Ab window-scroll ke against sticky sahi kaam karta hai (Assets + Revenue dono). No horizontal overflow regression (body 390/390). Verified: 1200px scroll par Revenue sticky top=0. Also this session: Support Income icon → 3-person Material groups (user), Trading Profit → rounded bars + curved arrow, Trading Fee → outline coin stack + front coin (reference-matched).
- **2026 (part 44) — REVENUE FULL STICKY TOP (verified)**: User video request — Income Trend graph + category tabs (All/Trading Profit/...) bhi sticky honge. Sticky wrapper ab header + income cards + trend graph + tabs + category earning cards sab cover karta hai; sirf Income History scroll hoti hai. Screenshot-verified: 800px scroll par trend y=147, tabs y=337 fixed.
- **2026 (part 45) — ASSET PAGE PAN/JIGGLE FIX (verified)**: User video — page left/right/up/down pan ho raha tha mobile par. Fixes: (1) `html, body { overflow-x: clip; overscroll-behavior-x: none; }` in index.css — `clip` sticky-SAFE hai (scroll container nahi banata, `hidden` mat use karna). (2) viewport meta: `maximum-scale=1, user-scalable=no` — pinch-zoom pan band. (3) Balance row: nowrap + truncate on ≈ text, left block flex-1 min-w-0, TetherCoin shrink-0 — 360px par bhi card ke andar sab fit. Verified 360/390px: scrollW==innerW, wallet+revenue sticky intact.
- **2026 (part 46) — TRADE PAGE STICKY TOP (verified)**: Header + Binance exchange card + summary cards + Live/Idle filter sab sticky wrapper me (sticky top-0 z-20, bg var(--bg-base)); sirf bot position cards + New Bot button scroll hote hain. Verified: scroll par filter y constant.
- **2026 (part 47) — MARKET PAGE STICKY TOP (verified)**: Ranking header + Hot/Gainers tabs + Crypto/Futures pills + Name/Price/24h column headers sticky wrapper me; sirf coin rows scroll. Verified: 1200px scroll par col header y=155 constant.
- **2026 (part 48) — BOT STOP=CLOSE + FRESH START (verified via curl)**: User complaint: idle bot restart par purani position resume hoti thi → stale profit par 25% fee ka bada cut (UNI ~28). Fixes in server.py: (1) `stop_bot` ab open position ko current market par SELL karke close karta hai (P&L wahin book, source="bot_stop", bot_event "stop_close"). (2) `start_bot` FRESH START: stale position ho to demo me cost-basis refund (no profit/no fee, event "fresh_start_refund"; real mode me market sell), phir sab cycle state reset (qty/avg/mc_count/cycles=0) + `session_started_at` set. (3) `list_bots`: buy/sell counts + date range ab session-scoped (session_started_at se); cumulative_profit LIFETIME hi rehta hai (Total Profit card reset nahi hota). Tested: UNI stop→close (-0.25 booked, proceeds credited), ADA start→140 refund + fresh, engine fresh buy, counts session-fresh.
- **2026 (part 49) — IDLE TAB = READ-ONLY TRADE HISTORY (verified)**: Idle tab ab har trade kiye gaye coin ki lifetime history dikhata hai (running coins bhi included) — Total Profit, Trades Done (lifetime sells), Buys/Sells, lifetime date range. Cards NON-clickable (koi action nahi, HistoryRow div in Trades.jsx). Backend list_bots ab lifetime_buy_count/lifetime_sell_count/lifetime_first_at/lifetime_last_at bhi return karta hai. Live tab unchanged (actionable BotRow).
- **2026 (part 50) — LIVE SORT BY PROFIT% + EXCHANGE LIST (verified)**: (a) Trade Live tab ab floating P&L% ke descending order me sorted (parent-level WS stream + REST seed /market/pairs se prices; container me WS geo-blocked isliye preview me ties, user device par sahi). Idle history profit desc sorted. (b) NEW /bind-api = ExchangeList.jsx: Top 25 exchanges CMC rank order (1 upar, 25 neeche), sabhi API-supported. Binance row → /bind-api/binance (purana BindAPI form). Baki rows → "Coming Soon" toast. Bound/Not Bound status badge.
- **2026 (part 51) — REAL EXCHANGE LOGOS (verified)**: Sabhi 25 exchanges ke official logos CoinGecko CDN (coin-images.coingecko.com/markets/images/...) se ExchangeList.jsx me added. Fallback: colored circle + monogram (img onError hide). Screenshot verified top→bottom sab logos load.
- **2026 (part 52) — EXCHANGE CARD SIZE = MARKET COIN CARD (verified)**: ExchangeList rows ab Market coin rows jaise compact: px-3 py-2, gap-2.5, 30px logo, text-[13.5px] name, space-y-1.5. Measured: exchange row 51.9px ≈ market row 51.3px.
- **2026 (part 53) — EXCHANGE PAGE REDESIGN + NAV ORDER (verified)**: (a) /bind-api ab reference-design me: sticky top (header "Api Binding Exchange" text-[17px] nowrap + Guide btn + green CONNECTED EXCHANGE featured card with Binance/verified badge/Live-Demo status/3 feature columns + "Other Exchanges" heading); sirf 24 other-exchange rows scroll (rank 1-24). Sticky verified (card y constant on 900px scroll). (b) BottomNav order changed: Home, Market, Trade, Revenue, Asset, Profile.
- **2026 (part 54) — CONNECTED CARD CONDITIONAL (verified)**: /bind-api par CONNECTED EXCHANGE card ab sirf tab dikhta hai jab user ne API bind kiya ho (GET /binance/bind ab `bound` field return karta hai: mode real/testnet = true). Not bound → full 25 list ("All Exchanges") scroll, Binance row #1 → bind form. Bound → Binance top sticky card ("Live"), baki 24 scroll. Dono states curl+screenshot verified.
- **2026 (part 55) — TRADE PAGE CLEANUP (verified)**: Active Bots / Total Bots / Total Profit summary cards Trade page se REMOVED (user request). Exchange card ka inline SVG → official Binance logo (CoinGecko CDN img + monogram fallback). Layout: header → exchange card → Live/Idle filter → bot list.
- **2026 (part 56) — HOME BANNER CAROUSEL (verified)**: Dashboard se WalletHeroCard (balance hero) REMOVED — uski jagah BannerCarousel.jsx (5s auto-slide, dots, localStorage cache, aspect 1952/806). Backend: `banners` collection, GET /api/banners (public), POST /api/admin/banners {image_url} + DELETE /api/admin/banners/{id} (role=admin only) — future admin panel ready. Startup seed: 2 user-provided banners (AUTOMATIC WITHDRAWAL + YOUR TRADING PARTNER, customer-assets URLs). User 3 aur images baad me dega (total 5). 8 home cards unchanged. Screenshot verified: slide 1→2 after 5s.
- **2026 (part 57) — HOME 8 CARDS B&W (verified)**: Dashboard ke 12 cards (4 feature tiles + 8 quick grid) → sirf 8 cards ek grid me: Bind API, Bot, Refer(/referral), Team(/referral), Rank, Pool(/rewards), User Guide, News. PURE BLACK icons (var(--ink)) white cards par — user ke mockup photo jaisa. Screenshot verified 8 labels.
- **2026 (part 58) — HOME BLUE-GREEN ACCENTS (verified)**: Dashboard.jsx me saare golden accents → Market ke Crypto pill wala blue-green: gold-grad/premium-grad → linear-gradient(90deg,#2563EB,#10B981); var(--gold) → #2563EB; glows → rgba(37,99,235,...). Rank card, progress bar, Social Bonus banner, rankup modal sab blue-green. (CSS vars untouched — baki pages par gold jaisa tha waisa hai.)
- **2026 (part 59) — MARKET SECTION → SHOWCASE IMAGE (verified)**: Home se Market/Top Movers list REMOVED; uski jagah user-provided Trade Skill robot image (yohyuz3i_...png, square, rounded-2xl). START AUTO TRADING BOT button image ke theek niche unchanged.
- **2026 (part 60) — BOT PAGE CLEANUP (verified)**: BotHub HERO_IMAGE → nayi Trade Skill robot image (same as home showcase). Transaction History button + Withdrawal Requests history section REMOVED. Page ab: image → RANK LEVELS → BOT STATUS/ACTIVATE → HOW IT WORKS. Koi history nahi.
- **2026 (part 61) — CTA BLUE-GREEN (verified)**: Home START AUTO TRADING BOT button + Bot page ACTIVATE•$50 button → linear-gradient(90deg,#2563EB,#10B981) white text; ACTIVE status text → gradient text (background-clip).
- **2026 (part 62) — STOP PAR FUEL FEE NAHI (verified via curl)**: User complaint: bot stop karne par close-profit par bhi 25% fuel katata tha ("double fee" feel). Fix in _execute_trade (dono demo + real paths): `if profit > 0 and source not in ("bot_stop", "fresh_start")` tabhi _charge_trading_fee. Ab fuel SIRF take-profit/manual profit-book par katata hai; stop-close profit book hota hai par fee-free. Tested: UNI stop +$1.14 profit booked, zero fuel txn. Note: data audit me koi actual double-charge nahi mila tha (har fee ek TP sell ka 25%), par user ki demand ke मुताबिक stop par fee hata di.
- **2026 (part 63) — REBRAND: TGX BOT/HUBXBOT → TRADE SKILL (verified)**: Frontend (Login, Register, BotHub, Guide, BindAPI, Referral, index.html title), backend (FastAPI title, welcome bonus note, OTP emails, address lookup error, startup log) + DB seeded docs (news, guide) sab "Trade Skill". Naye referral codes ab "TS" prefix (purane TGX codes valid rehte hain). Screenshot verified: page text me zero TGX/HUBX.
- **2026 (part 64) — PROFILE REDESIGN + UID SYSTEM (verified)**: (a) Backend: sequential UID system — `counters` collection se `_next_uid()` (TSK100000 se), register par assign, startup migration me sabhi purane users ko created_at order me UID mila (admin=TSK100000). /auth/me me uid included. (b) Profile.jsx full redesign mockup jaisa: identity card (gradient avatar+pencil, verified badge, email/joined/UID/country India rows, TRADE SKILL shield), CURRENT RANK card, NEXT RANK card (Coming Soon pill, blue-green progress %, Directs x/y, Team x/y from /ranks/me), WALLET BALANCE card + View Wallet gradient btn, 4 tiles (Security Centre, System Setting, Support, Bonanza), admin Withdrawals link, logout. Screenshot verified UID TSK100000.
- **USER'S DOMAIN/VPS**: tradeskill.in + VPS 187.127.98.41 (India, Binance geo-block bypass ke liye). Emergent apne VPS pe deploy nahi karta — GitHub export → VPS self-host recommended path bataya.
- **2026 (part 65) — VPS DEPLOYMENT PACKAGE (created)**: /app/deploy/ folder: README_HINDI.md (step-by-step Hinglish guide), setup_server.sh (Ubuntu: Python3.11, Node20+Yarn, MongoDB7, Nginx, Certbot), deploy_app.sh (venv+pip, yarn build, systemd, nginx), nginx-tradeskill.conf (/api proxy → 127.0.0.1:8001, React build serve), tradeskill-backend.service, backend.env.example (keys list — REAL secrets user ko Emergent VS Code se manually copy karne hain, GitHub export me .env nahi jata) + frontend.env.example (REACT_APP_BACKEND_URL=https://tradeskill.in). DNS: A @ + A www → 187.127.98.41. Flow: Save to GitHub → clone /opt/tradeskill → setup_server.sh → .env bharo → deploy_app.sh → certbot.
- **2026 (part 66) — SITE LIVE + AUTO-SWEEP IMPLEMENTED**: (a) https://tradeskill.in LIVE (user VPS 187.127.98.41, nginx+SSL+systemd+MongoDB local). API/register/login verified live. Admin=TSK100000. Deploy fixes: emergentintegrations requirements.txt se removed (PyPI par nahi), admin seed ab UID migration se PEHLE (startup order fix). (b) **AUTO-SWEEP DONE**: chain_wallet.sweep_usdt(network, from_index, to_address, min) — deposit addr ka pura USDT cold wallet me, gas kam ho to master idx-0 se native top-up (wait_for_receipt). deposit_watcher_loop me hook: SWEEP_ENABLED(default 1), SWEEP_MIN_USDT(default 1), dest=SWEEP_ADDRESS||ADMIN_WALLET_ADDRESS; sweep ke baad onchain_credited baseline 0 reset; db.sweeps me record; retry-safe har cycle. Dry-run tested (0 bal → skip). (c) WALLET ARCHITECTURE (user-defined): mnemonic wallet 0xe9BD1f24... = GAS + HD-derivation + withdrawal payout hot wallet; COLD collection = 0x07fE8dc2d97F592C4333F30ADC47377c93b37559 (private key sirf user ke paas). User ke VPS .env me MASTER_MNEMONIC abhi PLACEHOLDER tha — user ko real 12 words dalne bola. (d) User priorities: ADMIN PANEL BAAD ME; abhi private testing; "API pending" kaam pehle.
- **2026 (part 67) — REFERRAL CODE = UID (verified via curl)**: (a) Register: referral_code ab user ka UID hi hai (TSK100000 style), random TS-hex hataya. (b) Admin referral = TSKADMIN (seed + migration update_many). (c) Startup migration: sabhi non-admin users ka referral_code = uid. (d) Register.jsx: ?ref= param auto-prefill (useSearchParams) + placeholder TSK... Admin link: https://tradeskill.in/register?ref=TSKADMIN. Tested: admin TSKADMIN ✓, new user uid==ref_code ✓, referred_by set ✓.
- **2026 (part 68) — SWEEP BUG FIX (testing_agent 10/10 PASS, iteration_23)**: User ka $1 BEP20 deposit sweep nahi hua (on-chain confirmed: 1 USDT deposit addr 0x67Cc..., 0 BNB wahan, gas wallet 0.014 BNB). Root causes fixed: (1) BSC gas price floor 3 gwei / Polygon 30 gwei — 'transaction underpriced' reject fix (pehle node_price*1.15 ≈ 1.15 gwei jata tha). (2) Detailed logging: 'sweep attempt/skipped(reason)/deposit_index missing/SWEEP OK/failed'. (3) Startup WARN agar SWEEP destination unset. User ko git pull + restart bolna pada — uske server par sweep ke baad watcher har 45s retry karega aur $1 cold wallet me chala jayega. NOTE: user ke server par live verification pending (user screenshot dega).
- **2026 (part 69) — REAL-MODE FEE BUG FIX (testing_agent 14/14 PASS, iteration_24)**: User ka REAL FIL bot TP par sell nahi kar paya — Binance BUY par 0.1% fee base asset me kaatta hai (bought 4.57, held 4.56543) par bot gross track karta tha. Fixes in _execute_trade LIVE path: (1) _parse_fill(order, base_asset) BUY par base-asset commission NET karta hai. (2) SELL par qty = min(tracked, Binance free balance) + LOT_SIZE step floor (_get_lot_step + _LOT_STEP_CACHE, get_symbol_info). (3) SELL settle: remaining < step*1.05 → dust → 0 → cycle reset hota hai. Gas fee bhi pichle turn me fix (BSC 0.05 gwei live price, fee ~$0.002). User ko git pull + restart bolna. REAL trading ab user ke VPS par LIVE chal rahi hai (4 real bots running).
- **2026 (part 70) — ASSET = BOT WALLET ONLY + EXCHANGE USDT (verified preview)**: (a) Wallet.jsx: isLiveMode force false — Asset page hamesha bot-wallet view (Total assets converted + Deposit/Send/P2P/Swap + History); LIVE BINANCE gradient card + coin list kabhi nahi dikhta (JSX code me hai par unreachable). (b) Trades.jsx exchange card: bind.bound par /binance/account se USDT (free+locked) fetch → "Live" ke niche `X.XX USDT` (data-testid=exchange-usdt-balance). (c) TradingPair.jsx: "Auto-Sell will fail" warning ab sirf shortfall > 1% position par dikhti hai (0.1% fee dust par nahi). Preview verified: wallet bot-view ✓, no binance section ✓.
- **2026 (part 71) — WALLET SUMMARY = BOT WALLET ONLY (verified via curl)**: /wallet/summary ab real mode me bhi total_usdt = bot_wallet_balance (Trade Skill deposits) — Binance USDT/positions kabhi add nahi hote. Binance get_account call bhi hata (fast). wallet_mode informational only. Binance ka fund sirf Trade page exchange card par (/binance/account).
- **2026 (part 72) — CYCLE / ONE SHOT / SELL NOW (verified via curl + UI screenshots)**: (a) Backend: bot field `trade_mode` ('cycle' default | 'oneshot'). POST /api/bots/{symbol}/mode {mode}. POST /api/bots/{symbol}/sell-now → position market-sell (source=manual_sell, fee normal on profit), event manual_sell; oneshot me sell ke baad bot stop + mode wapas cycle. _bot_tick TP sell ke baad oneshot → status stopped + event oneshot_complete + mode reset. start_bot fresh start par trade_mode=cycle. (b) Frontend BotRow (Trades.jsx) mockup jaisa: 3 buttons (CYCLE gradient-active / ONE SHOT / SELL NOW black-border), subtitle CYCLE|ONE SHOT · RUNNING, 3-col row (Live Price | Floating P&L | Position Buys·Sells), ConfirmModal har action par (Hinglish desc, Cancel/Yes). Sell-now tested: AVAX sold @9.957 +$0.24 profit, oneshot→stop, cycle→engine re-buy. NOTE: old `trade_method` field (One-Shot legacy) ab bhi settle path me hai — trade_mode se alag, None rehta hai, harmless.
- NEXT CONFIRMED TASK: Auto Sweep (user chose "pehle design, Auto Sweep baad me") — sweep user HD deposit addresses' USDT → master/admin wallet: needs gas top-up from master index 0 to deposit addr, then send_usdt from that index, reset onchain_credited baseline after sweep (CRITICAL to not break deposit watcher), db.sweeps log + admin endpoints + background loop w/ AUTO_SWEEP_ENABLED env.

- **2026-06 (part 26) — TRADE SETTINGS NIGHT MODE FIX (playwright verified dark)**: TradeSettings.jsx cards were hardcoded light (ROW #fff, INP #F0FDF4, coin-card/info banners linear-gradient #ECFDF5→#EFF6FF, toggle-off #CBD5E1) so they stayed white in night mode. Added theme vars in index.css: --card-soft-grad, --card-soft-border, --toggle-off (light = original values, dark = teal-tinted green/blue gradient + rgba borders). ROW→var(--surface), INP→var(--surface-3). All 3 views (main/margin/dist) now fully dark in night mode; day mode pixel-identical.

- **2026-06 (part 27) — LIVE POSITION PAGE REWRITE (user final-image spec, testing agent iteration_26 + self-verified)**: TradingPair.jsx (/pair/:symbol) fully rewritten 1222→~340 lines per user's "FINAL LIVE POSITION UI" instruction. NEW LAYOUT ONLY: header (back, "Live Position", refresh w/ toast, 3-dot menu), coin card (logo, pair+chevron, coin name + Running/Stopped dot, live price + 24h%, tap→/trade-settings), 11 SLIM horizontal stat cards 3-col grid (icon-left circle blue grad, exact order: Position amount→Position qty→Avg price→First Buy→Margin call limit→TP Ratio (green)→Earnings Callback→Margin call drop→Buy in callback→Numbers of call margin→Return rate LAST green/red), Auto-Trigger Ladder card ("X Call · X Left" dynamic from margin_call_limit, Current Price live row, C1..CN 2-col call cards from bot.dca_ladder w/ cumulative drop% from anchor, $amt, Total, ≤trigger, live distance% red/green, executed calls dimmed w/ check), info footer. REMOVED: Operation Reminder, Manual Trade, Strategy Config, Margin Config, Bot Activity, action button row. Bot controls in 3-dot menu: Start/Stop Bot, Edit Strategy, Edit Position (modal w/ Import from Binance, z-[70] centered pb-28 — fixed bottom-nav overlap bug from iteration_26), Manual Buy, Sell All, Close Position. Blue theme vars added: --lp-card-grad/--lp-border/--lp-blue/--lp-current-grad (light+dark). All testids lp-* (trailing-hyphen slug bug fixed). Ladder count verified dynamic (9→10 on ts-limit change). Dark mode verified.

- **2026-06 (part 28) — DEPOSIT CELEBRATION POPUP (e2e verified via playwright)**: Live celebration popup the moment an on-chain deposit is credited. BACKEND: _process_deposit_wallet now inserts into db.deposit_alerts {id,user_id,amount,network,seen:false} right after DEPOSIT CREDITED; GET /api/bot-wallet/deposit-alerts returns unseen (does NOT mark seen — StrictMode double-mount safe); POST /api/bot-wallet/deposit-alerts/ack {ids} marks seen. FRONTEND: components/DepositCelebration.jsx mounted in AppShell (all logged-in pages) — polls every 10s, module-level shownIds Set dedupe, queue for multiple alerts, CSS confetti rain (36 pieces, brand colors) + pop-in card (PartyPopper icon pulse, "+X USDT · NETWORK · credited"), auto-dismiss 7s, close button, z-[80], theme-aware. LEARNING: never put side-effects in setState updater / never mark-seen on GET (StrictMode double-invoke consumed the alert silently).

- **2026-06 (part 29) — RANK POPUP EVERY LOGIN + LEVEL 1 (playwright verified)**: AuthContext login()/logout() now clear localStorage "hubx-rank-level" → Rank Achieved confetti popup fires on EVERY fresh login. Dashboard condition changed: stored===null (fresh login) shows popup for ANY level including Level 1. Trades page: 24h change % badge next to pair name (green ▲/red ▼) on every bot card; Live bot cards get blue border (#2563EB). useBinanceStream hook: REST fallback added (polls /market/stats every 15s when WS not connected — preview WS geo-blocked 451). Test user created: level1test@tgxbot.com / Test@12345.

- **2026-06 (part 30) — DEPOSIT SPEED FIX (measured: 120-block scan 0.3s/net)**: User reported 1-2 min deposit credit on live; target 10-20s. Root causes fixed: (1) chain_wallet._w3 now CACHES Web3 instances per RPC url (requests keep-alive — pehle har call pe naya TLS handshake), timeout 8→5s; (2) getLogs chunk 10→GETLOGS_CHUNK env (default 30) → 120-block backlog = 4 calls not 12; (3) deposit_event_loop: BSC+Polygon ab PARALLEL (asyncio.gather) scan hote hain, slow-cycle (>6s) warning log; (4) faster default RPCs (publicnode first), .env BSC_RPC_URL → bsc-rpc.publicnode.com; (5) backup poller default 60→30s, .env 45→30. VPS NOTE: user must ALSO update /opt/tradeskill/backend/.env (BSC_RPC_URL + DEPOSIT_WATCH_INTERVAL) since .env is not in git.

- **2026-06 (part 31) — DEPOSIT CELEBRATION = RANK POPUP STYLE (BLUE, playwright verified)**: DepositCelebration.jsx redesigned to EXACTLY mirror the rank popup (Dashboard rankUp overlay): full-screen blur overlay rgba(4,25,32,0.72), rounded-3xl card w/ BLUE gradient (135deg #3B82F6→#2563EB→#0B2A5C), blue border/glow, 🎉 emoji, "DEPOSIT RECEIVED" tracking label (#93C5FD), big "+X USDT", "NETWORK · Aapke wallet me credit ho gaya! 🥳", "Awesome!" pill button (blue), canvas-confetti bursts in blue colors (same fire pattern as rank). Rank popup untouched (green/hero-grad). Deposit speed fix CONFIRMED LIVE on user VPS: journalctl showed "DEPOSIT CREDITED: 2.0 USDT (BEP20)" with instant alert delivery + ack.

- **2026-06 (part 32) — API WHITELIST IP DISPLAY (playwright verified)**: User's VPS IP 187.127.98.41 ab exchange bind flows me dikhta hai. BACKEND: BIND_WHITELIST_IP env (default "187.127.98.41" in code — VPS pe env change ki zaroorat nahi), GET /binance/bind response me whitelist_ip field. FRONTEND: (1) BindAPI.jsx — blue "Server IP — Whitelist This" card w/ copy button (whitelist-ip-card/value/copy testids); (2) ExchangeList.jsx — non-Binance exchange tap par ab toast ki jagah modal (exchange-ip-modal): exchange logo, Coming Soon note, API Whitelist IP + Copy IP + Close. 24h % badge on Trades bot cards now shows "(24h)" suffix. NOTE: server IP publicly visible hona safe hai (domain DNS se already public); IP whitelist se user API keys EXTRA secure hoti hain.

- **2026-06 (part 33) — SOCIAL BONUS: TELEGRAM ONLY, REST COMING SOON (playwright verified)**: SOCIAL_ENABLED env (default "telegram") — WhatsApp/Instagram/Facebook/YouTube ab "COMING SOON 🚀" blue pill + greyed logo + "Jald hi available hoga" text. Backend: follow/verify/claim endpoints 400 "Coming Soon" for disabled platforms; status response me coming_soon flag. Already-claimed users ke CLAIMED badges untouched. Re-enable: SOCIAL_ENABLED="telegram,whatsapp,..." in backend/.env.

- **2026-06 (part 34) — REAL GMAIL OTP LIVE (curl verified, real email sent)**: EMAIL_OTP_MODE=smtp + GMAIL_USER=cryptoworld55555a@gmail.com + GMAIL_APP_PASSWORD set in backend/.env (preview). Signup OTP send returned mode:"smtp" ok:true — real email delivered. Works for signup + withdrawal OTP. User instructed to run sed one-liner on VPS .env + restart. NOTE: OTP emails ab REAL hain — testing agent ko signup flows me demo_otp nahi milega (smtp mode me demo_otp response me nahi hota); testing ke liye EMAIL_OTP_MODE=demo pe switch karna padega.

- **2026-06 (part 35) — RESEND CUSTOM DOMAIN EMAIL (code ready, domain verification PENDING)**: User created own Resend account + added tradeskill.in (Tokyo ap-northeast-1). _send_otp_email now supports EMAIL_OTP_MODE="resend": POST api.resend.com/emails w/ RESEND_API_KEY (re_QrAa85Ra_... in .env) + RESEND_FROM="Trade Skill <no-reply@tradeskill.in>". Tested: 403 domain-not-verified → reverted preview to smtp (Gmail) until DNS verifies. User's Resend DNS records are NEW CNAME style: TXT resend._domainkey (p=MIGf...), CNAME rsend→rsend-apne1.forge.rmta.net, CNAME send→send.forge.rmta.net (NOT old amazonses MX/TXT). VPS switch command given to user (sed EMAIL_OTP_MODE=resend + append RESEND keys + restart). ALSO: POST /api/admin/sweep-stuck endpoint (require_admin) — manually sweeps stuck on-chain USDT both networks, no double-credit; user's stuck $5 POLYGON deposit resolved itself via backup poller once POL gas arrived (verified on-chain balance=0).

- **2026-06 (part 36) — INVITE FRIENDS REFERRAL PAGE (exact mockup, playwright verified)**: Referral.jsx fully rewritten per user's final design: header (back + "Invite Friends"), TradeSkill logo (img + blue "Trade" green "Skill" + "TRADE · EARN · GROW TOGETHER"), community message, QR code (qrcode.react QRCodeCanvas level=H, 200px, black rounded frame, center logo overlay, value=origin/register?ref=CODE), black "Scan & Join Now" pill, "Share your QR code" text, Referral Code card + Copy (blue), Referral Link card + Copy, big blue→green gradient "Copy Referral Link" button, 4-col info row (Invite Friends/They Trade/You Earn/Unlimited Potential with dividers). REMOVED per user instruction: team stats, direct referrals table, commission log (data still at GET /referral if needed later). Testids: invite-*.

- **2026-06 (part 37) — AUTO WITHDRAWAL (full auto per user choice, E2E flow verified)**: bot_wallet_withdraw now fires _auto_process_withdrawal background task (AUTO_WITHDRAW env, default true, no amount limit — user chose full auto). Flow: request pending→processing→send_usdt from master hot wallet index 0 (asyncio Lock prevents nonce clashes)→completed w/ method:"auto"+tx_hash+withdraw_paid txn log. On ANY failure (USDT/gas insufficient, RPC): status back to "pending" + auto_error field → falls into existing admin approval queue (verified on preview: "Master wallet USDT insufficient" → pending fallback ✅). WithdrawModal success text updated (seconds me pahunch jayega). Admin manual approve/reject flow untouched. USER MUST fund master hot wallet with USDT (BEP20+POLYGON) — address printed via chain_wallet.derive_address(0) on their VPS mnemonic (DIFFERENT from preview).

- **2026-06 (part 38) — TXN PASSWORD RULES (playwright verified)**: (1) SIGNUP: login password ≠ transaction password ENFORCED — frontend Register.jsx: check runs first in onSubmit, red border on txn field + red English error box ("Login password and transaction password cannot be the same. Please use a different transaction password.") + toast, clears on typing; backend register: 400 same message. (2) WITHDRAWAL now verifies TRANSACTION password (txn_password_hash) — legacy users without txn_password_hash fall back to login password. WithdrawModal labels updated ("Transaction Password" / "Enter your transaction password").

- **2026-06 (part 39) — ADMIN PANEL WALLET-ONLY LOGIN (full backend security E2E tested)**: Admin panel ab SIRF wallet 0x07fE8dc2d97F592C4333F30ADC47377c93b37559 se khulta hai (user holds private key). BACKEND: ADMIN_PANEL_WALLET env (default = user's address in code), POST /admin/wallet-nonce (403 for other wallets, 5-min nonce), POST /admin/wallet-login (eth_account recover_message verify → 12h JWT w/ wallet_admin:true claim). require_admin REWRITTEN: token MUST have wallet_admin claim — EMAIL ADMIN LOGIN NO LONGER WORKS on /admin/* endpoints (tested 403; user demanded "koi aur rasta nahi"). Tests passed: real sig→200, forged sig→401, wrong wallet→403, email token→403. FRONTEND AdminWithdrawals.jsx: wallet gate screen (Connect Wallet btn → eth_requestAccounts → personal_sign → token in localStorage tgx_admin_wallet_token), all admin API calls use wallet token header, auto-disconnect on 401/403, Disconnect button. Mobile: open in MetaMask/Trust in-app browser. NOTE: previously-given admin curl commands (sweep-stuck etc.) now need wallet token instead of email token. .env LESSON: echo >> without leading newline corrupted .env (GMAIL line merged) — fixed; use python append.

- **2026-06 (part 39b) — ADMIN ROUTE PUBLIC WALLET GATE (verified)**: /admin/withdrawals moved OUTSIDE ProtectedRoute (App.js) — opens directly to Connect Wallet gate without email login. AdminWithdrawals.jsx: removed useAuth/isAdmin/navigate deps entirely — page is 100% wallet-token driven. Normal user email login flows untouched.

- **2026-06 (part 40) — FULL ADMIN PANEL /admin (blue, video-matched, all endpoints E2E tested)**: New AdminPanel.jsx at /admin (public route, wallet gate same as withdrawals). Blue top bar + slide-in sidebar: Dashboard, User Management, Adjustment, Deposits, Withdrawals(→/admin/withdrawals), Pools, Settings, Lock(disconnect). DASHBOARD: 6 stat cards (Active Users, Pending Payouts count, Daily Earning=today company_ledger, Total Users, Total Deposited, Auto WD ON/OFF + pending amount). NEW BACKEND (all require_admin wallet): GET /admin/overview, GET /admin/users?q= (search email/uid/name + balances), POST /admin/adjust {identifier,amount,note} (credit/debit bot wallet + admin_adjust txn), GET /admin/deposits (last 50 w/ emails), GET+POST /admin/settings (auto_withdraw toggle stored db.app_settings — bot_wallet_withdraw now reads DB setting over env). Pools section uses existing /admin/finance-summary (company_fee_5pct, physical_meeting_1pct, company_reserve, both royalty pools). All tested with temp wallet: overview/users/deposits/settings/finance 200, adjust +5/-5 OK, toggle OK. Test wallet env removed after testing.

- **2026-06 (part 41) — ACTIVATED FLAG BUG FIX + LIVE TEST USERS RCA**: BUG: users.activated=True only set on Binance API bind (line 555), NOT on $50 bot activation — users like Pravin Kumar (TSK100040) showed Inactive in team despite activating. FIX: bot_wallet_activate now sets users.activated=True + idempotent startup migration (bot_wallets.activated=True → users.activated=True). TSK100031-38 on user's LIVE db: NOT created this session (preview DB separate) — likely older testing when live EMAIL_OTP_MODE=demo exposed demo_otp in API response. Gave user inspect + delete mongo scripts for VPS (delete across users/bot_wallets/bots/bot_transactions/transactions/binance_keys/withdrawal_requests/deposit_alerts).

- **2026-06 (part 42) — SUB-POSITION MODE FROM CALL 5 (engine simulated-price test PASSED + UI verified)**: Calls 1-4 = normal whole-position DCA. From Call 5 (SUB_POSITION_START env, default 5) up to margin limit (10/20): each safety-order buy becomes a SEPARATE sub-position {id,call,qty,buy_price,amount,tp_price=avg price BEFORE that buy (previous call's avg)} pushed to bots.sub_positions. _bot_tick checks subs FIRST: price >= tp_price → partial SELL of exactly that sub's qty (principal+profit exit), sub removed, core position/avg intact, event kind sub_position_tp. sub_positions cleared on: full-position sell reset (_execute_trade), bot start. Test (tests/test_subposition.py, fake fetch_price): mc_count=4→C5 buy created sub tp=10.0 (prev avg)→price 10.01 sold only 2.3447 qty, core 15.0 intact, events logged. UI TradeSettings distribution card: rows now START at C5 ("Sub-position 5", "TP auto: previous call avg price" subtitle), banner explains mode; rows 1-4 hidden (verified testids tp-row-5 exists, tp-row-1 absent).

- **2026-06 (part 43) — USER MANAGEMENT FINAL (image-matched, backend E2E + UI verified)**: Admin panel Users section per final mockup. LIST: avatar circle, full UID, $balance, Active(green)/Inactive(red) pill, chevron, tap→details modal. DETAILS MODAL (blue header + X): Joining Date, Full Name, Gmail, Phone, Current Rank (blue), BEP20 + Polygon Withdrawal Wallet Address (full display) each w/ Edit→input, Update Changes button, Block User (red outline) / Unblock User (green outline). NEW BACKEND: GET /admin/users now returns mobile/blocked/withdrawal_addresses; POST /admin/users/{uid}/wallets {bep20_address,polygon_address} (0x+42 validation); POST /admin/users/{uid}/block + /unblock. get_current_user: blocked users → 403 "account blocked" (app-wide lockout, tested). bot_wallet_withdraw: admin-set withdrawal_addresses[network] OVERRIDES user-submitted address. Tests: wallet update 200, invalid 400, block→user 403, unblock OK. Testids: admin-user-{uid}, admin-user-detail, admin-wallet-edit-bep20/polygon, admin-update-changes, admin-block-user, admin-unblock-user.

## 26 Jun 2026 — Trade Settings Start/Stop Button
- Added Start button below Update on Trade Settings page (all views: main/margin/dist)
- Bot running hone par red Stop button dikhta hai; calls existing /api/bots/{sym}/start|stop
- Verified via screenshot + curl (start/stop toggle working)

## 1 Oct 2026 — VPS Login Outage (FIXED)
- Symptom: tradeskill.in par SAB users ko "Invalid email or password"
- Root cause: VPS reboot ke baad dusra project (tradego, /var/www/tradego) port 8001 par bind ho gaya; tradeskill-backend crash-loop me tha (port busy). Nginx 8001 par proxy kar raha tha jo tradego ka backend tha → wrong DB → sab logins fail.
- Data: tradeskill_production DB me 55 users poori tarah SAFE the.
- Fix: tradeskill ko port 8005 par shift kiya — /etc/systemd/system/tradeskill-backend.service me --port 8005, /etc/nginx/sites-available/tradeskill me proxy_pass :8005, daemon-reload + restart + nginx reload. Login restore ✅
- VPS NOTE: Is VPS par 4-5 projects hain (tradeskill:8005, titan:8011, tradego:8001, tradegenius, tgexchange). tradego ka koi respawner use 8001 par wapas le aata hai — tradeskill ab 8005 par hai isliye conflict khatam.

## 1 Oct 2026 — Triple Backup System (DONE)
- GET /api/admin/backup/download (require_admin) — mongodump gzip archive stream; tested 200 + mongorestore dryRun pass
- /app/scripts/vps_backup.sh — daily cron (2:30 AM), last 7 local backups in /opt/tradeskill-backups, Telegram sendDocument if TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID in backend/.env
- /app/scripts/vps_restore.sh — mongorestore --drop helper
- AdminPanel Settings section me "Database Backup" card + download button (data-testid admin-backup-download-btn)
- User ko VPS install + BotFather steps de diye; Telegram token USER adds on VPS (not in repo)

## 2 Oct 2026 — Backup System LIVE on VPS (user confirmed)
- Telegram backup working: user received backup file from @tradeskilll_bot (screenshot confirmed)
- Schedule changed: every 6 hours (0 */6 * * *), retention 28 backups (7 days x 4/day) — repo script updated
- VPS side fixes during setup: Node 18 -> 22 PATH conflict fixed (export PATH=/usr/bin:$PATH), yarn build succeeded, new frontend (Start/Stop btn + Admin backup btn) deployed live
- TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID stored in VPS /opt/tradeskill/backend/.env (user added himself)
- NOTE: VPS has stale node 18 earlier in PATH — permanent cleanup pending; builds need export PATH=/usr/bin:$PATH if error recurs

## 2 Oct 2026 — BSC Deposit Speed Fix (deployed on VPS)
- Symptom: BEP20 deposits 2-3 min (Polygon fast). Cause: _DEFAULT_BACKUPS me 3 dead RPCs (bnbchain dataseeds/binance.org = "limit exceeded" on getLogs) — failover dead servers par ghoomta tha
- Fix in chain_wallet.py: verified RPC lists (BSC: publicnode, bsc.drpc.org, 1rpc.io/bnb | Polygon: publicnode, polygon.drpc.org, 1rpc.io/matic) + _bad_until blacklist (fail hua RPC 10 min skip, RPC_BLACKLIST_SECS env) + sticky working-RPC index + _w3_url helper
- .env (local + VPS) RPC lists updated. Tested: dead-primary failover 0.5s, sticky 2nd scan 0.27s
- VPS deploy: git pull was blocked by local vps_backup.sh edit -> git checkout -- fixed; pull fast-forwarded, service running. User to confirm BEP20 deposit speed

## 4 Oct 2026 — Forgot Password with Email OTP (DONE, tested)
- Pehle feature tha hi nahi (button sirf "contact support" toast dikhata tha)
- Backend: POST /api/auth/forgot/send (OTP email, 60s cooldown, 5min TTL, db.reset_otps sha256) + POST /api/auth/forgot/reset (validate OTP -> bcrypt password update -> OTP marked used). _send_otp_email extended with "reset" purpose (subject/heading)
- Frontend: ForgotPassword.jsx (/forgot-password route, dark login theme, 2 steps: email -> OTP+new pw+confirm, resend timer). Login.jsx button now navigates
- Tested e2e: curl full matrix pass + screenshots dono steps. VPS deploy steps user ko diye (build required)
