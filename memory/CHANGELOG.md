
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
