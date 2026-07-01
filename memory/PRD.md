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

## Deferred / P1 Backlog
- WebSocket real-time price updates on TradingPair (currently polls every 6s)
- Actual live Binance order placement in "Real" mode (currently keys stored encrypted; orders still simulated for safety)
- Two-factor auth & password reset flow
- Push notifications & in-app inbox
- Advanced technical analysis chart on the TradingPair page (indicators)
- Team commission distribution on team-member trades (currently manual only)
- Multi-language i18n (Hindi/English)

## Next Action Items
1. Take user feedback on visual design and flows.
2. If real trading needed, integrate live order placement (python-binance is installed) & add IP whitelist warnings.
3. Add referral commission trigger on each team-member SELL.
