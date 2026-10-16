# Trade Skill / TGX BOT — PRD

Hindi/Hinglish crypto trading + MLM platform. React (Tailwind/Shadcn/Lucide/Sonner) frontend + FastAPI/MongoDB backend. Monolith: `/app/backend/server.py`. Admin UI: `/app/frontend/src/pages/AdminPanel.jsx`.

## Ranks & Activation economics
- Backend ranks LEVEL1–LEVEL10; frontend shows V1–V10.
- Bot activation fee $50. Direct/difference pot $26.36.
- Direct income by rank: V1 $8, V2 $9, V3 $12, V4 $15, V5 $18, V6 $20, V7 $22, V8 $23, V9 $24, V10 $26.36.
- Immediate sponsor → `direct_bonus` (rank amount). Higher strictly-higher-rank active uplines → `activation_difference` (shown as "Bot Difference"). Every payout → 10% `support_income` to recipient's upline.
- Unclaimed higher-rank slots → company reserve (NOT redistributed). Same-rank/inactive uplines don't claim.

## Implemented
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
