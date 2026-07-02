# TGX BOT — Product Requirements Document

## Original Problem Statement
User asked to build an app similar to "HiTechBot" (crypto trading bot shown in reference video) that integrates with the Binance API. Bot must be named "TGX BOT".

## User Choices Captured
- Mobile-responsive web app (looks like phone app)
- Both Real Binance API mode AND Simulation/Demo mode
- Email + Password (JWT) authentication
- Dark theme with neon/crypto vibes
- All features from video (Bind API, Dashboard, Trading Pairs, Strategy config, Transactions, Revenue, Referral, Rewards, Wallet, News, Guide, Profile)

## Architecture
- **Backend**: FastAPI + Motor (Mongo) + JWT (cookie + Bearer) + Fernet-encrypted Binance API keys + python-binance library.
- **Frontend**: React 19 + React Router 7 + Framer Motion + Recharts + shadcn/ui + Tailwind, mobile-app frame max-w-[480px].
- **Market data**: `data-api.binance.vision` (geo-friendly public endpoint) — ticker, 24hr stats, klines.
- **Trading**: Demo mode executes simulated orders against live Binance price; real-mode wiring via python-binance is scaffolded (bind API stores encrypted keys).

## Personas
1. **Retail crypto trader** wanting hands-off trading.
2. **Team leader** growing a referral community for commissions.

## Core Requirements (static)
- Auth (register/login/logout/me)
- Bind Binance API + mode selector
- Dashboard hero + action grid + live pairs
- Trading pair page with position stats, strategy config, buy/sell/close
- Wallet (deposit/withdraw/transfer + history + positions)
- Transactions history (filter Buy/Sell)
- Revenue analytics with chart
- Referral (code, team, share, commissions)
- Rewards (joining/trading/referral claims)
- News feed, User guide, Profile

## Implemented (2026-07-01)
- ✅ Full backend API (`/api/*`) with 25+ endpoints
- ✅ Full frontend (13 pages) with dark neon design + mobile frame
- ✅ Live ticker marquee, hero banner, action grid, live Binance pairs
- ✅ Trading page: current price, position stats, buy/sell/close, strategy config w/ Suggest, start/stop
- ✅ Wallet with deposit/withdraw/transfer modal + open positions
- ✅ Transactions filter, Revenue chart, Referral share, Rewards claim
- ✅ Admin seed + Welcome bonus reward
- ✅ Background bot engine (DCA, margin calls, take-profit with callback pullback)
- ✅ Per-round margin config UI + manual position adjustment
- ✅ 50-pair Market page (CoinGecko top-50 filtered to Binance USDT pairs)
- ✅ Binance WebSockets for zero-lag price on Market + TradingPair

## Implemented (2026-07-02, drill-down)
- ✅ **Revenue → Transactions drill-down**: Tap any symbol row on /revenue → opens /transactions?symbol=XXX filtered view. Dismissible chip with coin icon + X-clear + back-to-revenue. Deep-linkable URL. BUY/SELL filter pills further narrow within the symbol. Fully e2e tested (10/10 pytest + 11/11 Playwright).

## Implemented (2026-07-02, later)
- ✅ **Revenue page overhaul** (HiTechBot-style): prominent Today's Profit + Cumulative Profit, auto-refresh 15s, "By Symbol" now shows sell counts, radial glow that flips red on drawdown
- ✅ **Per-pair profit banner** on TradingPair page (Today's + Cumulative + sells count) — updates every 8s alongside bot state
- ✅ New endpoint `/api/revenue/pair/{symbol}` returning `{cumulative_profit, today_profit, sell_count}`

## Implemented (2026-07-01, later)
- ✅ **News**: live crypto feed from Cointelegraph RSS (30 items, images, external links)
- ✅ **Referral commissions**: auto-credit referrer 10% of every profitable SELL (bot + manual) as claimable reward
- ✅ Referral page shows pending commission + commission log
- ✅ Bottom Nav order finalised: Home → Market → Trade → Asset → Profile

## Deferred / P1 Backlog
- Actual live Binance order placement in "Real" mode (geo-blocked in preview environment)
- Two-factor auth & password reset flow
- Push notifications & in-app inbox
- Advanced technical analysis chart on the TradingPair page (indicators)
- Multi-language i18n (Hindi/English)
- **Refactor**: split `server.py` (1300+ lines) into `routers/` and `services/`

## Next Action Items
1. User verification of News + Referral commission flows.
2. Optional: add trading-volume milestone rewards ($10 traded → $1 bonus, etc.).
3. When real Binance trading is needed, deploy to a supported region.
