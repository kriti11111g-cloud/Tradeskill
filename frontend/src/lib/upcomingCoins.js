// Hardcoded "Coming Soon" / upcoming launch coins for the Market page.
// Users can pre-configure their bot settings before these go live.
export const UPCOMING_COINS = [
  { symbol: "MONUSDT", asset: "MON", name: "Monad", launchAt: "2026-07-10T12:00:00Z", tagline: "High-performance parallel EVM L1" },
  { symbol: "BERAUSDT", asset: "BERA", name: "Berachain", launchAt: "2026-07-22T12:00:00Z", tagline: "Proof-of-Liquidity L1" },
  { symbol: "EIGENUSDT", asset: "EIGEN", name: "EigenLayer", launchAt: "2026-08-05T12:00:00Z", tagline: "Restaking & shared security" },
  { symbol: "ZROUSDT", asset: "ZRO", name: "LayerZero", launchAt: "2026-08-20T12:00:00Z", tagline: "Omnichain interoperability" },
  { symbol: "SCRUSDT", asset: "SCR", name: "Scroll", launchAt: "2026-09-08T12:00:00Z", tagline: "zkEVM Ethereum L2" },
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

// Returns {d,h,m,s,done} remaining until launchAt
export const timeLeft = (launchAt) => {
  const diff = new Date(launchAt).getTime() - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: false };
};
