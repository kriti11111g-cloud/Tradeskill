import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen, ChevronRight, CalendarDays, MoreVertical, ArrowRight, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { fmtNum } from "@/lib/format";
import CoinIcon from "@/components/CoinIcon";
import useBinanceStream from "@/hooks/useBinanceStream";

const CARD = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
};

const fmtD = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase();
};

const fmtPrice = (v) => {
  if (!v) return "—";
  const d = v >= 100 ? 2 : v >= 1 ? 4 : v >= 0.01 ? 4 : 6;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};

function BotRow({ bot }) {
  const navigate = useNavigate();
  const ticker = useBinanceStream(bot.symbol);
  const isRunning = String(bot.status || "").toLowerCase() === "running";
  const live = (ticker?.price || 0) > 0 ? ticker.price : bot.avg_price || 0;
  const qty = bot.position_qty || 0;
  const avg = bot.avg_price || 0;
  const hasPos = qty > 0 && avg > 0;
  const floating = hasPos ? qty * live - qty * avg : 0;
  const floatPct = hasPos && avg > 0 ? ((live - avg) / avg) * 100 : 0;
  const negative = floating < 0;
  const round = bot.cycles_completed || 0;

  return (
    <button
      onClick={() => navigate(`/pair/${bot.symbol}`)}
      className="w-full text-left rounded-xl px-3 py-2.5 transition active:scale-[0.995]"
      style={CARD}
      data-testid={`bot-card-${bot.symbol}`}
    >
      <div className="flex items-center gap-2.5">
        <CoinIcon symbol={bot.symbol.replace("USDT", "")} size={34} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-black leading-tight" style={{ color: "var(--ink)" }}>
            {bot.symbol.replace(/USDT$/, "")}/USDT
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-mute)" }}>
            {(bot.trade_method || "Cycle").toUpperCase()} ·{" "}
            <span style={{ color: isRunning ? "var(--good)" : "var(--text-mute)" }}>
              {isRunning ? "RUNNING" : "IDLE"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full" style={{ background: isRunning ? "var(--good)" : "#9CA3AF" }} />
          <span className="text-[12.5px] font-black" style={{ color: isRunning ? "var(--good)" : "var(--text-mute)" }}>
            {isRunning ? "Live" : "Idle"}
          </span>
          <MoreVertical size={16} style={{ color: "var(--ink)" }} />
        </div>
      </div>

      <div className="flex items-end justify-between mt-2.5">
        <div>
          <div className="text-[10px] font-semibold" style={{ color: "var(--text-mute)" }}>Live Price</div>
          <div className="text-[15px] font-black tabular-nums leading-tight" style={{ color: "var(--ink)" }}>
            {fmtPrice(live)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold" style={{ color: "var(--text-mute)" }}>Floating P&L</div>
          <div className="text-[15px] font-black tabular-nums leading-tight" style={{ color: hasPos ? (negative ? "var(--bad)" : "var(--good)") : "var(--text-mute)" }}>
            {hasPos ? `$${negative ? "-" : "+"}${fmtNum(Math.abs(floating), 2)}` : "—"}
            {hasPos && (
              <span className="text-[10.5px] font-bold"> ({negative ? "" : "+"}{fmtNum(floatPct, 2)}%)</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold" style={{ color: "var(--text)" }}>
          <CalendarDays size={13} style={{ color: "var(--ink)" }} />
          {fmtD(bot.started_at || bot.first_trade_at)} <ArrowRight size={11} /> {isRunning ? "NOW" : fmtD(bot.stopped_at || bot.last_trade_at)}
          <span style={{ color: "var(--text-mute)" }}>·</span>
          <span style={{ color: "var(--good)" }}>ROUND {round}</span>
        </div>
        <div className="text-[10.5px] font-bold" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--good)" }}>{bot.buy_count || 0}</span> Buys{" "}
          <span style={{ color: "var(--text-mute)" }}>·</span>{" "}
          <span style={{ color: "var(--bad)" }}>{bot.sell_count || 0}</span> Sells
        </div>
      </div>
    </button>
  );
}

/* Idle tab = read-only trade history card (no action, sirf dekhne ke liye) */
function HistoryRow({ bot }) {
  const isRunning = String(bot.status || "").toLowerCase() === "running";
  const profit = bot.cumulative_profit || 0;
  const neg = profit < 0;
  return (
    <div className="w-full rounded-xl px-3 py-2.5" style={CARD} data-testid={`history-card-${bot.symbol}`}>
      <div className="flex items-center gap-2.5">
        <CoinIcon symbol={bot.symbol.replace("USDT", "")} size={34} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-black leading-tight" style={{ color: "var(--ink)" }}>
            {bot.symbol.replace(/USDT$/, "")}/USDT
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-mute)" }}>
            TRADE HISTORY
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full" style={{ background: isRunning ? "var(--good)" : "#9CA3AF" }} />
          <span className="text-[12.5px] font-black" style={{ color: isRunning ? "var(--good)" : "var(--text-mute)" }}>
            {isRunning ? "Live" : "Idle"}
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between mt-2.5">
        <div>
          <div className="text-[10px] font-semibold" style={{ color: "var(--text-mute)" }}>Total Profit</div>
          <div className="text-[15px] font-black tabular-nums leading-tight" style={{ color: neg ? "var(--bad)" : "var(--good)" }}>
            {neg ? "-" : "+"}${fmtNum(Math.abs(profit), 2)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold" style={{ color: "var(--text-mute)" }}>Trades Done</div>
          <div className="text-[15px] font-black tabular-nums leading-tight" style={{ color: "var(--ink)" }}>
            {bot.lifetime_sell_count || 0}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold" style={{ color: "var(--text)" }}>
          <CalendarDays size={13} style={{ color: "var(--ink)" }} />
          {fmtD(bot.lifetime_first_at)} <ArrowRight size={11} /> {fmtD(bot.lifetime_last_at)}
        </div>
        <div className="text-[10.5px] font-bold" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--good)" }}>{bot.lifetime_buy_count || 0}</span> Buys{" "}
          <span style={{ color: "var(--text-mute)" }}>·</span>{" "}
          <span style={{ color: "var(--bad)" }}>{bot.lifetime_sell_count || 0}</span> Sells
        </div>
      </div>
    </div>
  );
}

export default function Trades() {
  const [bots, setBots] = useState(null);
  const [bind, setBind] = useState(null);
  const [exUsdt, setExUsdt] = useState(null);
  const [filter, setFilter] = useState("live");
  const [prices, setPrices] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("tgx_trade_cache") || "null");
      if (c?.bots) setBots(c.bots);
      if (c?.bind !== undefined) setBind(c.bind);
    } catch {}
    const load = async () => {
      const [b, bd] = await Promise.all([
        api.get("/bots").then((r) => (Array.isArray(r.data) ? r.data : r.data.bots || [])).catch(() => []),
        api.get("/binance/bind").then((r) => r.data).catch(() => null),
      ]);
      setBots(b);
      setBind(bd);
      try { localStorage.setItem("tgx_trade_cache", JSON.stringify({ bots: b, bind: bd })); } catch {}
      // Exchange card par user ka live Binance USDT balance
      if (bd?.bound) {
        api.get("/binance/account").then(({ data }) => {
          const u = (data.balances || []).find((x) => x.asset === "USDT");
          setExUsdt(u ? parseFloat(u.free) + parseFloat(u.locked || 0) : 0);
        }).catch(() => setExUsdt(null));
      } else {
        setExUsdt(null);
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const list = bots || [];
  const running = list.filter((b) => String(b.status || "").toLowerCase() === "running");

  // Live prices stream for running symbols — profit% ke hisab se sorting
  const runningKey = running.map((b) => b.symbol).sort().join(",");
  useEffect(() => {
    if (!runningKey) return;
    // REST seed (WS blocked ho tab bhi sorting kaam kare)
    api.get("/market/pairs?limit=200").then(({ data }) => {
      const map = {};
      (data.pairs || []).forEach((p) => { map[p.symbol] = p.last_price; });
      setPrices((prev) => ({ ...map, ...prev }));
    }).catch(() => {});
    const streams = runningKey.split(",").map((s) => `${s.toLowerCase()}@ticker`).join("/");
    let ws;
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      ws.onmessage = (evt) => {
        try {
          const t = JSON.parse(evt.data).data;
          if (t?.s) setPrices((p) => ({ ...p, [t.s]: parseFloat(t.c) }));
        } catch {}
      };
    } catch {}
    return () => { if (ws) { try { ws.onmessage = null; ws.close(); } catch {} } };
  }, [runningKey]);

  const floatPct = (b) => {
    const avg = b.avg_price || 0;
    const qty = b.position_qty || 0;
    if (!(qty > 0 && avg > 0)) return -Infinity;
    const live = prices[b.symbol] || avg;
    return ((live - avg) / avg) * 100;
  };
  const runningSorted = [...running].sort((a, b) => floatPct(b) - floatPct(a));
  const traded = list
    .filter((b) => (b.lifetime_buy_count || 0) > 0 || (b.lifetime_sell_count || 0) > 0)
    .sort((a, b) => (b.cumulative_profit || 0) - (a.cumulative_profit || 0));
  const totalProfit = list.reduce((a, b) => a + (b.cumulative_profit || 0), 0); // eslint-disable-line no-unused-vars
  const shown = filter === "idle" ? traded : runningSorted;

  return (
    <div className="trade-page min-h-screen pb-24" data-testid="trade-page">
      {/* Sticky top: header + exchange + summary + Live/Idle filter (scroll par fixed) */}
      <div className="sticky top-0 z-20 pt-4 pb-2" style={{ background: "var(--bg-base)" }}>
      {/* Header — Revenue jaisa centered */}
      <div className="px-4 grid grid-cols-[1fr_auto_1fr] items-center">
        <button onClick={() => navigate(-1)} className="p-1 justify-self-start" style={{ color: "var(--ink)" }} data-testid="trade-back">
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <div className="text-center">
          <div className="font-display font-black text-2xl leading-tight" style={{ color: "var(--ink)" }}>Trade</div>
          <div className="text-[11px] font-bold tracking-[0.18em]" style={{ color: "var(--text-mute)" }}>
            {list.length} BOTS · {running.length} RUNNING
          </div>
        </div>
        <div className="justify-self-end">
          <button
            onClick={() => navigate("/bot")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold"
            style={CARD}
            data-testid="trade-guide-btn"
          >
            <BookOpen size={14} style={{ color: "var(--ink)" }} /> Guide
          </button>
        </div>
      </div>

      {/* Connected exchange */}
      <div className="px-4 mt-4">
        <button
          onClick={() => navigate("/bind-api")}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition active:scale-[0.995]"
          style={CARD}
          data-testid="trade-exchange-card"
        >
          <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: "#F3BA2F" }}>
            <span className="text-[13px] font-black text-white">B</span>
            <img
              src="https://coin-images.coingecko.com/markets/images/52/small/binance.jpg"
              alt="Binance"
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-black" style={{ color: "var(--ink)" }}>Binance</div>
            <div className="text-[11px]" style={{ color: "var(--text-mute)" }}>Tap to manage your API</div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: bind?.bound ? "var(--good)" : "#9CA3AF" }} />
              <span className="text-[13px] font-black" style={{ color: bind?.bound ? "var(--good)" : "var(--text-mute)" }}>
                {bind?.bound ? "Live" : "Demo"}
              </span>
              <ChevronRight size={16} style={{ color: "var(--ink)" }} />
            </div>
            {bind?.bound && exUsdt !== null && (
              <div className="text-[12px] font-black tabular-nums mt-0.5" style={{ color: "var(--ink)" }} data-testid="exchange-usdt-balance">
                {exUsdt.toFixed(2)} <span className="text-[9px] font-bold" style={{ color: "var(--text-mute)" }}>USDT</span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Filter */}
      <div className="px-4 mt-3">
        <div className="flex rounded-full p-1" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }} data-testid="trade-filter">
          {[
            { id: "live", label: "Live", n: running.length, dot: true },
            { id: "idle", label: "Idle", n: traded.length },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[13px] font-bold transition-all"
              style={filter === f.id ? { background: "linear-gradient(90deg, #2563EB, #10B981)", color: "#fff" } : { color: "var(--text)" }}
              data-testid={`trade-filter-${f.id}`}
            >
              {f.dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--good)" }} />}
              {f.label} <span style={{ opacity: 0.7 }}>{f.n}</span>
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Bot cards */}
      <div className="px-4 mt-3 space-y-2" data-testid="trade-bot-list">
        {bots === null ? (
          <div className="text-center text-sm py-10" style={{ color: "var(--text-mute)" }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div className="text-center text-sm py-10 rounded-xl" style={{ ...CARD, color: "var(--text-mute)" }} data-testid="trade-empty">
            {filter === "idle" ? "No trade history yet" : "No bots here — create one below"}
          </div>
        ) : filter === "idle" ? (
          shown.map((b) => <HistoryRow key={b.symbol} bot={b} />)
        ) : (
          shown.map((b) => <BotRow key={b.symbol} bot={b} />)
        )}
      </div>

      {/* New Bot */}
      <div className="px-4 mt-4">
        <button
          onClick={() => navigate("/market")}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-[15px] font-black text-white transition active:scale-[0.99]"
          style={{ background: "linear-gradient(90deg, #2563EB, #10B981)" }}
          data-testid="trade-new-bot"
        >
          <Plus size={18} strokeWidth={3} /> New Bot
        </button>
      </div>
    </div>
  );
}
