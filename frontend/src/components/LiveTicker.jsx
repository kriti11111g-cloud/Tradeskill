import { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtPct } from "@/lib/format";

export default function LiveTicker() {
  const [pairs, setPairs] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await api.get("/market/pairs");
        if (mounted) setPairs(data.pairs || []);
      } catch {}
    };
    load();
    const id = setInterval(load, 20000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (!pairs.length) return null;
  const loop = [...pairs, ...pairs];

  return (
    <div
      className="w-full h-9 border-b border-white/5 bg-[#0F1524]/60 backdrop-blur-xl overflow-hidden relative"
      data-testid="live-ticker"
    >
      <div className="flex gap-8 whitespace-nowrap animate-tgx-marquee items-center h-full">
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
