// Hardcoded "Coming Soon" / upcoming listing coins for the Market page.
// Dates are near-term (today / tomorrow / next few days) and computed fresh at
// load so the list always feels like real upcoming listings with live timers.
const _now = Date.now();
const _in = (hours) => new Date(_now + hours * 3600000).toISOString();

export const UPCOMING_COINS = [
  { symbol: "MONUSDT", asset: "MON", name: "Monad", launchAt: _in(6), when: "Today", tagline: "High-performance parallel EVM L1" },
  { symbol: "BERAUSDT", asset: "BERA", name: "Berachain", launchAt: _in(29), when: "Tomorrow", tagline: "Proof-of-Liquidity L1" },
  { symbol: "EIGENUSDT", asset: "EIGEN", name: "EigenLayer", launchAt: _in(53), when: "In 2 days", tagline: "Restaking & shared security" },
  { symbol: "ZROUSDT", asset: "ZRO", name: "LayerZero", launchAt: _in(77), when: "In 3 days", tagline: "Omnichain interoperability" },
  { symbol: "SCRUSDT", asset: "SCR", name: "Scroll", launchAt: _in(101), when: "In 4 days", tagline: "zkEVM Ethereum L2" },
];

export const isUpcoming = (symbol) => {
  if (!symbol) return false;
  const s = symbol.toUpperCase();
  return UPCOMING_COINS.some((c) => c.symbol === s || c.asset === s);
};

export const getUpcoming = (symbol) => {
  if (!symbol) return null;
  const s = symbol.toUpperCase();
  return UPCOMING_COINS.find((c) => c.symbol === s || c.asset === s) || null;
};

// Returns {d,h,m,s,done} remaining until launchAt.
// Self-healing: if the stored date has already passed, roll it forward by
// whole years so the countdown never gets permanently stuck on "Launching now".
export const timeLeft = (launchAt) => {
  let target = new Date(launchAt).getTime();
  const now = Date.now();
  while (target <= now) target += 365 * 86400000;
  const diff = target - now;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: false };
};
