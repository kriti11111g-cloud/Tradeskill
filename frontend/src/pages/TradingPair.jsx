import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronDown, ChevronRight, RefreshCw, MoreVertical, Layers, Info,
  Coins, Database, LineChart, Banknote, ShieldCheck, BarChart3, CircleDollarSign,
  Droplets, PhoneCall, Phone, Percent, Play, Square, Settings, Pencil, TrendingUp,
  TrendingDown, XCircle, Check,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtNum, shortSymbol } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import CoinIcon from "@/components/CoinIcon";
import useBinanceStream from "@/hooks/useBinanceStream";

const BLUE_GRAD = "linear-gradient(135deg,#3B82F6 0%,#2563EB 100%)";
const CARD = { background: "var(--lp-card-grad)", border: "1px solid var(--lp-border)", borderRadius: "14px" };

const STAT_DEFS = [
  { key: "position_amount", label: "Position amount (USDT)", Icon: Coins, grad: BLUE_GRAD, dec: 2 },
  { key: "position_qty", label: "Position quantity", Icon: Database, grad: BLUE_GRAD, dec: 6 },
  { key: "avg_price", label: "Avg price", Icon: LineChart, grad: BLUE_GRAD, dec: 6 },
  { key: "first_buy_amount", label: "First Buy in amount", Icon: Banknote, grad: BLUE_GRAD, dec: 2 },
  { key: "margin_call_limit", label: "Margin call limit", Icon: ShieldCheck, grad: BLUE_GRAD, dec: 0 },
  { key: "whole_take_profit_ratio", label: "Take Profit Ratio", Icon: BarChart3, grad: "linear-gradient(135deg,#22C55E,#16A34A)", dec: 2 },
  { key: "whole_take_profit_callback", label: "Earnings Callback", Icon: CircleDollarSign, grad: BLUE_GRAD, dec: 2 },
  { key: "margin_call_drop", label: "Margin call drop", Icon: Droplets, grad: BLUE_GRAD, dec: 2 },
  { key: "buy_in_callback", label: "Buy in callback", Icon: PhoneCall, grad: BLUE_GRAD, dec: 2 },
  { key: "margin_call_count", label: "Numbers of call margin", Icon: Phone, grad: BLUE_GRAD, dec: 0 },
];

function StatCard({ Icon, grad, label, value, valueColor }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 min-h-[58px]" style={CARD} data-testid={`lp-stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: grad }}>
        <Icon size={15} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[8.5px] font-semibold leading-tight break-words" style={{ color: "var(--text-mute)" }}>{label}</div>
        <div className="font-display font-black text-[12.5px] tabular-nums mt-0.5 leading-tight break-all" style={{ color: valueColor || "var(--ink)" }}>{value}</div>
      </div>
    </div>
  );
}

export default function TradingPair() {
  const { symbol } = useParams();
  const nav = useNavigate();
  const sym = (symbol || "BTCUSDT").toUpperCase();
  const base = shortSymbol(sym);
  const { refresh } = useAuth();

  const [bot, setBot] = useState(null);
  const [stats, setStats] = useState(null);
  const [live, setLive] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [posEditOpen, setPosEditOpen] = useState(false);
  const [posEdit, setPosEdit] = useState({ position_qty: "", avg_price: "", margin_call_count: "" });
  const [spinning, setSpinning] = useState(false);
  const menuRef = useRef(null);

  const stream = useBinanceStream(sym);
  const price = stream.price > 0 ? stream.price : (stats ? parseFloat(stats.lastPrice) : 0);
  const change24 = stream.price > 0 ? stream.change : (stats ? parseFloat(stats.priceChangePercent) : 0);

  const loadAll = async () => {
    const [b, s] = await Promise.all([
      api.get(`/bots/${sym}`).then((r) => r.data),
      api.get(`/market/stats/${sym}`).then((r) => r.data).catch(() => null),
    ]);
    setBot(b);
    setStats(s);
    api.get("/binance/account").then((r) => setLive(r.data)).catch(() => setLive(null));
  };

  useEffect(() => {
    loadAll();
    const id = setInterval(() => {
      api.get(`/bots/${sym}`).then((r) => setBot(r.data)).catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [sym]);

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!bot) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[color:var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const returnRate = bot.avg_price > 0 && price > 0 ? ((price - bot.avg_price) / bot.avg_price) * 100 : 0;
  const running = bot.status === "running";
  const up = change24 >= 0;
  const mcCount = parseInt(bot.margin_call_count || 0, 10);
  const mcLimit = parseInt(bot.margin_call_limit || 0, 10);
  const ladder = bot.dca_ladder || [];
  const anchor = bot.avg_price > 0 ? bot.avg_price : price;
  const nextDrop = (bot.margin_config || [])[Math.min(mcCount, (bot.margin_config || []).length - 1)]?.drop ?? 0;

  const doRefresh = async () => {
    setSpinning(true);
    await loadAll();
    setSpinning(false);
    toast.success("Refreshed");
  };

  const startBot = () => api.post(`/bots/${sym}/start`).then(() => { toast.success("Bot started"); loadAll(); }).catch((e) => toast.error(formatApiError(e)));
  const stopBot = () => api.post(`/bots/${sym}/stop`).then(() => { toast.success("Bot stopped"); loadAll(); }).catch((e) => toast.error(formatApiError(e)));

  const placeOrder = async (side) => {
    try {
      const body = { symbol: sym, side };
      if (side === "BUY") body.usdt_amount = parseFloat(bot.first_buy_amount) || 10;
      else {
        if (bot.position_qty <= 0) return toast.error("No position to sell");
        body.quantity = bot.position_qty;
      }
      const { data } = await api.post("/trade/order", body);
      toast.success(side === "BUY" ? `Bought ${fmtNum(data.quantity)} ${base}` : `Sold · P&L ${fmtUSD(data.profit)}`);
      loadAll(); refresh();
    } catch (e) { toast.error(formatApiError(e)); }
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
    if (!live) return toast.error("Live balances not loaded");
    const bal = live.balances.find((b) => b.asset === base);
    if (!bal || bal.free <= 0) return toast.error(`No ${base} balance found on Binance`);
    setPosEdit((p) => ({
      ...p,
      position_qty: String(bal.free),
      avg_price: p.avg_price && parseFloat(p.avg_price) > 0 ? p.avg_price : String(price || 0),
    }));
    toast.success(`Imported ${bal.free} ${base} from Binance`);
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
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const statValue = (key, dec) => {
    if (key === "margin_call_drop") return `${fmtNum(nextDrop, 2)}`;
    const v = parseFloat(bot[key] || 0);
    return fmtNum(v, v > 0 && dec > 2 ? (v > 100 ? 2 : dec) : dec);
  };

  const menuItems = [
    running
      ? { label: "Stop Bot", Icon: Square, danger: true, onClick: stopBot, testid: "menu-stop" }
      : { label: "Start Bot", Icon: Play, onClick: startBot, testid: "menu-start" },
    { label: "Edit Strategy", Icon: Settings, onClick: () => nav(`/trade-settings/${sym}`), testid: "menu-edit-strategy" },
    { label: "Edit Position", Icon: Pencil, onClick: openPosEdit, testid: "menu-edit-position" },
    { label: "Manual Buy", Icon: TrendingUp, onClick: () => placeOrder("BUY"), testid: "menu-buy" },
    { label: "Sell All", Icon: TrendingDown, onClick: () => placeOrder("SELL"), testid: "menu-sell" },
    { label: "Close Position", Icon: XCircle, danger: true, onClick: () => placeOrder("SELL"), testid: "menu-close" },
  ];

  return (
    <div className="min-h-screen pb-8" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-3 py-3" style={{ background: "var(--bg-base)" }}>
        <button onClick={() => nav(-1)} className="w-9 h-9 flex items-center justify-center" data-testid="lp-back" style={{ touchAction: "manipulation" }}>
          <ChevronLeft size={26} strokeWidth={2.6} style={{ color: "var(--ink)" }} />
        </button>
        <div className="font-display font-black text-[20px]" style={{ color: "var(--ink)" }}>Live Position</div>
        <div className="flex items-center gap-1">
          <button onClick={doRefresh} className="w-9 h-9 flex items-center justify-center" data-testid="lp-refresh" style={{ touchAction: "manipulation" }}>
            <RefreshCw size={20} strokeWidth={2.4} className={spinning ? "animate-spin" : ""} style={{ color: "var(--ink)" }} />
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((o) => !o)} className="w-9 h-9 flex items-center justify-center" data-testid="lp-menu" style={{ touchAction: "manipulation" }}>
              <MoreVertical size={22} strokeWidth={2.4} style={{ color: "var(--ink)" }} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 w-48 py-1.5 z-30 rounded-xl shadow-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} data-testid="lp-menu-dropdown">
                {menuItems.map((m) => (
                  <button key={m.label} onClick={() => { setMenuOpen(false); m.onClick(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-black text-left"
                    style={{ color: m.danger ? "var(--bad)" : "var(--ink)", touchAction: "manipulation" }} data-testid={m.testid}>
                    <m.Icon size={16} strokeWidth={2.2} /> {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 space-y-2">
        {/* Coin card */}
        <div onClick={() => nav(`/trade-settings/${sym}`)} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
          style={{ ...CARD, border: "1.5px solid var(--lp-border)", touchAction: "manipulation" }} data-testid="lp-coin-card">
          <CoinIcon symbol={base} size={38} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 font-display font-black text-[16px]" style={{ color: "var(--ink)" }}>
              {base}/USDT <ChevronDown size={15} />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--text-mute)" }}>
              {base}
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase" style={{ color: running ? "#16A34A" : "var(--text-mute)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: running ? "#16A34A" : "var(--text-mute)" }} />
                {running ? "Running" : "Stopped"}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0 pl-1">
            <div className="font-display font-black text-[17px] tabular-nums" style={{ color: "#16A34A" }}>${fmtNum(price, price > 100 ? 2 : 4)}</div>
            <div className="text-[11px] font-black tabular-nums" style={{ color: up ? "#16A34A" : "var(--bad)" }}>{up ? "▲" : "▼"} {up ? "+" : ""}{fmtNum(change24, 2)}% (24h)</div>
          </div>
          <ChevronRight size={20} style={{ color: "var(--ink)" }} />
        </div>

        {/* Stat cards grid */}
        <div className="grid grid-cols-3 gap-2">
          {STAT_DEFS.map((s) => (
            <StatCard key={s.key} Icon={s.Icon} grad={s.grad} label={s.label === "Position quantity" ? `Position quantity (${base})` : s.label} value={statValue(s.key, s.dec)} />
          ))}
          <StatCard Icon={Percent} grad="linear-gradient(135deg,#22C55E,#16A34A)" label="Return rate"
            value={`${returnRate >= 0 ? "" : ""}${fmtNum(returnRate, 2)}%`}
            valueColor={returnRate > 0 ? "#16A34A" : returnRate < 0 ? "var(--bad)" : "var(--ink)"} />
        </div>

        {/* Auto-Trigger Ladder */}
        <div className="px-3 py-3" style={CARD} data-testid="lp-ladder">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Layers size={18} strokeWidth={2.4} style={{ color: "var(--ink)" }} />
              <div className="font-display font-black text-[16px]" style={{ color: "var(--ink)" }}>Auto-Trigger Ladder</div>
            </div>
            <div className="text-[12px] font-black tabular-nums" style={{ color: "var(--lp-blue)" }} data-testid="lp-ladder-count">
              {mcLimit} Call · {Math.max(0, mcLimit - mcCount)} Left
            </div>
          </div>

          {/* Current price */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2 mb-2" style={{ background: "var(--lp-current-grad)", borderLeft: "3px solid var(--lp-blue)" }} data-testid="lp-current-price">
            <div className="flex items-center gap-2">
              <LineChart size={17} style={{ color: "var(--lp-blue)" }} />
              <div>
                <div className="text-[13px] font-black" style={{ color: "var(--lp-blue)" }}>Current Price</div>
                <div className="text-[9.5px] font-semibold" style={{ color: "var(--text-mute)" }}>Live · Binance</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-black text-[18px] tabular-nums" style={{ color: "#16A34A" }}>{price > 0 ? fmtNum(price, price > 100 ? 2 : 4) : "—"}</div>
              <div className="text-[9px] font-black" style={{ color: "var(--text-mute)" }}>USDT</div>
            </div>
          </div>

          {/* Call cards */}
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: mcCount }, (_, i) => (
              <div key={`used-${i}`} className="flex items-center gap-2 rounded-xl px-2 py-2 opacity-55" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }} data-testid={`lp-call-used-${i + 1}`}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-display font-black text-[13px] shrink-0" style={{ background: "linear-gradient(135deg,#94A3B8,#64748B)" }}>C{i + 1}</div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black leading-tight flex items-center gap-1" style={{ color: "var(--ink)" }}>Executed <Check size={11} strokeWidth={3} style={{ color: "#16A34A" }} /></div>
                  <div className="text-[9px] font-semibold" style={{ color: "var(--text-mute)" }}>Safety order filled</div>
                </div>
              </div>
            ))}
            {ladder.map((lvl) => {
              const dist = price > 0 && lvl.trigger_price > 0 ? ((price - lvl.trigger_price) / lvl.trigger_price) * 100 : 0;
              const dropFromAnchor = anchor > 0 ? (1 - lvl.trigger_price / anchor) * 100 : lvl.drop_pct;
              return (
                <div key={lvl.level} className="rounded-xl px-2 py-2" style={{ background: "var(--surface)", border: "1px solid var(--lp-border)" }} data-testid={`lp-call-${lvl.level}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-display font-black text-[11px] shrink-0" style={{ background: BLUE_GRAD }}>C{lvl.level}</div>
                    <div className="text-[9px] font-black leading-tight" style={{ color: "var(--ink)" }}>Buy – Safety Order</div>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="font-display font-black text-[11px] tabular-nums whitespace-nowrap" style={{ color: "var(--ink)" }}>≤ {fmtNum(lvl.trigger_price, lvl.trigger_price > 100 ? 2 : 4)}</div>
                    <div className="text-[9px] font-black tabular-nums whitespace-nowrap" style={{ color: dist >= 0 ? "#16A34A" : "var(--bad)" }}>{dist >= 0 ? "+" : ""}{fmtNum(dist, 2)}% <span className="text-[7.5px] font-semibold" style={{ color: "var(--text-mute)" }}>above</span></div>
                  </div>
                  <div className="text-[8.5px] font-semibold tabular-nums mt-0.5 whitespace-nowrap" style={{ color: "var(--text-mute)" }}>-{fmtNum(dropFromAnchor, 1)}% · ${fmtNum(lvl.amount_usdt, 0)} · Total ${fmtNum(lvl.cumulative_usdt, 2)}</div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-3 pt-2.5" style={{ borderTop: "1px solid var(--border-soft)" }}>
            <Info size={13} style={{ color: "var(--lp-blue)" }} />
            <span className="text-[10px] font-bold" style={{ color: "var(--lp-blue)" }}>Bot will auto-execute at each trigger · No manual action needed</span>
          </div>
        </div>
      </div>

      {/* Edit Position modal */}
      {posEditOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 pb-28" onClick={() => setPosEditOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()} data-testid="lp-posedit-modal">
            <div className="font-display font-black text-[17px] mb-3" style={{ color: "var(--ink)" }}>Edit Position</div>
            {[
              { k: "position_qty", label: `Position Quantity (${base})` },
              { k: "avg_price", label: "Average Price (USDT)" },
              { k: "margin_call_count", label: "Margin Calls Used" },
            ].map((f) => (
              <div key={f.k} className="mb-2.5">
                <div className="text-[10px] font-bold mb-1" style={{ color: "var(--text-mute)" }}>{f.label}</div>
                <input value={posEdit[f.k]} inputMode="decimal" onChange={(e) => setPosEdit({ ...posEdit, [f.k]: e.target.value })}
                  className="w-full rounded-xl px-3 py-2.5 text-[14px] font-black outline-none tabular-nums"
                  style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--ink)" }}
                  data-testid={`lp-posedit-${f.k}`} />
              </div>
            ))}
            {live && (
              <button onClick={importFromBinance} className="w-full rounded-xl py-2.5 text-[12px] font-black mb-2" style={{ background: "var(--surface-3)", border: "1px solid var(--lp-border)", color: "var(--lp-blue)", touchAction: "manipulation" }} data-testid="lp-posedit-import">
                Import balance from Binance
              </button>
            )}
            <button onClick={submitPosEdit} className="w-full rounded-xl py-3 text-white font-display font-black text-[15px]" style={{ background: BLUE_GRAD, touchAction: "manipulation" }} data-testid="lp-posedit-save">
              Save Position
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
