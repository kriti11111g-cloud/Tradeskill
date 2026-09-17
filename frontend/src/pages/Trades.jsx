import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen, ChevronRight, CalendarDays, MoreVertical, ArrowRight } from "lucide-react";
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

export default function Trades() {
  const [bots, setBots] = useState(null);
  const [bind, setBind] = useState(null);
  const [filter, setFilter] = useState("live");
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
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const list = bots || [];
  const running = list.filter((b) => String(b.status || "").toLowerCase() === "running");
  const idle = list.filter((b) => String(b.status || "").toLowerCase() !== "running");
  const totalProfit = list.reduce((a, b) => a + (b.cumulative_profit || 0), 0);
  const shown = filter === "idle" ? idle : running;

  return (
    <div className="trade-page min-h-screen pb-24 pt-4" data-testid="trade-page">
      {/* Header — Revenue jaisa centered */}
      <div className="px-4 grid grid-cols-[1fr_auto_1fr] items-center">
        <span />
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
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#111" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#F3BA2F">
              <path d="M12 2 8.7 5.3 12 8.6l3.3-3.3L12 2zM5.3 8.7 2 12l3.3 3.3L8.6 12 5.3 8.7zm13.4 0L15.4 12l3.3 3.3L22 12l-3.3-3.3zM12 15.4l-3.3 3.3L12 22l3.3-3.3-3.3-3.3zm0-6.1L9.3 12l2.7 2.7 2.7-2.7L12 9.3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-black" style={{ color: "var(--ink)" }}>Binance</div>
            <div className="text-[11px]" style={{ color: "var(--text-mute)" }}>Tap to manage your API</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full" style={{ background: bind?.bound ? "var(--good)" : "#9CA3AF" }} />
            <span className="text-[13px] font-black" style={{ color: bind?.bound ? "var(--good)" : "var(--text-mute)" }}>
              {bind?.bound ? "Live" : "Demo"}
            </span>
            <ChevronRight size={16} style={{ color: "var(--ink)" }} />
          </div>
        </button>
      </div>

      {/* Summary — 3 equal cards */}
      <div className="px-4 mt-2.5 grid grid-cols-3 gap-2.5">
        <div className="rounded-xl px-3 py-3" style={CARD} data-testid="trade-active-bots">
          <div className="text-[10px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Active Bots</div>
          <div className="text-xl font-black mt-1" style={{ color: "var(--ink)" }}>{running.length}</div>
        </div>
        <div className="rounded-xl px-3 py-3" style={CARD} data-testid="trade-total-bots">
          <div className="text-[10px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Total Bots</div>
          <div className="text-xl font-black mt-1" style={{ color: "var(--ink)" }}>{list.length}</div>
        </div>
        <div className="rounded-xl px-3 py-3" style={CARD} data-testid="trade-total-profit">
          <div className="text-[10px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Total Profit</div>
          <div className="text-[15px] font-black mt-1 tabular-nums leading-tight" style={{ color: "var(--good)" }}>
            +{fmtNum(totalProfit, 2)}
            <div className="text-[9px] font-bold" style={{ color: "var(--text-mute)" }}>USDT</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 mt-3">
        <div className="flex rounded-full p-1" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }} data-testid="trade-filter">
          {[
            { id: "live", label: "Live", n: running.length, dot: true },
            { id: "idle", label: "Idle", n: idle.length },
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

      {/* Bot cards */}
      <div className="px-4 mt-3 space-y-2" data-testid="trade-bot-list">
        {bots === null ? (
          <div className="text-center text-sm py-10" style={{ color: "var(--text-mute)" }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div className="text-center text-sm py-10 rounded-xl" style={{ ...CARD, color: "var(--text-mute)" }} data-testid="trade-empty">
            No bots here — create one below
          </div>
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
