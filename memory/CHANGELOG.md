
## 2026-06 — Perceived speed / instant navigation
- Added `src/lib/useCachedState.js`: drop-in useState replacement that persists to localStorage (stale-while-revalidate). Pages now paint last-known data instantly on tap, fresh data loads in background.
- Wired into: Dashboard (pairs/wallet/rank), Market (movers; coins already cached), Rank (ranks/me), Rewards (pool), Referral (data). Wallet & Revenue already had their own caches.
- Removed now-unused imports (Search/Bitcoin/LineChart in Dashboard; useState in Rewards/Referral).
- Verified: login + navigation across /rank /rewards /referral /market /revenue, no crashes.
