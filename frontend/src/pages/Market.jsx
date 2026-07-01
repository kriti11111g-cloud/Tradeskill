import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import CoinIcon from "@/components/CoinIcon";
import api from "@/lib/api";
import { fmtUSD, fmtPct, shortSymbol } from "@/lib/format";

export default function Market() {
  const [pairs, setPairs] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("volume");

  const load = () =>
    api.get("/market/pairs?limit=200").then(({ data }) => setPairs(data.pairs || []));

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = pairs
    .filter((p) => (q ? p.symbol.toLowerCase().includes(q) : true))
    .sort((a, b) => {
      if (sort === "gainers") return b.change_pct - a.change_pct;
      if (sort === "losers") return a.change_pct - b.change_pct;
      return b.volume - a.volume;
    });

  const sorts = [
    { id: "volume", label: "Top Volume" },
    { id: "gainers", label: "Gainers" },
    { id: "losers", label: "Losers" },
  ];

  return (
    <div className="pb-4">
      <PageHeader
        title="Market"
        subtitle="Live · Binance data"
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
            placeholder="Search coin (BTC, ETH, SOL, ...)"
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

      <div className="px-4 mt-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold">
          {filtered.length} pairs · Tap to trade
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
                <div className="w-6 text-[10px] tabular-nums text-[#8B9BB4] font-bold text-right">
                  #{i + 1}
                </div>
                <CoinIcon symbol={p.symbol} size={38} />
                <div>
                  <div className="font-display font-bold text-sm">
                    {shortSymbol(p.symbol)}
                    <span className="text-[#8B9BB4]">/USDT</span>
                  </div>
                  <div className="text-[10px] text-[#8B9BB4] uppercase tracking-wider mt-0.5">
                    Vol {(p.volume / 1_000_000).toFixed(1)}M
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
            {pairs.length === 0 ? "Loading market data..." : `No match for "${search}"`}
          </div>
        )}
      </div>
    </div>
  );
}
