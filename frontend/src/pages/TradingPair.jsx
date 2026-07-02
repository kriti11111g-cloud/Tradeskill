import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Play, Square, TrendingUp, TrendingDown, Repeat, Target, XCircle, Pencil } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtNum, fmtPct, shortSymbol } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import CoinIcon from "@/components/CoinIcon";
import useBinanceStream from "@/hooks/useBinanceStream";

const fields = [
  { key: "first_buy_amount", label: "First Buy In Amount (USDT)", step: 0.5, type: "number" },
  { key: "margin_call_limit", label: "Margin Call Limit", step: 1, type: "number" },
  { key: "whole_take_profit_ratio", label: "Whole Take Profit Ratio (%)", step: 0.1, type: "number" },
  { key: "whole_take_profit_callback", label: "Whole TP Callback (%)", step: 0.1, type: "number" },
  { key: "buy_in_callback", label: "Buy In Callback (%)", step: 0.1, type: "number" },
  { key: "sub_take_profit_callback", label: "Sub TP Callback (%)", step: 0.1, type: "number" },
];

export default function TradingPair() {
  const { symbol } = useParams();
  const sym = (symbol || "BTCUSDT").toUpperCase();
  const { refresh } = useAuth();

  const [bot, setBot] = useState(null);
  const [stats, setStats] = useState(null);
  const [tradeQty, setTradeQty] = useState("");
  const [buyAmt, setBuyAmt] = useState("");
  const [bind, setBind] = useState(null);
  const [events, setEvents] = useState([]);
  const [posEditOpen, setPosEditOpen] = useState(false);
  const [posEdit, setPosEdit] = useState({ position_qty: "", avg_price: "", margin_call_count: "" });
  const [live, setLive] = useState(null);
  const [pairRev, setPairRev] = useState(null);

  // ★ Real-time price via Binance's OFFICIAL public WebSocket — exactly the price
  // shown on binance.com. Sub-second updates; no discrepancy vs the exchange.
  const stream = useBinanceStream(sym);
  const price = stream.price > 0 ? stream.price : (stats ? parseFloat(stats.lastPrice) : 0);
  const change24 = stream.price > 0 ? stream.change : (stats ? parseFloat(stats.priceChangePercent) : 0);

  const loadAll = async () => {
    const [b, s, bd, ev, pr] = await Promise.all([
      api.get(`/bots/${sym}`).then((r) => r.data),
      api.get(`/market/stats/${sym}`).then((r) => r.data).catch(() => null),
      api.get(`/binance/bind`).then((r) => r.data).catch(() => null),
      api.get(`/bots/${sym}/events`).then((r) => r.data).catch(() => []),
      api.get(`/revenue/pair/${sym}`).then((r) => r.data).catch(() => null),
    ]);
    setBot(b);
    setStats(s);
    setBind(bd);
    setEvents(ev);
    setPairRev(pr);
    setBuyAmt(b.first_buy_amount);
    // If real/testnet, fetch live Binance balances
    if (bd?.mode === "real" || bd?.mode === "testnet") {
      try {
        const { data } = await api.get("/binance/account");
        setLive(data);
      } catch {
        setLive(null);
      }
    } else {
      setLive(null);
    }
  };

  useEffect(() => {
    loadAll();
    // Poll bot state + events every 8s so the user sees auto-trades in near-real-time
    const stateId = setInterval(() => {
      Promise.all([
        api.get(`/bots/${sym}`).then((r) => r.data).catch(() => null),
        api.get(`/bots/${sym}/events`).then((r) => r.data).catch(() => []),
        api.get(`/revenue/pair/${sym}`).then((r) => r.data).catch(() => null),
      ]).then(([b, ev, pr]) => {
        if (b) setBot(b);
        setEvents(ev);
        if (pr) setPairRev(pr);
      });
    }, 8000);
    return () => {
      clearInterval(stateId);
    };
  }, [sym]);

  if (!bot) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const returnRate = bot.avg_price > 0 ? ((price - bot.avg_price) / bot.avg_price) * 100 : 0;

  const startBot = async () => {
    try {
      await api.post(`/bots/${sym}/start`);
      toast.success("Bot started");
      loadAll();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };
  const stopBot = async () => {
    try {
      await api.post(`/bots/${sym}/stop`);
      toast.success("Bot stopped");
      loadAll();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const placeOrder = async (side) => {
    try {
      const body = { symbol: sym, side };
      if (side === "BUY") body.usdt_amount = parseFloat(buyAmt) || bot.first_buy_amount;
      else body.quantity = parseFloat(tradeQty) || bot.position_qty;
      const { data } = await api.post("/trade/order", body);
      toast.success(
        side === "BUY"
          ? `Bought ${fmtNum(data.quantity)} ${shortSymbol(sym)}`
          : `Sold · P&L ${fmtUSD(data.profit)}`,
      );
      loadAll();
      refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const closePosition = async () => {
    if (bot.position_qty <= 0) return toast.error("No position to close");
    try {
      const { data } = await api.post("/trade/order", { symbol: sym, side: "SELL", quantity: bot.position_qty });
      toast.success(`Closed · P&L ${fmtUSD(data.profit)}`);
      loadAll();
      refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const saveConfig = async () => {
    try {
      await api.post(`/bots/${sym}`, bot);
      toast.success("Strategy saved");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const suggest = () => {
    setBot({
      ...bot,
      first_buy_amount: 10,
      margin_call_limit: 5,
      whole_take_profit_ratio: 1.6,
      whole_take_profit_callback: 0.2,
      buy_in_callback: 0.2,
      sub_take_profit_callback: 0.2,
      trade_method: "Cycle",
      margin_config: [
        { drop: 2, multiplier: 2 },
        { drop: 3, multiplier: 2 },
        { drop: 4, multiplier: 2 },
        { drop: 6, multiplier: 2 },
        { drop: 10, multiplier: 2 },
      ],
    });
    toast.info("Suggested strategy loaded");
  };

  const openPosEdit = () => {
    setPosEdit({
      position_qty: String(bot.position_qty || 0),
      avg_price: String(bot.avg_price || 0),
      margin_call_count: String(bot.margin_call_count || 0),
    });
    setPosEditOpen(true);
  };

  const importFromBinance = () => {
    if (!live) {
      toast.error("Live balances not loaded");
      return;
    }
    const base = live.balances.find((b) => b.asset === shortSymbol(sym));
    if (!base || base.free <= 0) {
      toast.error(`No ${shortSymbol(sym)} balance found on Binance`);
      return;
    }
    setPosEdit((prev) => ({
      ...prev,
      position_qty: String(base.free),
      // If user hasn't set avg yet, prefill with the current market price so they can adjust
      avg_price: prev.avg_price && parseFloat(prev.avg_price) > 0 ? prev.avg_price : String(price || 0),
    }));
    toast.success(`Imported ${base.free} ${shortSymbol(sym)} from Binance`);
  };

  const submitPosEdit = async () => {
    try {
      await api.post(`/bots/${sym}/position`, {
        position_qty: parseFloat(posEdit.position_qty) || 0,
        avg_price: parseFloat(posEdit.avg_price) || 0,
        margin_call_count: parseInt(posEdit.margin_call_count, 10) || 0,
        reset_peak: true,
      });
      toast.success("Position updated");
      setPosEditOpen(false);
      loadAll();
      refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const updateMarginRow = (idx, key, value) => {
    const cfg = [...(bot.margin_config || [])];
    cfg[idx] = { ...cfg[idx], [key]: parseFloat(value) };
    setBot({ ...bot, margin_config: cfg });
  };

  const addMarginRow = () => {
    const cfg = [...(bot.margin_config || [])];
    const last = cfg[cfg.length - 1] || { drop: 2, multiplier: 2 };
    cfg.push({ drop: last.drop, multiplier: last.multiplier });
    setBot({ ...bot, margin_config: cfg, margin_call_limit: cfg.length });
  };

  const removeMarginRow = (idx) => {
    const cfg = [...(bot.margin_config || [])];
    cfg.splice(idx, 1);
    setBot({ ...bot, margin_config: cfg, margin_call_limit: cfg.length });
  };

  return (
    <div className="pb-4">
      <PageHeader
        title={`${shortSymbol(sym)}/USDT`}
        subtitle={bot.trade_method + " · " + (bot.status || "stopped").toUpperCase()}
        right={
          <div className="flex items-center gap-1.5">
            {bind?.mode && bind.mode !== "demo" && (
              <div
                className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                  bind.mode === "real"
                    ? "bg-[#FF007A]/15 text-[#FF007A] border-[#FF007A]/40"
                    : "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/40"
                }`}
                data-testid="mode-badge"
              >
                {bind.mode}
              </div>
            )}
            <div
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                bot.status === "running"
                  ? "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/40"
                  : "bg-white/5 text-[#8B9BB4] border border-white/25"
              }`}
              data-testid="bot-status"
            >
              {bot.status === "running" ? "● Running" : "Stopped"}
            </div>
          </div>
        }
      />

      {/* Price header */}
      <div className="px-4">
        <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <CoinIcon symbol={sym} size={40} />
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold">Current Price</div>
                  {stream.connected ? (
                    <span
                      className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-bold text-[#39FF14]"
                      data-testid="ws-live"
                      title="Real-time via Binance WebSocket · same price as binance.com"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-tgx-pulse" />
                      LIVE
                    </span>
                  ) : (
                    <span
                      className="text-[9px] uppercase tracking-widest font-bold text-[#8B9BB4]"
                      data-testid="ws-connecting"
                    >
                      Connecting…
                    </span>
                  )}
                </div>
                <div className="font-display font-black text-3xl tabular-nums mt-0.5" data-testid="current-price">
                  {fmtUSD(price, price > 100 ? 2 : 4)}
                </div>
              </div>
            </div>
            {(stats || stream.price > 0) && (
              <div className="text-right">
                <div className={`font-display font-bold text-lg tabular-nums ${change24 >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"}`}>
                  {fmtPct(change24)}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] mt-1">24H Change</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real Binance Fund strip (live/testnet only) */}
      {live && (bind?.mode === "real" || bind?.mode === "testnet") && (() => {
        const usdt = live.balances.find((b) => b.asset === "USDT");
        const base = live.balances.find((b) => b.asset === shortSymbol(sym));
        const baseFree = base?.free || 0;
        const shortfall = bot.position_qty > baseFree ? bot.position_qty - baseFree : 0;
        return (
          <>
            <div className="px-4 mt-3">
              <div
                className={`rounded-2xl border p-3 flex items-center justify-between ${
                  bind.mode === "real"
                    ? "border-[#FF007A]/30 bg-[#FF007A]/5"
                    : "border-[#FFD700]/30 bg-[#FFD700]/5"
                }`}
                data-testid="pair-live-fund"
              >
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold">
                    Real Fund on Binance ·{" "}
                    <span className={bind.mode === "real" ? "text-[#FF007A]" : "text-[#FFD700]"}>
                      {bind.mode}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 mt-0.5">
                    <div>
                      <div className="font-display font-black text-base tabular-nums">
                        {fmtNum(usdt?.free || 0, 2)} <span className="text-[10px] text-[#8B9BB4] font-normal">USDT</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-display font-bold text-sm tabular-nums text-[#00F0FF]">
                        {fmtNum(baseFree, 6)} <span className="text-[10px] text-[#8B9BB4] font-normal">{shortSymbol(sym)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {shortfall > 0 && bot.position_qty > 0 && (
              <div className="px-4 mt-3">
                <div
                  className="bg-[#FF007A]/10 border border-[#FF007A]/40 rounded-2xl p-3 flex items-start gap-3"
                  data-testid="sell-warning"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#FF007A]/20 flex items-center justify-center flex-shrink-0">
                    <span className="font-display font-black text-[14px] text-[#FF007A]">!</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-display font-bold text-sm text-[#FF007A]">
                      Auto-Sell will fail
                    </div>
                    <div className="text-[11px] text-white/85 mt-0.5 leading-relaxed">
                      Bot tracks{" "}
                      <span className="font-bold tabular-nums">{fmtNum(bot.position_qty, 6)}</span>{" "}
                      {shortSymbol(sym)}, but Binance only holds{" "}
                      <span className="font-bold tabular-nums">{fmtNum(baseFree, 6)}</span>. Shortfall:{" "}
                      <span className="font-bold tabular-nums text-[#FF007A]">{fmtNum(shortfall, 6)} {shortSymbol(sym)}</span>.
                    </div>
                    <div className="text-[10px] text-[#8B9BB4] mt-1">
                      Either{" "}
                      <button
                        type="button"
                        onClick={openPosEdit}
                        className="underline text-[#00F0FF] font-bold"
                        data-testid="warn-adjust"
                      >
                        adjust the tracked position
                      </button>{" "}
                      to match Binance, or deposit the missing amount before the next TP/Close.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Pair-level Profit banner (matches HiTechBot layout) */}
      <div className="px-4 mt-3">
        <div
          className="rounded-2xl border border-white/25 p-4 flex items-stretch gap-3 bg-gradient-to-br from-[#0F1524]/80 to-[#050914]/60 backdrop-blur-xl"
          data-testid="pair-revenue-banner"
        >
          <div className="flex-1">
            <div className="text-[9px] uppercase tracking-[0.25em] text-[#8B9BB4] font-bold">
              Today&apos;s Profit
            </div>
            <div
              className={`font-display font-black text-2xl tabular-nums mt-1 ${
                (pairRev?.today_profit || 0) >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
              }`}
              data-testid="pair-today-profit"
            >
              {(pairRev?.today_profit || 0) >= 0 ? "+" : ""}
              {fmtNum(pairRev?.today_profit || 0, 4)}
            </div>
          </div>
          <div className="w-px bg-white/15" />
          <div className="flex-1">
            <div className="text-[9px] uppercase tracking-[0.25em] text-[#8B9BB4] font-bold">
              Cumulative Profit
            </div>
            <div
              className={`font-display font-black text-2xl tabular-nums mt-1 ${
                (pairRev?.cumulative_profit || 0) >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
              }`}
              data-testid="pair-cum-profit"
            >
              {(pairRev?.cumulative_profit || 0) >= 0 ? "+" : ""}
              {fmtNum(pairRev?.cumulative_profit || 0, 4)}
            </div>
            <div className="text-[9px] text-[#8B9BB4] mt-0.5">
              {pairRev?.sell_count || 0} sells
            </div>
          </div>
        </div>
      </div>

      {/* Position Stats grid */}
      <div className="px-4 mt-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#8B9BB4] font-bold">Position</div>
          <button
            onClick={openPosEdit}
            data-testid="edit-position-btn"
            className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#00F0FF] font-bold border border-[#00F0FF]/40 rounded-full px-2.5 py-1 hover:bg-[#00F0FF]/10"
          >
            <Pencil size={11} /> Edit
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4">
        {[
          { label: "Position Amount (USDT)", value: fmtNum(bot.position_amount, 2) },
          { label: "Avg Price", value: fmtNum(bot.avg_price, 4) },
          { label: "Margin Calls", value: bot.margin_call_count },
          { label: `Position ${shortSymbol(sym)}`, value: fmtNum(bot.position_qty, 6) },
          { label: "Return Rate", value: fmtPct(returnRate), isPct: true, pctVal: returnRate },
          { label: "Trade Method", value: bot.trade_method },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3"
          >
            <div className="text-[9px] uppercase tracking-[0.18em] text-[#8B9BB4] font-bold leading-tight">
              {s.label}
            </div>
            <div
              className={`font-display font-bold text-base tabular-nums mt-1 ${
                s.isPct ? (s.pctVal >= 0 ? "text-[#39FF14]" : "text-[#FF007A]") : "text-white"
              }`}
            >
              {s.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Operation Reminder — auto-trigger prices */}
      <div className="px-4 mt-4">
        <div
          className="rounded-2xl border border-white/25 p-4 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,240,255,0.08), rgba(255,215,0,0.06)), #0F1524",
          }}
          data-testid="operation-reminder"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  bot.status === "running" ? "bg-[#39FF14] animate-tgx-pulse" : "bg-[#8B9BB4]"
                }`}
              />
              <div className="text-[10px] uppercase tracking-[0.25em] font-bold">
                Operation Reminder
              </div>
            </div>
            <div
              className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${
                bot.trigger_state === "tp_armed"
                  ? "text-[#39FF14] border-[#39FF14]/40 bg-[#39FF14]/10"
                  : bot.trigger_state === "waiting"
                  ? "text-[#00F0FF] border-[#00F0FF]/40 bg-[#00F0FF]/10"
                  : bot.trigger_state === "start_pending"
                  ? "text-[#FFD700] border-[#FFD700]/40 bg-[#FFD700]/10"
                  : "text-[#8B9BB4] border-white/25 bg-white/5"
              }`}
              data-testid="trigger-state"
            >
              {bot.trigger_state === "tp_armed"
                ? "TP Armed"
                : bot.trigger_state === "waiting"
                ? "Waiting for trigger"
                : bot.trigger_state === "start_pending"
                ? "First buy pending"
                : "Idle"}
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Margin call trigger */}
            <div className="flex items-center justify-between" data-testid="mc-trigger-row">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FFD700]/15 flex items-center justify-center">
                  <span className="font-display font-black text-[10px] text-[#FFD700]">MC</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold">
                    Margin call trigger price
                  </div>
                  <div className="text-[9px] text-[#8B9BB4]">
                    Auto-BUY when price ≤ trigger · {bot.margin_call_remaining} rounds left
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-black text-sm tabular-nums text-[#FFD700]">
                  {bot.margin_call_trigger_price > 0
                    ? `≤ ${fmtNum(bot.margin_call_trigger_price, 4)}`
                    : "—"}
                </div>
                {bot.margin_call_trigger_price > 0 && price > 0 && (
                  <div className="text-[9px] tabular-nums text-[#8B9BB4]">
                    {((price - bot.margin_call_trigger_price) / bot.margin_call_trigger_price * 100).toFixed(2)}% above
                  </div>
                )}
              </div>
            </div>

            {/* Take profit trigger */}
            <div className="flex items-center justify-between" data-testid="tp-trigger-row">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#39FF14]/15 flex items-center justify-center">
                  <span className="font-display font-black text-[10px] text-[#39FF14]">TP</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold">
                    Take profit trigger price
                  </div>
                  <div className="text-[9px] text-[#8B9BB4]">
                    Arms peak-tracker · {bot.whole_take_profit_ratio}% profit
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-black text-sm tabular-nums text-[#39FF14]">
                  {bot.take_profit_trigger_price > 0
                    ? `≥ ${fmtNum(bot.take_profit_trigger_price, 4)}`
                    : "—"}
                </div>
                {bot.take_profit_trigger_price > 0 && price > 0 && (
                  <div className="text-[9px] tabular-nums text-[#8B9BB4]">
                    {((bot.take_profit_trigger_price - price) / price * 100).toFixed(2)}% to go
                  </div>
                )}
              </div>
            </div>

            {/* TP pullback trigger (only shown once armed) */}
            {bot.tp_pullback_trigger_price > 0 && (
              <div className="flex items-center justify-between border-t border-white/20 pt-2.5" data-testid="tp-exit-row">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#FF007A]/15 flex items-center justify-center">
                    <span className="font-display font-black text-[10px] text-[#FF007A]">EX</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold">
                      Auto-exit price
                    </div>
                    <div className="text-[9px] text-[#8B9BB4]">
                      SELL all when price ≤ this (peak {fmtNum(bot.peak_price, 4)})
                    </div>
                  </div>
                </div>
                <div className="font-display font-black text-sm tabular-nums text-[#FF007A]">
                  ≤ {fmtNum(bot.tp_pullback_trigger_price, 4)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-4 gap-2 px-4 mt-4">
        {[
          { icon: Target, label: "One-Shot", onClick: () => setBot({ ...bot, trade_method: "One-Shot" }), testid: "act-oneshot" },
          { icon: TrendingDown, label: "Sell", onClick: () => placeOrder("SELL"), testid: "act-sell", color: "text-[#FF007A]" },
          { icon: TrendingUp, label: "Buy", onClick: () => placeOrder("BUY"), testid: "act-buy", color: "text-[#39FF14]" },
          { icon: XCircle, label: "Close", onClick: closePosition, testid: "act-close", color: "text-[#FF007A]" },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.onClick}
            data-testid={b.testid}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/25 hover:border-[#00F0FF]/40 hover:bg-white/10 transition-all"
          >
            <b.icon size={20} strokeWidth={1.7} className={b.color || ""} />
            <span className="text-[10px] uppercase tracking-widest font-bold">{b.label}</span>
          </button>
        ))}
      </div>

      {/* Manual trade input */}
      <div className="px-4 mt-4">
        <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold mb-2">Manual Trade</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] uppercase tracking-widest text-[#8B9BB4]">Buy USDT</label>
              <input
                type="number"
                value={buyAmt}
                onChange={(e) => setBuyAmt(e.target.value)}
                className="w-full mt-1 bg-[#050914] border border-white/25 rounded-lg px-3 py-2 font-display font-medium tabular-nums text-sm focus:outline-none focus:border-[#00F0FF]"
                data-testid="input-buyamt"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest text-[#8B9BB4]">Sell Qty</label>
              <input
                type="number"
                value={tradeQty}
                onChange={(e) => setTradeQty(e.target.value)}
                placeholder={String(bot.position_qty || 0)}
                className="w-full mt-1 bg-[#050914] border border-white/25 rounded-lg px-3 py-2 font-display font-medium tabular-nums text-sm focus:outline-none focus:border-[#00F0FF]"
                data-testid="input-sellqty"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Config */}
      <div className="px-4 mt-4">
        <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-bold">Strategy Configuration</div>
            <button
              onClick={suggest}
              className="text-[10px] uppercase tracking-widest text-[#FFD700] font-bold border border-[#FFD700]/40 rounded-full px-3 py-1 hover:bg-[#FFD700]/10"
              data-testid="suggest-btn"
            >
              ⚡ Suggest
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="text-[9px] uppercase tracking-[0.18em] text-[#8B9BB4] font-bold leading-tight block">
                  {f.label}
                </label>
                <input
                  type={f.type}
                  step={f.step}
                  value={bot[f.key]}
                  onChange={(e) => setBot({ ...bot, [f.key]: parseFloat(e.target.value) })}
                  className="w-full mt-1 bg-[#050914] border border-white/25 rounded-lg px-3 py-2 font-display font-medium tabular-nums text-sm focus:outline-none focus:border-[#00F0FF]"
                  data-testid={`cfg-${f.key}`}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bot.open_position_double}
                onChange={(e) => setBot({ ...bot, open_position_double: e.target.checked })}
                className="accent-[#00F0FF] w-4 h-4"
                data-testid="cfg-double"
              />
              Open Position Double
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {["Cycle", "One-Shot"].map((m) => (
              <button
                key={m}
                onClick={() => setBot({ ...bot, trade_method: m })}
                data-testid={`method-${m}`}
                className={`py-2 rounded-lg font-display font-bold text-sm uppercase tracking-widest ${
                  bot.trade_method === m
                    ? "bg-[#00F0FF] text-[#050914]"
                    : "bg-white/5 text-[#8B9BB4] border border-white/25"
                }`}
              >
                <Repeat size={12} className="inline mr-1" />
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={saveConfig}
            className="w-full mt-4 bg-white/10 hover:bg-white/15 border border-white/25 py-3 rounded-xl font-display font-bold text-sm"
            data-testid="save-config"
          >
            Update Strategy
          </button>
        </div>
      </div>

      {/* Margin Configuration Table (per-round drop % and multiplier) */}
      <div className="px-4 mt-4">
        <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-5" data-testid="margin-config">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display font-bold text-sm">Margin Configuration</div>
              <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold mt-0.5">
                Per-round drop % & multiplier
              </div>
            </div>
            <button
              onClick={addMarginRow}
              disabled={(bot.margin_config || []).length >= 10}
              className="text-[10px] uppercase tracking-widest text-[#00F0FF] font-bold border border-[#00F0FF]/40 rounded-full px-3 py-1 hover:bg-[#00F0FF]/10 disabled:opacity-40"
              data-testid="add-margin-row"
            >
              + Add Row
            </button>
          </div>

          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold mb-1 px-1">
            <div className="w-10">Round</div>
            <div>Margin Drop %</div>
            <div>Buy-in Ratio</div>
            <div className="w-6" />
          </div>

          <div className="space-y-1.5">
            {(bot.margin_config || []).map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center"
                data-testid={`mc-row-${i}`}
              >
                <div className="w-10 h-9 rounded-lg bg-white/5 border border-white/25 flex items-center justify-center font-display font-bold text-xs">
                  {i + 1}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={row.drop}
                    onChange={(e) => updateMarginRow(i, "drop", e.target.value)}
                    className="w-full h-9 bg-[#050914] border border-white/25 rounded-lg px-2.5 pr-6 font-display font-medium tabular-nums text-sm focus:outline-none focus:border-[#00F0FF]"
                    data-testid={`mc-drop-${i}`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8B9BB4] font-bold">%</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={row.multiplier}
                    onChange={(e) => updateMarginRow(i, "multiplier", e.target.value)}
                    className="w-full h-9 bg-[#050914] border border-white/25 rounded-lg px-2.5 pr-6 font-display font-medium tabular-nums text-sm focus:outline-none focus:border-[#00F0FF]"
                    data-testid={`mc-mult-${i}`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8B9BB4] font-bold">×</span>
                </div>
                <button
                  onClick={() => removeMarginRow(i)}
                  disabled={(bot.margin_config || []).length <= 1}
                  className="w-9 h-9 rounded-lg bg-[#FF007A]/10 border border-[#FF007A]/30 text-[#FF007A] font-bold hover:bg-[#FF007A]/20 disabled:opacity-30 disabled:cursor-not-allowed"
                  data-testid={`mc-remove-${i}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-[#8B9BB4] mt-3 leading-relaxed">
            <span className="text-white font-bold">Round N</span> fires when price drops by that N-th <span className="text-[#FFD700]">Margin Drop %</span> from the previous buy, and spends <span className="text-[#00F0FF]">First Buy × Ratio</span> USDT.
          </div>
        </div>
      </div>

      {/* Big Start/Stop */}
      <div className="px-4 mt-5">
        {bot.status === "running" ? (
          <button
            onClick={stopBot}
            className="w-full flex items-center justify-center gap-2 bg-[#FF007A] text-white font-display font-black text-base rounded-2xl py-4 hover:brightness-110 transition-all glow-magenta"
            data-testid="stop-bot"
          >
            <Square size={20} fill="white" /> STOP BOT
          </button>
        ) : (
          <button
            onClick={startBot}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00F0FF] to-[#0088FF] text-[#050914] font-display font-black text-base rounded-2xl py-4 hover:brightness-110 transition-all glow-cyan tracking-wide"
            data-testid="start-bot"
          >
            <Play size={20} fill="#050914" /> START BOT
          </button>
        )}
        {bot.status === "running" && (
          <div className="mt-2 text-center text-[10px] uppercase tracking-widest text-[#39FF14] font-bold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-tgx-pulse align-middle mr-1.5" />
            Auto-Trading Active · Engine ticks every 10s
          </div>
        )}
        {bot.stop_reason && bot.status !== "running" && (
          <div className="mt-2 text-center text-[10px] text-[#FF007A]" data-testid="stop-reason">
            ⚠️ {bot.stop_reason}
          </div>
        )}
      </div>

      {/* Auto-trade timeline */}
      {events.length > 0 && (
        <div className="px-4 mt-5" data-testid="bot-events">
          <div className="font-display font-bold text-sm mb-2 flex items-center gap-2">
            <span>Bot Activity</span>
            <span className="text-[10px] uppercase tracking-widest text-[#8B9BB4]">Rounds</span>
          </div>
          <div className="space-y-2">
            {events.slice(0, 8).map((e) => (
              <div
                key={e.id}
                className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-[10px] ${
                      e.kind === "take_profit"
                        ? "bg-[#39FF14]/15 text-[#39FF14]"
                        : e.kind === "margin_call"
                        ? "bg-[#FFD700]/15 text-[#FFD700]"
                        : "bg-[#00F0FF]/15 text-[#00F0FF]"
                    }`}
                  >
                    R{e.round}
                  </div>
                  <div>
                    <div className="text-xs font-bold capitalize">
                      {e.kind === "take_profit"
                        ? "Take Profit"
                        : e.kind === "margin_call"
                        ? "Margin Call"
                        : "First Buy"}
                    </div>
                    <div className="text-[10px] text-[#8B9BB4] mt-0.5">
                      {new Date(e.created_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {e.amount != null && (
                    <div className="font-display font-bold text-sm tabular-nums">
                      {fmtUSD(e.amount)}
                    </div>
                  )}
                  <div className="text-[10px] tabular-nums text-[#8B9BB4]">
                    @ {fmtNum(e.price, 4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Position Edit modal */}
      {posEditOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4"
          onClick={() => setPosEditOpen(false)}
          data-testid="pos-edit-modal"
        >
          <div
            className="w-full max-w-md bg-[#0F1524] border border-[#00F0FF]/30 rounded-t-3xl sm:rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-[#00F0FF]/15 flex items-center justify-center">
                <Pencil size={20} className="text-[#00F0FF]" />
              </div>
              <div>
                <div className="font-display font-black text-lg tracking-tight">Adjust Position</div>
                <div className="text-xs text-[#8B9BB4]">Manually sync {shortSymbol(sym)}/USDT</div>
              </div>
            </div>
            <div className="text-[11px] text-[#8B9BB4] mb-4 leading-relaxed">
              Use this if you executed trades outside the bot on Binance and want to sync the tracked quantity & average price. The bot will resume from this state.
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold">
                    Position Quantity ({shortSymbol(sym)})
                  </label>
                  {live && (bind?.mode === "real" || bind?.mode === "testnet") && (
                    <button
                      type="button"
                      onClick={importFromBinance}
                      data-testid="pos-import-btn"
                      className="text-[9px] uppercase tracking-widest font-bold text-[#00F0FF] border border-[#00F0FF]/40 rounded-full px-2 py-0.5 hover:bg-[#00F0FF]/10"
                    >
                      ↓ Import from Binance
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.000001"
                  value={posEdit.position_qty}
                  onChange={(e) => setPosEdit({ ...posEdit, position_qty: e.target.value })}
                  className="w-full bg-[#050914] border border-white/25 rounded-xl px-4 py-3 font-display font-bold tabular-nums text-lg focus:outline-none focus:border-[#00F0FF]"
                  data-testid="pos-qty-input"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold">
                  Average Price (USDT)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={posEdit.avg_price}
                  onChange={(e) => setPosEdit({ ...posEdit, avg_price: e.target.value })}
                  className="w-full mt-1.5 bg-[#050914] border border-white/25 rounded-xl px-4 py-3 font-display font-bold tabular-nums text-lg focus:outline-none focus:border-[#00F0FF]"
                  data-testid="pos-avg-input"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold">
                  Margin Call Count (0-based rounds already done)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={posEdit.margin_call_count}
                  onChange={(e) => setPosEdit({ ...posEdit, margin_call_count: e.target.value })}
                  className="w-full mt-1.5 bg-[#050914] border border-white/25 rounded-xl px-4 py-3 font-display font-bold tabular-nums text-lg focus:outline-none focus:border-[#00F0FF]"
                  data-testid="pos-mc-input"
                />
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-[11px] text-[#8B9BB4]">
                Notional value:{" "}
                <span className="font-display font-bold text-white tabular-nums">
                  {fmtUSD((parseFloat(posEdit.position_qty) || 0) * (parseFloat(posEdit.avg_price) || 0))}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                onClick={() => setPosEditOpen(false)}
                className="py-3 rounded-xl bg-white/5 border border-white/25 font-display font-bold text-sm"
                data-testid="pos-cancel"
              >
                Cancel
              </button>
              <button
                onClick={submitPosEdit}
                className="py-3 rounded-xl bg-[#00F0FF] text-[#050914] font-display font-bold text-sm hover:brightness-110"
                data-testid="pos-save"
              >
                Save Position
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
