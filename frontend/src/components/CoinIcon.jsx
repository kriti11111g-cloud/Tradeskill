import { useState } from "react";

/**
 * Renders a crypto coin icon from CoinCap CDN with a graceful text-badge fallback.
 * Accepts either the base asset symbol ("BTC") or a trading pair ("BTCUSDT").
 */
export default function CoinIcon({ symbol, size = 32, className = "" }) {
  const base = (symbol || "").toUpperCase().replace("USDT", "").replace("BUSD", "").replace("USDC", "");
  const [errored, setErrored] = useState(false);

  const bg =
    "linear-gradient(135deg, rgba(22,163,74,0.25), rgba(248,113,113,0.25))";

  if (!base) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-display font-black text-[9px] ${className}`}
        style={{ width: size, height: size, background: bg }}
      >
        ??
      </div>
    );
  }

  if (errored) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-display font-black text-white ${className}`}
        style={{
          width: size,
          height: size,
          background: bg,
          fontSize: size * 0.32,
        }}
      >
        {base.slice(0, 3)}
      </div>
    );
  }

  return (
    <img
      src={`https://assets.coincap.io/assets/icons/${base.toLowerCase()}@2x.png`}
      alt={base}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={`rounded-full bg-[color:var(--text)]/5 object-contain ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}
