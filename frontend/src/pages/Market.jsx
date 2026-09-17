import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import CoinIcon from "@/components/CoinIcon";
import api from "@/lib/api";

const TABS = [
  { id: "hot", label: "Hot" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "new", label: "New", dot: true },
  { id: "volume", label: "24h Vol" },
  { id: "market", label: "Market" },
];

const fmtPrice = (v) => {
  if (v == null) return "—";
  const d = v >= 100 ? 2 : v >= 1 ? 4 : 5;
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};

export default function Market() {
  const [coins, setCoins] = useState([]);
  const [tab, setTab] = useState("hot");
  const [colSort, setColSort] = useState(null); // {col: 'price'|'chg', dir: 1|-1}
  const wsRef = useRef(null);

  const load = () =>
    api.get("/market/top?limit=50").then(({ data }) => {
      const c = data.coins || [];
      if (c.length) {
        setCoins(c);
        try { localStorage.setItem("tgx_market_cache", JSON.stringify(c)); } catch {}
      }
    });

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("tgx_market_cache") || "null");
      if (Array.isArray(c) && c.length) setCoins(c);
    } catch {}
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  // Live ticker stream
  useEffect(() => {
    if (!coins.length) return;
    const streams = coins.map((c) => `${c.symbol.toLowerCase()}@ticker`).join("/");
    let ws;
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const t = JSON.parse(evt.data).data;
          if (!t || !t.s) return;
          setCoins((prev) =>
            prev.map((c) =>
              c.symbol === t.s
                ? { ...c, last_price: parseFloat(t.c), change_pct: parseFloat(t.P), volume: parseFloat(t.q) }
                : c,
            ),
          );
        } catch {}
      };
    } catch {}
    return () => {
      if (ws) {
        try { ws.onmessage = null; ws.close(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins.map((c) => c.symbol).join(",")]);

  const sorted = [...coins].sort((a, b) => {
    if (colSort) {
      const va = colSort.col === "price" ? a.last_price : a.change_pct;
      const vb = colSort.col === "price" ? b.last_price : b.change_pct;
      return colSort.dir * (vb - va);
    }
    if (tab === "gainers") return b.change_pct - a.change_pct;
    if (tab === "losers") return a.change_pct - b.change_pct;
    if (tab === "new") return (b.rank || 999) - (a.rank || 999);
    if (tab === "volume") return b.volume - a.volume;
    return (a.rank || 999) - (b.rank || 999); // hot & market
  });

  const toggleCol = (col) =>
    setColSort((s) => (s?.col === col ? (s.dir === 1 ? { col, dir: -1 } : null) : { col, dir: 1 }));

  return (
    <div className="pb-4">
      <PageHeader title="Ranking" subtitle="" showBack={false} />

      {/* Tabs */}
      <div className="px-4 flex gap-5 overflow-x-auto no-scrollbar border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setColSort(null); }}
            className="relative flex-shrink-0 pb-2.5 pt-1 text-[15px] transition-colors"
            style={{
              color: tab === t.id ? "var(--text)" : "var(--text-mute)",
              fontWeight: tab === t.id ? 800 : 600,
            }}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
            {t.dot && (
              <span className="absolute -top-0 -right-2 w-1.5 h-1.5 rounded-full" style={{ background: "var(--text)" }} />
            )}
            {tab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full" style={{ background: "var(--text)" }} />
            )}
          </button>
        ))}
      </div>

      {/* Crypto / Futures pills */}
      <div className="px-4 mt-3 flex gap-2.5">
        <button
          className="px-5 py-2 rounded-full text-[14px] font-bold text-white"
          style={{ background: "linear-gradient(90deg, #2563EB, #10B981)" }}
          data-testid="pill-crypto"
        >
          Crypto
        </button>
        <button
          onClick={() => toast("Futures — Coming Soon 🚀")}
          className="px-5 py-2 rounded-full text-[14px] font-semibold"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          data-testid="pill-futures"
        >
          Futures
        </button>
      </div>

      {/* Column headers */}
      <div className="px-4 mt-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Name</span>
        <div className="flex items-center gap-6">
          <button
            onClick={() => toggleCol("price")}
            className="flex items-center gap-0.5 text-[13px] font-semibold"
            style={{ color: colSort?.col === "price" ? "var(--text)" : "var(--text-soft)" }}
            data-testid="col-sort-price"
          >
            Last Price <ChevronsUpDown size={13} />
          </button>
          <button
            onClick={() => toggleCol("chg")}
            className="flex items-center gap-0.5 text-[13px] font-semibold"
            style={{ color: colSort?.col === "chg" ? "var(--text)" : "var(--text-soft)" }}
            data-testid="col-sort-chg"
          >
            24h chg% <ChevronsUpDown size={13} />
          </button>
        </div>
      </div>

      {/* Coin rows */}
      <div className="px-4 mt-2 space-y-1.5" data-testid="market-list">
        {sorted.map((p, i) => {
          const up = p.change_pct >= 0;
          return (
            <motion.div
              key={p.symbol}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.012, 0.35) }}
            >
              <Link
                to={`/pair/${p.symbol}`}
                data-testid={`market-pair-${p.symbol}`}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                }}
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.asset}
                    width={30}
                    height={30}
                    className="rounded-full shrink-0"
                    onError={(e) => { e.currentTarget.outerHTML = ""; }}
                  />
                ) : (
                  <CoinIcon symbol={p.asset} size={30} />
                )}
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <span className="text-[13.5px] font-black truncate" style={{ color: "var(--text)" }}>
                    {p.asset}
                  </span>
                  {tab === "hot" && !colSort && i < 3 && (
                    <Flame size={13} fill="#F59E0B" color="#F59E0B" className="shrink-0" />
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-black tabular-nums leading-tight" style={{ color: "var(--text)" }}>
                    {fmtPrice(p.last_price)}
                  </div>
                  <div className="text-[10px] tabular-nums mt-0.5" style={{ color: "var(--text-mute)" }}>
                    {fmtPrice(p.last_price)} USDT
                  </div>
                </div>
                <div
                  className="w-[72px] py-1.5 rounded-lg text-center text-[11.5px] font-bold text-white tabular-nums shrink-0"
                  style={{ background: up ? "var(--good)" : "#EF4444" }}
                >
                  {up ? "+" : ""}{(p.change_pct ?? 0).toFixed(2)}%
                </div>
              </Link>
            </motion.div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center text-sm py-16" style={{ color: "var(--text-mute)" }} data-testid="market-empty">
            Loading top 50...
          </div>
        )}
      </div>
    </div>
  );
}
