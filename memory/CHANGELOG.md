
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
