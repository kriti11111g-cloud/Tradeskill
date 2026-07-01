import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import CoinIcon from "@/components/CoinIcon";
import api from "@/lib/api";
import { fmtUSD, fmtPct } from "@/lib/format";

export default function Market() {
  const [coins, setCoins] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("rank");
  const wsRef = useRef(null);

  const load = () =>
    api.get("/market/top?limit=50").then(({ data }) => setCoins(data.coins || []));

  useEffect(() => {
    load();
    const id = setInterval(load, 60000); // refresh coingecko meta every 60s
    return () => clearInterval(id);
  }, []);

  // Subscribe to Binance's official combined ticker stream once we know the symbols.
  useEffect(() => {
    if (!coins.length) return;
    const streams = coins.map((c) => `${c.symbol.toLowerCase()}@ticker`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    let ws;
    try {
      ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const t = msg.data;
          if (!t || !t.s) return;
          setCoins((prev) =>
            prev.map((c) =>
              c.symbol === t.s
                ? {
                    ...c,
                    last_price: parseFloat(t.c),
                    change_pct: parseFloat(t.P),
                    volume: parseFloat(t.q),
                    high: parseFloat(t.h),
                    low: parseFloat(t.l),
                  }
                : c,
            ),
          );
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
    // Re-subscribe only when the list of symbols actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins.map((c) => c.symbol).join(",")]);

  const q = search.trim().toLowerCase();
  const filtered = coins
    .filter((c) =>
      q ? c.symbol.toLowerCase().includes(q) || (c.name || "").toLowerCase().includes(q) : true,
    )
    .sort((a, b) => {
      if (sort === "gainers") return b.change_pct - a.change_pct;
      if (sort === "losers") return a.change_pct - b.change_pct;
      if (sort === "volume") return b.volume - a.volume;
      return (a.rank || 999) - (b.rank || 999);
    });

  const sorts = [
    { id: "rank", label: "Market Cap" },
    { id: "volume", label: "Volume" },
    { id: "gainers", label: "Gainers" },
    { id: "losers", label: "Losers" },
  ];

  return (
    <div className="pb-4">
      <PageHeader
        title="Market"
        subtitle="Top 50 · Binance-listed"
        showBack={false}
        right={
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-tgx-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-[#39FF14] font-bold">LIVE</span>
          </div>
        }
      />

      <div className="px-4">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B9BB4]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coin (BTC, ETH, Solana, ...)"
            className="w-full bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-[#00F0FF] placeholder:text-[#8B9BB4]"
            data-testid="market-search"
          />
        </div>
      </div>

      <div className="px-4 mt-3 flex gap-2 overflow-x-auto pb-1">
        {sorts.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            data-testid={`sort-${s.id}`}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition ${
              sort === s.id
                ? "bg-[#00F0FF] text-[#050914] border-[#00F0FF]"
                : "bg-white/5 text-[#8B9BB4] border-white/20 hover:bg-white/10"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-4 mt-3">
        <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold">
          {filtered.length} of {coins.length} coins · Tap to trade
        </div>
      </div>

      <div className="px-4 mt-2 space-y-2" data-testid="market-list">
        {filtered.map((p, i) => (
          <motion.div
            key={p.symbol}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.015, 0.4) }}
          >
            <Link
              to={`/pair/${p.symbol}`}
              data-testid={`market-pair-${p.symbol}`}
              className="flex items-center justify-between bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3.5 hover:border-[#00F0FF]/50 hover:bg-[#0F1524]/80 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 text-[10px] tabular-nums text-[#8B9BB4] font-bold text-right">
                  #{p.rank}
                </div>
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.asset}
                    width={36}
                    height={36}
                    className="rounded-full bg-white/5"
                    onError={(e) => {
                      e.currentTarget.outerHTML = "";
                    }}
                  />
                ) : (
                  <CoinIcon symbol={p.asset} size={36} />
                )}
                <div>
                  <div className="font-display font-bold text-sm">
                    {p.asset}
                    <span className="text-[#8B9BB4]">/USDT</span>
                  </div>
                  <div className="text-[10px] text-[#8B9BB4] mt-0.5 truncate max-w-[140px]">
                    {p.name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold tabular-nums text-sm">
                  {fmtUSD(p.last_price, p.last_price > 100 ? 2 : p.last_price > 1 ? 4 : 6)}
                </div>
                <div
                  className={`text-xs font-bold tabular-nums mt-0.5 ${
                    p.change_pct >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
                  }`}
                >
                  {fmtPct(p.change_pct)}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center text-sm text-[#8B9BB4] py-16" data-testid="market-empty">
            {coins.length === 0 ? "Loading top 50..." : `No match for "${search}"`}
          </div>
        )}
      </div>
    </div>
  );
}
