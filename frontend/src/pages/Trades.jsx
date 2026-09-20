import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen, ChevronRight, CalendarDays, MoreVertical, ArrowRight, ArrowLeft, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
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

const GRAD = "linear-gradient(90deg, #2563EB, #10B981)";

/* Confirmation popup — Sell / One Shot / Cycle sab isi se */
function ConfirmModal({ open, title, desc, confirmLabel, danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.45)", touchAction: "manipulation" }} onClick={onCancel} data-testid="confirm-modal">
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: "var(--surface)", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
        <div className="font-display font-black text-lg" style={{ color: "var(--ink)" }}>{title}</div>
        <div className="text-[13px] leading-relaxed mt-2" style={{ color: "var(--text)" }}>{desc}</div>
        <div className="flex gap-2.5 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-black select-none"
            style={{ background: "var(--surface-3)", color: "var(--ink)", touchAction: "manipulation" }}
            data-testid="confirm-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-black text-white select-none"
            style={{ background: danger ? "#DC2626" : GRAD, touchAction: "manipulation" }}
            data-testid="confirm-yes"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function BotRow({ bot, onDone }) {
  const navigate = useNavigate();
  const ticker = useBinanceStream(bot.symbol);
  const [modal, setModal] = useState(null); // 'sell' | 'oneshot' | 'cycle'
  const isRunning = String(bot.status || "").toLowerCase() === "running";
  const live = (ticker?.price || 0) > 0 ? ticker.price : bot.avg_price || 0;
  const qty = bot.position_qty || 0;
  const avg = bot.avg_price || 0;
  const hasPos = qty > 0 && avg > 0;
  const floating = hasPos ? qty * live - qty * avg : 0;
  const floatPct = hasPos && avg > 0 ? ((live - avg) / avg) * 100 : 0;
  const negative = floating < 0;
  const round = bot.cycles_completed || 0;
  const mode = bot.trade_mode || "cycle";
  const sym = bot.symbol.replace(/USDT$/, "");

  // Take Profit badge: % at which auto-sell fires.
  // Base = TP ratio; once armed (price crossed TP), trailing % follows the
  // peak — it can also sit BELOW the base (e.g. +1.3% after a 1.6% spike).
  const tpRatio = bot.whole_take_profit_ratio || 1.5;
  const tpCb = bot.whole_take_profit_callback || 0.3;
  const tpHitLive = hasPos && live >= avg * (1 + tpRatio / 100);
  const effPeak = Math.max(bot.peak_price || 0, tpHitLive ? live : 0);
  let wftPct = tpRatio;
  if (hasPos && effPeak > 0) {
    wftPct = ((effPeak * (1 - tpCb / 100) - avg) / avg) * 100;
  }

  const act = async () => {
    const action = modal;
    setModal(null);
    const tid = toast.loading(action === "sell" ? `Selling ${sym} position...` : `Switching ${sym} mode...`);
    try {
      if (action === "sell") {
        const { data } = await api.post(`/bots/${bot.symbol}/sell-now`);
        const p = data.profit || 0;
        toast.success(`${sym} sold at $${fmtNum(data.price, 4)} · P&L ${p >= 0 ? "+" : ""}$${fmtNum(p, 2)}`, { id: tid });
      } else {
        await api.post(`/bots/${bot.symbol}/mode`, { mode: action });
        toast.success(
          action === "oneshot"
            ? `${sym}: One Shot mode ON — bot will stop after next profit is booked`
            : `${sym}: Cycle mode ON — auto re-buy enabled`,
          { id: tid }
        );
      }
      onDone && onDone();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Action failed", { id: tid });
    }
  };

  const modalCfg = {
    sell: {
      title: `Sell ${sym} Position?`,
      desc: `Your current position (${fmtNum(qty, 4)} ${sym}) will be SOLD instantly at market price and the P&L will be booked. Are you sure?`,
      confirmLabel: "Yes, Sell Now",
      danger: true,
    },
    oneshot: {
      title: "One Shot Mode?",
      desc: `The ${sym} bot will STOP right after the next profit is booked — it will not re-buy. The current position will still sell normally at Take Profit.`,
      confirmLabel: "Yes, One Shot",
    },
    cycle: {
      title: "Cycle Mode?",
      desc: `The ${sym} bot will automatically RE-BUY after every profit is booked and keep running rounds continuously.`,
      confirmLabel: "Yes, Cycle On",
    },
  };

  return (
    <div
      onClick={() => navigate(`/pair/${bot.symbol}`)}
      className="w-full text-left rounded-xl px-3 py-2.5 cursor-pointer"
      style={{ ...CARD, touchAction: "manipulation" }}
      data-testid={`bot-card-${bot.symbol}`}
    >
      <div className="flex items-center gap-2.5">
        <CoinIcon symbol={sym} size={34} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-black leading-tight" style={{ color: "var(--ink)" }}>
            {sym}/USDT
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-mute)" }}>
            {mode === "oneshot" ? "ONE SHOT" : "CYCLE"} ·{" "}
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

      {/* CYCLE / ONE SHOT / SELL NOW */}
      <div className="grid grid-cols-3 gap-1.5 mt-2.5" style={{ touchAction: "manipulation" }} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => mode !== "cycle" && setModal("cycle")}
          className="rounded-lg py-1.5 px-1 flex items-center justify-center gap-1 select-none"
          style={mode === "cycle"
            ? { background: GRAD, color: "#fff", touchAction: "manipulation" }
            : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)", touchAction: "manipulation" }}
          data-testid={`bot-cycle-btn-${bot.symbol}`}
        >
          <RefreshCw size={12} className="shrink-0" />
          <span className="text-[10px] font-black tracking-wide">CYCLE</span>
        </button>
        <button
          onClick={() => mode !== "oneshot" && setModal("oneshot")}
          className="rounded-lg py-1.5 px-1 flex items-center justify-center gap-1 select-none"
          style={mode === "oneshot"
            ? { background: GRAD, color: "#fff", touchAction: "manipulation" }
            : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)", touchAction: "manipulation" }}
          data-testid={`bot-oneshot-btn-${bot.symbol}`}
        >
          <span className="w-[13px] h-[13px] rounded-full flex items-center justify-center text-[8.5px] font-black shrink-0"
            style={mode === "oneshot" ? { border: "1.5px solid #fff" } : { border: "1.5px solid var(--ink)" }}>1</span>
          <span className="text-[10px] font-black tracking-wide">ONE SHOT</span>
        </button>
        <button
          onClick={() => hasPos && setModal("sell")}
          className="rounded-lg py-1.5 px-1 flex items-center justify-center gap-1 select-none"
          style={{ background: "var(--surface)", border: "1px solid var(--ink)", color: "var(--ink)", opacity: hasPos ? 1 : 0.45, touchAction: "manipulation" }}
          data-testid={`bot-sellnow-btn-${bot.symbol}`}
        >
          <Send size={11} className="shrink-0" />
          <span className="text-[10px] font-black tracking-wide">SELL NOW</span>
        </button>
      </div>

      <div className="flex items-end justify-between mt-2.5">
        <div>
          <div className="text-[10px] font-semibold" style={{ color: "var(--text-mute)" }}>Live Price</div>
          <div className="text-[15px] font-black tabular-nums leading-tight" style={{ color: "var(--ink)" }}>
            {fmtPrice(live)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-semibold" style={{ color: "var(--text-mute)" }}>Floating P&L</div>
          <div className="text-[15px] font-black tabular-nums leading-tight" style={{ color: hasPos ? (negative ? "var(--bad)" : "var(--good)") : "var(--text-mute)" }}>
            {hasPos ? `$${negative ? "-" : "+"}${fmtNum(Math.abs(floating), 2)}` : "—"}
            {hasPos && (
              <span className="text-[10.5px] font-bold"> ({negative ? "" : "+"}{fmtNum(floatPct, 2)}%)</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold" style={{ color: "var(--text-mute)" }}>Position</div>
          <div className="text-[13px] font-black tabular-nums leading-tight" style={{ color: "var(--ink)" }}>
            <span style={{ color: "var(--good)" }}>{bot.buy_count || 0}</span> Buys ·{" "}
            <span style={{ color: "var(--bad)" }}>{bot.sell_count || 0}</span> Sells
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
        {isRunning && (
          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 leading-none"
            style={{ border: "1px solid var(--good)", background: "rgba(16,185,129,0.08)" }}
            data-testid={`bot-wft-${bot.symbol}`}
          >
            <span className="text-[8.5px] font-black tracking-[0.08em] uppercase" style={{ color: "var(--text-mute)" }}>Take Profit</span>
            <span className="text-[11.5px] font-black tabular-nums" style={{ color: "var(--good)" }}>
              +{fmtNum(wftPct, 2)}%
            </span>
          </div>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <ConfirmModal
          open={!!modal}
          {...(modalCfg[modal] || {})}
          onConfirm={act}
          onCancel={() => setModal(null)}
        />
      </div>
    </div>
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
  const reloadBots = () => {
    api.get("/bots").then(({ data }) => setBots(data)).catch(() => {});
  };
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
          shown.map((b) => <BotRow key={b.symbol} bot={b} onDone={reloadBots} />)
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
