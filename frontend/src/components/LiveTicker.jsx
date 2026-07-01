import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { fmtPct } from "@/lib/format";

// Use a compact top-set of major pairs for the marquee stream (no need to stream all 50)
const MARQUEE_PAIRS = ["btcusdt", "ethusdt", "solusdt", "bnbusdt", "xrpusdt", "dogeusdt"];

export default function LiveTicker() {
  const [pairs, setPairs] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    // Seed with a single REST call so the bar shows something immediately
    let mounted = true;
    api
      .get("/market/pairs?limit=8")
      .then(({ data }) => {
        if (mounted) setPairs(data.pairs || []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Real-time via Binance WebSocket
  useEffect(() => {
    const streams = MARQUEE_PAIRS.map((s) => `${s}@ticker`).join("/");
    let ws;
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const t = msg.data;
          if (!t || !t.s) return;
          setPairs((prev) => {
            const map = new Map(prev.map((p) => [p.symbol, p]));
            map.set(t.s, {
              symbol: t.s,
              last_price: parseFloat(t.c),
              change_pct: parseFloat(t.P),
            });
            // Preserve MARQUEE order
            return MARQUEE_PAIRS.map((s) => map.get(s.toUpperCase())).filter(Boolean);
          });
        } catch {}
      };
    } catch {}
    return () => {
      if (ws) {
        try {
          ws.onmessage = null;
          ws.close();
        } catch {}
      }
    };
  }, []);

  if (!pairs.length) return null;
  const loop = [...pairs, ...pairs];

  return (
    <div
      className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-9 border-b border-white/20 bg-[#050914]/95 backdrop-blur-2xl overflow-hidden z-40"
      data-testid="live-ticker"
    >
      <div className="flex gap-8 whitespace-nowrap animate-tgx-marquee items-center h-full pr-12">
        {loop.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-body">
            <span className="text-[#8B9BB4] font-semibold">{p.symbol.replace("USDT", "/USDT")}</span>
            <span className="font-display font-medium tabular-nums text-white">
              {Number(p.last_price).toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
            <span
              className={`tabular-nums ${p.change_pct >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"}`}
            >
              {fmtPct(p.change_pct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
