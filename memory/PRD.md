# TGX BOT — Product Requirements Document

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
