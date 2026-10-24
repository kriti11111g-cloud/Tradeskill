import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen, ChevronRight, CalendarDays, MoreVertical, ArrowRight, ArrowLeft, RefreshCw, Send, TrendingUp, Database, HelpCircle, Link2 } from "lucide-react";
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

function AverageModal({ open, symbol, sym, onConfirm, onCancel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amt, setAmt] = useState("");
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!open) { setData(null); setAmt(""); setConfirming(false); return; }
    setLoading(true);
    api.get(`/bots/${symbol}/average-preview`)
      .then(({ data }) => { setData(data); setAmt(data.suggested_buy ? String(data.suggested_buy) : ""); })
      .catch((e) => { toast.error(e?.response?.data?.detail || "Could not load"); onCancel(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, symbol]);
  if (!open) return null;

  const buy = parseFloat(amt) || 0;
  const live = data?.live_price || 0;
  const qty = data?.position_qty || 0;
  const avg = data?.current_avg_price || 0;
  const suggested = data?.suggested_buy || 0;
  const neg = data && data.current_loss < 0;
  const addQty = buy > 0 && live > 0 ? buy / live : 0;
  const newQty = qty + addQty;
  const newAvg = newQty > 0 ? (qty * avg + buy) / newQty : avg;
  const newPosVal = newQty * live;         // position value at live price after buy
  const newLossPct = newAvg > 0 ? ((live - newAvg) / newAvg) * 100 : 0;
  const newNeg = newLossPct < 0;
  const costBasis = qty * avg + buy;        // total invested after this buy
  const estPnl = newPosVal - costBasis;     // P&L at current live price after buy
  const estPnlPct = costBasis > 0 ? (estPnl / costBasis) * 100 : 0;
  const estNeg = estPnl < 0;
  const qtyDec = newQty >= 1000 ? 2 : newQty >= 1 ? 4 : 6;
  const canStart = buy >= 10 && !busy;
  const PCTS = [25, 50, 75, 100];
  const pctAmount = (p) => Math.round((suggested * p) / 100 * 100) / 100;
  const activePct = suggested > 0 ? PCTS.find((p) => Math.abs(buy - pctAmount(p)) < 0.01) : null;

  const start = async () => {
    if (!canStart) return;
    setBusy(true);
    const tid = toast.loading(`Averaging ${sym}...`);
    try {
      const { data: r } = await api.post(`/bots/${symbol}/average`, { amount: buy });
      toast.success(`${sym} averaged · New Avg ${fmtPrice(r.new_avg_price)}`, { id: tid });
      onConfirm();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Average failed", { id: tid });
      setBusy(false);
    }
  };

  const Row = ({ l, v, c }) => (
    <div className="flex items-center justify-between">
      <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-mute)" }}>{l}</span>
      <span className="text-[13.5px] font-black tabular-nums" style={{ color: c || "var(--ink)" }}>{v}</span>
    </div>
  );

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.45)", touchAction: "manipulation" }} onClick={onCancel} data-testid="average-modal">
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: "var(--surface)", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <TrendingUp size={18} style={{ color: "#2563EB" }} />
          <div className="font-display font-black text-lg" style={{ color: "var(--ink)" }}>Average {sym}</div>
        </div>
        {loading || !data ? (
          <div className="py-8 text-center text-sm" style={{ color: "var(--text-mute)" }}>Loading…</div>
        ) : (
          <>
            {/* current state */}
            <div className="mt-4 space-y-2.5">
              <Row l="Current Avg Price" v={fmtPrice(avg)} />
              <Row l="Current Loss" v={`${neg ? "-" : "+"}$${fmtNum(Math.abs(data.current_loss), 2)} (${fmtNum(data.current_loss_pct, 2)}%)`} c={neg ? "var(--bad)" : "var(--good)"} />
              <Row l="Current Position" v={`$${fmtNum(qty * live, 2)}`} />
            </div>

            {/* quick % chips — suggested amount ke 4 bhaag */}
            {suggested > 0 && (
              <div className="mt-4">
                <div className="text-[12px] font-bold mb-1.5" style={{ color: "var(--text-mute)" }}>Quick Select</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {PCTS.map((p) => {
                    const on = activePct === p;
                    return (
                      <button
                        key={p}
                        onClick={() => { setConfirming(false); setAmt(String(pctAmount(p))); }}
                        className="py-2 rounded-lg text-[12px] font-black select-none"
                        style={on
                          ? { background: GRAD, color: "#fff", touchAction: "manipulation" }
                          : { background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--ink)", touchAction: "manipulation" }}
                        data-testid={`average-pct-${p}`}
                      >
                        {p}%
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* editable / custom amount */}
            <div className="mt-3">
              <label className="text-[12px] font-bold" style={{ color: "var(--text-mute)" }}>Buy Amount (USDT) · Custom</label>
              <input
                type="number" inputMode="decimal" value={amt}
                onChange={(e) => { setConfirming(false); setAmt(e.target.value); }}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-[15px] font-black tabular-nums outline-none"
                style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--ink)" }}
                data-testid="average-amount-input"
              />
              <div className="text-[10.5px] mt-1" style={{ color: "var(--text-mute)" }}>
                Suggested (100%) ${fmtNum(suggested, 2)} · buys from your exchange balance
              </div>
            </div>

            {/* live preview after buy */}
            <div className="mt-4 pt-3 space-y-2.5" style={{ borderTop: "1px dashed var(--border)" }}>
              <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: "#2563EB" }}>After This Buy</div>
              <Row l="New Position" v={`$${fmtNum(newPosVal, 2)}`} />
              <Row l="New Avg Price" v={fmtPrice(newAvg)} c="var(--ink)" />
              <Row l="Estimated P&L at Live Price" v={`${estNeg ? "-" : "+"}$${fmtNum(Math.abs(estPnl), 2)} (${fmtNum(estPnlPct, 2)}%)`} c={estNeg ? "var(--bad)" : "var(--good)"} />
              <Row l="Recovery Price" v={fmtPrice(newAvg)} />
            </div>
            <div className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--text-mute)" }}>
              This is an estimated value. Final price may vary based on market and executed order.
            </div>

            <div className="flex gap-2.5 mt-4">
              <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[13px] font-black select-none" style={{ background: "var(--surface-3)", color: "var(--ink)", touchAction: "manipulation" }} data-testid="average-cancel">Cancel</button>
              <button onClick={() => canStart && setConfirming(true)} disabled={!canStart} className="flex-1 py-2.5 rounded-xl text-[12px] font-black text-white select-none tracking-wide" style={{ background: canStart ? GRAD : "#9CA3AF", touchAction: "manipulation" }} data-testid="average-start">START AVERAGE BUY</button>
            </div>
            <div className="text-[10.5px] mt-2 text-center" style={{ color: "var(--text-mute)" }}>
              Min $10 · new average becomes the base, Safety Call restarts at C1
            </div>
          </>
        )}
      </div>
    </div>

    {/* Dedicated "Confirm Average Buy" dialog */}
    {confirming && data && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.55)", touchAction: "manipulation" }} onClick={() => !busy && setConfirming(false)} data-testid="average-confirm-dialog">
        <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--surface)", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ border: "2.5px solid #2563EB", background: "rgba(37,99,235,0.08)" }}>
              <HelpCircle size={34} style={{ color: "#2563EB" }} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-center font-display font-black text-xl mt-4" style={{ color: "var(--ink)" }} data-testid="average-confirm-title">Confirm Average Buy</div>
          <div className="text-center text-[14px] leading-relaxed mt-2" style={{ color: "var(--text)" }} data-testid="average-confirm-text">
            Are you sure you want to buy <b>{buy.toFixed(2)} USDT</b> more on {sym}/USDT for averaging?
          </div>

          <div className="mt-4 rounded-xl p-3.5 space-y-2.5" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-mute)" }}>Additional Amount</span>
              <span className="text-[13.5px] font-black tabular-nums" style={{ color: "var(--ink)" }}>{buy.toFixed(2)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-mute)" }}>Estimated New Average</span>
              <span className="text-[13.5px] font-black tabular-nums" style={{ color: "var(--ink)" }}>{fmtNum(newAvg, newAvg >= 100 ? 2 : 4)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-mute)" }}>Estimated New Quantity</span>
              <span className="text-[13.5px] font-black tabular-nums" style={{ color: "var(--ink)" }}>{fmtNum(newQty, qtyDec)} {sym}</span>
            </div>
          </div>

          <div className="flex gap-2.5 mt-5">
            <button onClick={() => setConfirming(false)} disabled={busy} className="flex-1 py-3 rounded-xl text-[14px] font-black select-none" style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--ink)", touchAction: "manipulation" }} data-testid="average-confirm-no">Cancel</button>
            <button onClick={start} disabled={busy} className="flex-1 py-3 rounded-xl text-[14px] font-black text-white select-none" style={{ background: "#2563EB", opacity: busy ? 0.7 : 1, touchAction: "manipulation" }} data-testid="average-confirm-yes">{busy ? "Confirming…" : "Confirm"}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function BotRow({ bot, onDone }) {
  const navigate = useNavigate();
  const ticker = useBinanceStream(bot.symbol);
  const [modal, setModal] = useState(null); // 'sell' | 'oneshot' | 'cycle'
  const [avgOpen, setAvgOpen] = useState(false);
  const isRunning = String(bot.status || "").toLowerCase() === "running";
  const live = (ticker?.price || 0) > 0 ? ticker.price : bot.avg_price || 0;
  const qty = bot.position_qty || 0;
  const avg = bot.avg_price || 0;
  const hasPos = qty > 0 && avg > 0;
  const floating = hasPos ? qty * live - qty * avg : 0;
  const floatPct = hasPos && avg > 0 ? ((live - avg) / avg) * 100 : 0;
  const negative = floating < 0;
  const round = bot.cycles_completed || 0; // eslint-disable-line no-unused-vars
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
      onClick={() => navigate(`/trade-settings/${bot.symbol}`)}
      className="w-full text-left rounded-xl px-3 py-2.5 cursor-pointer"
      style={{ ...CARD, ...(isRunning ? { border: "1.5px solid #2563EB" } : {}), touchAction: "manipulation" }}
      data-testid={`bot-card-${bot.symbol}`}
    >
      <div className="flex items-center gap-2.5">
        <CoinIcon symbol={sym} size={34} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[14px] font-black leading-tight" style={{ color: "var(--ink)" }}>
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

      {/* AVERAGE · SBM · TP — top row ke bilkul same size/look/layout */}
      <div className="grid grid-cols-3 gap-1.5 mt-2.5" style={{ touchAction: "manipulation" }} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => hasPos && setAvgOpen(true)}
          className="rounded-lg py-1.5 px-1 flex items-center justify-center gap-1 select-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)", opacity: hasPos ? 1 : 0.45, touchAction: "manipulation" }}
          data-testid={`bot-average-btn-${bot.symbol}`}
        >
          <TrendingUp size={12} className="shrink-0" />
          <span className="text-[10px] font-black tracking-wide">AVERAGE</span>
        </button>
        <button
          onClick={() => toast.info("SBM — Coming soon")}
          className="rounded-lg py-1.5 px-1 flex items-center justify-center gap-1 select-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)", touchAction: "manipulation" }}
          data-testid={`bot-sbm-btn-${bot.symbol}`}
        >
          <Plus size={12} className="shrink-0" />
          <span className="text-[10px] font-black tracking-wide">SBM</span>
        </button>
        <div
          className="rounded-lg py-1.5 px-1 flex items-center justify-center gap-1 select-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--good)", touchAction: "manipulation" }}
          data-testid={`bot-tp-${bot.symbol}`}
        >
          <Database size={12} className="shrink-0" />
          <span className="text-[10px] font-black tracking-wide">TP +{fmtNum(wftPct, 2)}%</span>
        </div>
      </div>

      {(bot.last_trade_error || bot.stop_reason) && !hasPos && (
        <div
          className="mt-2 rounded-lg px-2.5 py-2 text-[10.5px] font-semibold leading-snug"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--bad)" }}
          data-testid={`bot-error-banner-${bot.symbol}`}
        >
          <span className="font-black">Last order failed: </span>
          {bot.last_trade_error || bot.stop_reason}
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <ConfirmModal
          open={!!modal}
          {...(modalCfg[modal] || {})}
          onConfirm={act}
          onCancel={() => setModal(null)}
        />
        <AverageModal
          open={avgOpen}
          symbol={bot.symbol}
          sym={sym}
          onConfirm={() => { setAvgOpen(false); onDone && onDone(); }}
          onCancel={() => setAvgOpen(false)}
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

const EX_META = {
  binance: { id: "binance", name: "Binance", mono: "B", color: "#F3BA2F", logo: "https://coin-images.coingecko.com/markets/images/52/small/binance.jpg" },
  kucoin: { id: "kucoin", name: "KuCoin", mono: "K", color: "#24AE8F", logo: "https://coin-images.coingecko.com/markets/images/61/small/kucoin.png" },
  lbank: { id: "lbank", name: "LBank", mono: "L", color: "#1E88E5", logo: "https://coin-images.coingecko.com/markets/images/50/small/lbank.jpg" },
};

export default function Trades() {
  const [bots, setBots] = useState(null);
  const [bind, setBind] = useState(null);
  const [connected, setConnected] = useState(null); // any exchange bound? null=loading
  const [exUsdt, setExUsdt] = useState(null);
  const [exMeta, setExMeta] = useState({ id: "binance", name: "Binance" });
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
      const [b, bBn, bKc, bLb] = await Promise.all([
        api.get("/bots").then((r) => (Array.isArray(r.data) ? r.data : r.data.bots || [])).catch(() => []),
        api.get("/binance/bind").then((r) => r.data).catch(() => null),
        api.get("/kucoin/bind").then((r) => r.data).catch(() => null),
        api.get("/lbank/bind").then((r) => r.data).catch(() => null),
      ]);
      setBots(b);
      // Connected = any bind record exists (demo included) — matches backend trade gate.
      setConnected(!!(bBn?.mode || bKc?.mode || bLb?.mode));
      // Connected exchange: whichever is actually bound (one exchange per account)
      const connId = bLb?.mode ? "lbank" : bKc?.mode ? "kucoin" : bBn?.mode ? "binance" : "binance";
      const bd = connId === "lbank" ? bLb : connId === "kucoin" ? bKc : bBn;
      setBind(bd);
      setExMeta(EX_META[connId]);
      try { localStorage.setItem("tgx_trade_cache", JSON.stringify({ bots: b, bind: bd })); } catch {}
      // Exchange card par user ka live USDT balance (jis exchange se bound hai)
      if (bd?.bound) {
        api.get(`/${connId}/account`).then(({ data }) => {
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
          <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: exMeta.color || "#F3BA2F" }}>
            <span className="text-[13px] font-black text-white">{exMeta.mono || "B"}</span>
            <img
              src={exMeta.logo}
              alt={exMeta.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-black" style={{ color: "var(--ink)" }}>{exMeta.name}</div>
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

      {/* Connect-exchange prompt — jab tak koi exchange bind nahi, trade nahi lagega */}
      {connected === false && (
        <div className="px-4 mt-3">
          <button
            onClick={() => navigate("/bind-api")}
            className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left"
            style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", touchAction: "manipulation" }}
            data-testid="trade-connect-banner"
          >
            <Link2 size={20} style={{ color: "#B45309" }} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-black" style={{ color: "#B45309" }}>Connect an exchange to start trading</div>
              <div className="text-[10.5px] font-semibold mt-0.5" style={{ color: "#B45309", opacity: 0.85 }}>
                Binance, KuCoin ya LBank bind karein — tab tak koi bot trade nahi lagayega. Tap to connect.
              </div>
            </div>
            <ChevronRight size={18} style={{ color: "#B45309" }} className="shrink-0" />
          </button>
        </div>
      )}

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
