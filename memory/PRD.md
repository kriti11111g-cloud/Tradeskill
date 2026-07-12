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
