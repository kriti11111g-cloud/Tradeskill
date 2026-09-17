# HUBXBOT — Locked Design Standards (User Mandate)

## Standard List-Card Size (USER LOCKED — 2026)
User instruction: "मेरा जितना भी इस प्रकार से card बनेगा, size यही रहेगा जो Market section के अंदर size है card का"
EVERY list-style card in the app (Market coins, Assets History, and any future list cards) MUST use the Market card size:

- Container: `rounded-xl px-3 py-2`, `space-y-1.5` between cards, `gap-2.5` inside
- Background: `var(--surface)`, Border: `1px solid var(--border)` (very light grey)
- Shadow: `0 1px 6px rgba(0,0,0,0.04)`
- Icon: 26-30px (Market coin: 30, History solid icon: 26)
- Title: 13.5px font-black, color `var(--ink)` (pure black day / #F8FAFC night)
- Sub-line (date/sub-price): 10px, `var(--text-mute)`
- Right amount: 13px bold, green `var(--good)` positive / red `var(--bad)` negative
- Chevron: 16px, `var(--ink)`

## B&W Theme (user preference)
- Mostly black & white; green + gold only as accents
- Icons: SOLID pure black filled (Material style), never outline blue-grey lucide on Assets History
- History labels LOCKED to 6: Support Income (3-person icon), Trading Profit (bars+curved arrow), Trading Fee (coin stack+front coin), Activation Fee (doc+plus), Deposit (down arrow+tray), Withdrawal (up arrow+tray)
- `--ink` CSS var defined in index.css (#000 light, #F8FAFC dark)
