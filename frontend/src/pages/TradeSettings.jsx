import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, ChevronDown, HelpCircle, Database, Copy, ArrowUpDown,
  Target, RotateCcw, ArrowUpCircle, Settings, PieChart, BarChart3, Repeat,
  Save, Minus, Plus, Play, Square, Clock,
} from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import api, { formatApiError } from "@/lib/api";
import useBinanceStream from "@/hooks/useBinanceStream";
import { fmtNum } from "@/lib/format";
import { getUpcoming, timeLeft, fetchUpcoming } from "@/lib/upcomingCoins";

const GRAD = "linear-gradient(90deg, #22C55E 0%, #2563EB 100%)";
const ROW = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" };
const INP = { background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "12px" };

const ord = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function Row({ Icon, title, sub, right, onClick, testid }) {
  const long = title.length > 26;
  return (
    <div onClick={onClick} className={`flex items-center gap-2.5 px-3 py-2 min-h-[52px] ${onClick ? "cursor-pointer" : ""}`}
      style={{ ...ROW, touchAction: "manipulation" }} data-testid={testid}>
      <Icon size={19} strokeWidth={2.2} className="shrink-0" style={{ color: "#0D9488" }} />
      <div className="flex-1 min-w-0">
        <div className={long ? "text-[11.5px] font-black leading-tight tracking-tight" : "text-[12.5px] font-black leading-tight"} style={{ color: "var(--ink)" }}>{title}</div>
        {!long && <div className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--text-mute)" }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}


function NumInput({ value, onChange, unit, testid }) {
  return (
    <div className="flex items-center shrink-0 w-[96px] h-10 overflow-hidden" style={INP}>
      <input value={value} inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-black text-center h-full"
        style={{ color: "var(--ink)" }} data-testid={testid} />
      <span className="w-[34px] text-center text-[10px] font-black" style={{ color: "var(--text-mute)", borderLeft: "1px solid var(--border)" }}>{unit}</span>
    </div>
  );
}

function Stepper({ value, onChange, testid }) {
  const n = parseInt(value, 10) || 1;
  return (
    <div className="flex items-center shrink-0 w-[96px] h-10 overflow-hidden" style={INP}>
      <button onClick={() => onChange(n - 1)} className="w-8 h-full flex items-center justify-center" style={{ borderRight: "1px solid var(--border)", touchAction: "manipulation" }} data-testid={`${testid}-minus`}>
        <Minus size={15} style={{ color: "var(--ink)" }} />
      </button>
      <span className="flex-1 text-center text-[14px] font-black tabular-nums" style={{ color: "var(--ink)" }} data-testid={`${testid}-value`}>{value}</span>
      <button onClick={() => onChange(n + 1)} className="w-8 h-full flex items-center justify-center" style={{ borderLeft: "1px solid var(--border)", touchAction: "manipulation" }} data-testid={`${testid}-plus`}>
        <Plus size={15} style={{ color: "var(--ink)" }} />
      </button>
    </div>
  );
}

export default function TradeSettings() {
  const { symbol } = useParams();
  const nav = useNavigate();
  const sym = symbol.toUpperCase();
  const base = sym.replace(/USDT$/, "");
  const [upcoming, setUpcoming] = useState(() => getUpcoming(sym));
  const [tl, setTl] = useState(() => (upcoming ? timeLeft(upcoming.launchAt) : null));
  useEffect(() => {
    // resolve against the live Binance listing feed too (not just demo list)
    fetchUpcoming().then(() => setUpcoming(getUpcoming(sym)));
  }, [sym]);
  useEffect(() => {
    if (!upcoming) return;
    setTl(timeLeft(upcoming.launchAt));
    const id = setInterval(() => setTl(timeLeft(upcoming.launchAt)), 1000);
    return () => clearInterval(id);
  }, [upcoming]);
  const stream = useBinanceStream(sym);
  const [view, setView] = useState("main"); // main | margin | dist
  const [stats, setStats] = useState(null);
  const [bot, setBot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    api.get(`/bots/${sym}`).then(({ data }) => {
      const limit = Math.max(1, parseInt(data.margin_call_limit || 5, 10));
      setBot({
        ...data,
        margin_config: syncRows(data.margin_config || [], limit),
        sub_position_tps: syncTps(data.sub_position_tps || [], limit, data.whole_take_profit_ratio || 1.5),
      });
    }).catch(() => {});
    api.get(`/market/stats/${sym}`).then(({ data }) => setStats(data)).catch(() => {});
  }, [sym]);

  const syncRows = (rows, limit) => {
    const out = rows.slice(0, limit).map((r) => ({ drop: r.drop, multiplier: r.multiplier }));
    while (out.length < limit) {
      const last = out[out.length - 1] || { drop: 2, multiplier: 2 };
      out.push({ ...last });
    }
    return out;
  };
  const syncTps = (tps, limit, def) => {
    const out = tps.slice(0, limit).map(Number);
    while (out.length < limit) out.push(Number(def) || 1.5);
    return out;
  };

  // MASTER: margin call limit change -> dono sections auto-sync
  const setLimit = (n) => {
    const limit = Math.max(1, Math.min(50, n));
    setBot((b) => ({
      ...b,
      margin_call_limit: limit,
      margin_config: syncRows(b.margin_config, limit),
      sub_position_tps: syncTps(b.sub_position_tps, limit, b.whole_take_profit_ratio || 1.5),
    }));
  };

  const save = async (goBack) => {
    if (parseFloat(bot.first_buy_amount) < 10) {
      toast.error("Minimum First Buy Amount is $10");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...bot,
        first_buy_amount: parseFloat(bot.first_buy_amount) || 10,
        margin_call_limit: parseInt(bot.margin_call_limit, 10) || 1,
        whole_take_profit_ratio: parseFloat(bot.whole_take_profit_ratio) || 1.5,
        whole_take_profit_callback: parseFloat(bot.whole_take_profit_callback) || 0.3,
        buy_in_callback: parseFloat(bot.buy_in_callback) || 1,
        sub_take_profit_callback: parseFloat(bot.sub_take_profit_callback) || 0.5,
        margin_config: bot.margin_config.map((r) => ({ drop: parseFloat(r.drop) || 0, multiplier: parseFloat(r.multiplier) || 1 })),
        sub_position_tps: bot.sub_position_tps.map((v) => parseFloat(v) || 0),
      };
      const { data } = await api.post(`/bots/${sym}`, payload);
      setBot((b) => ({ ...b, ...data,
        margin_config: syncRows(data.margin_config || [], data.margin_call_limit),
        sub_position_tps: syncTps(data.sub_position_tps || [], data.margin_call_limit, data.whole_take_profit_ratio) }));
      toast.success("Trade settings updated");
      if (goBack) setView("main");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSaving(false); }
  };


  if (!bot) return <div className="min-h-screen" style={{ background: "var(--bg-base)" }} />;

  const live = stream?.price || parseFloat(stats?.lastPrice || stats?.price || 0);
  const chg = stream?.change_pct ?? parseFloat(stats?.priceChangePercent ?? stats?.change_pct ?? 0);
  const up = chg >= 0;

  const Header = ({ title }) => (
    <div className="sticky top-0 z-20 flex items-center justify-between px-3 py-3" style={{ background: "var(--bg-base)" }}>
      <button onClick={() => (view === "main" ? nav(-1) : setView("main"))} className="w-9 h-9 flex items-center justify-center" data-testid="ts-back" style={{ touchAction: "manipulation" }}>
        <ChevronLeft size={26} strokeWidth={2.6} style={{ color: "var(--ink)" }} />
      </button>
      <div className="font-display font-black text-[19px]" style={{ color: "var(--ink)" }}>{title}</div>
      <HelpCircle size={22} style={{ color: "var(--ink)" }} />
    </div>
  );

  const toggleBot = async () => {
    const running = bot.status === "running";
    setToggling(true);
    try {
      const { data } = await api.post(`/bots/${sym}/${running ? "stop" : "start"}`);
      setBot((b) => ({ ...b, status: data.status }));
      toast.success(running ? "Bot stopped" : "Bot started");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setToggling(false); }
  };

  const UpdateBtn = ({ goBack }) => {
    const running = bot.status === "running";
    return (
      <>
        <button onClick={() => save(goBack)} disabled={saving}
          className="w-full text-white font-display font-black text-lg rounded-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-60 select-none mt-4"
          style={{ background: GRAD, touchAction: "manipulation" }} data-testid="ts-update">
          <Save size={20} /> {saving ? "Saving..." : upcoming ? "Save Settings" : "Update"}
        </button>
        {!upcoming && (
        <button onClick={toggleBot} disabled={toggling}
          className="w-full text-white font-display font-black text-lg rounded-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-60 select-none mt-3"
          style={{ background: running ? "linear-gradient(90deg, #EF4444 0%, #DC2626 100%)" : GRAD, touchAction: "manipulation" }}
          data-testid={running ? "ts-stop" : "ts-start"}>
          {running ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          {toggling ? "Please wait..." : running ? "Stop" : "Start"}
        </button>
        )}
      </>
    );
  };

  /* ============ MARGIN CONFIGURATION VIEW ============ */
  if (view === "margin") {
    return (
      <div className="min-h-screen pb-8" style={{ background: "var(--bg-base)" }}>
        <Header title="Margin Configuration" />
        <div className="px-4 space-y-1.5">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--card-soft-grad)", border: "1px solid var(--border)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: GRAD }}><Settings size={20} /></div>
            <div className="text-[11.5px] font-semibold leading-snug" style={{ color: "var(--text)" }}>
              Set the margin call drop percentage and multiple buy ratio for each call. The bot will follow this configuration automatically.
            </div>
          </div>
          <div className="flex gap-2 pl-[74px]">
            <div className="flex-1 text-center text-white text-[11px] font-black rounded-xl py-1.5 leading-tight" style={{ background: "linear-gradient(90deg,#16A34A,#2563EB)" }}>Margin call drop<br /><span className="font-semibold opacity-85">Price drop %</span></div>
            <div className="flex-1 text-center text-white text-[11px] font-black rounded-xl py-1.5 leading-tight" style={{ background: "linear-gradient(90deg,#2563EB,#3B82F6)" }}>Multiple Buy in ratio<br /><span className="font-semibold opacity-85">Times to buy</span></div>
          </div>
          {bot.margin_config.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-2.5" style={ROW} data-testid={`mc-row-${i + 1}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-black shrink-0" style={{ background: GRAD }}>{i + 1}</div>
              <div className="w-[46px] text-[11.5px] font-black shrink-0" style={{ color: "var(--ink)" }}>{ord(i + 1)} call</div>
              <NumInput value={r.drop} unit="%" testid={`mc-drop-${i + 1}`}
                onChange={(v) => setBot((b) => { const mc = [...b.margin_config]; mc[i] = { ...mc[i], drop: v }; return { ...b, margin_config: mc }; })} />
              <NumInput value={r.multiplier} unit="Times" testid={`mc-ratio-${i + 1}`}
                onChange={(v) => setBot((b) => { const mc = [...b.margin_config]; mc[i] = { ...mc[i], multiplier: v }; return { ...b, margin_config: mc }; })} />
            </div>
          ))}
          <UpdateBtn goBack />
        </div>
      </div>
    );
  }

  /* ============ DISTRIBUTION & TAKE PROFIT VIEW ============ */
  if (view === "dist") {
    return (
      <div className="min-h-screen pb-8" style={{ background: "var(--bg-base)" }}>
        <Header title="Distribution And Take Profit" />
        <div className="px-4 space-y-1.5">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--card-soft-grad)", border: "1px solid var(--border)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: GRAD }}><PieChart size={20} /></div>
            <div className="text-[11.5px] font-semibold leading-snug" style={{ color: "var(--text)" }}>
              <span className="font-black" style={{ color: "var(--ink)" }}>Sub-position mode starts from Call 5.</span><br />
              Calls 1–4 follow normal margin config. From Call 5, each buy is a separate sub-position — its take profit is auto-set at the previous call's average price, and principal + profit exit together on target.
            </div>
          </div>
          {bot.sub_position_tps.map((v, i) => (
            i < 4 ? null : (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5" style={ROW} data-testid={`tp-row-${i + 1}`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-black shrink-0" style={{ background: GRAD }}>C{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-black" style={{ color: "var(--ink)" }}>
                  Sub-position {i + 1} <BarChart3 size={15} style={{ color: "#16A34A" }} />
                </div>
                <div className="text-[9.5px] font-semibold" style={{ color: "var(--text-mute)" }}>TP auto: previous call avg price</div>
              </div>
              <NumInput value={v} unit="%" testid={`tp-input-${i + 1}`}
                onChange={(val) => setBot((b) => { const t = [...b.sub_position_tps]; t[i] = val; return { ...b, sub_position_tps: t }; })} />
            </div>
            )
          ))}
          <UpdateBtn goBack />
        </div>
      </div>
    );
  }

  /* ============ MAIN TRADE SETTINGS VIEW ============ */
  return (
    <div className="min-h-screen pb-8" style={{ background: "var(--bg-base)" }}>
      <Header title="Trade Settings" />
      <div className="px-4 space-y-1.5">
        {/* Coin card — sticky below header */}
        <div className="sticky z-10 -mx-4 px-4 pb-1.5" style={{ top: "58px", background: "var(--bg-base)" }}>
        <div onClick={() => nav(`/pair/${sym}`)} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
          style={{ background: "var(--card-soft-grad)", border: "1.5px solid var(--card-soft-border)", borderRadius: "12px", touchAction: "manipulation" }}
          data-testid="ts-coin-card">
          <CoinIcon symbol={base} size={32} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 font-display font-black text-[15px]" style={{ color: "var(--ink)" }}>
              {base}/USDT <ChevronDown size={14} />
            </div>
            <div className="text-[10px] font-semibold" style={{ color: "var(--text-mute)" }}>{stats?.name || base}</div>
          </div>
          <div className="text-right">
            <div className="font-display font-black text-[15px] tabular-nums" style={{ color: "#16A34A" }}>${fmtNum(live, live > 100 ? 2 : 4)}</div>
            <div className="text-[10px] font-black tabular-nums" style={{ color: up ? "#16A34A" : "#DC2626" }}>{up ? "▲" : "▼"} {up ? "+" : ""}{fmtNum(chg, 2)}% (24h)</div>
          </div>
          <ChevronRight size={18} style={{ color: "var(--ink)" }} />
        </div>
        </div>

        {upcoming && (
          <div className="rounded-2xl px-4 py-4 mb-1" style={{ background: "var(--card-soft-grad)", border: "1.5px solid var(--card-soft-border)" }} data-testid="ts-coming-soon-banner">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-black px-2 py-0.5 rounded-md text-white" style={{ background: "linear-gradient(90deg,#2563EB,#10B981)" }}>COMING SOON</span>
              <span className="text-[13px] font-black" style={{ color: "var(--ink)" }}>{upcoming.name}</span>
            </div>
            <div className="text-[11px] font-semibold mb-3" style={{ color: "var(--text-mute)" }}>{upcoming.tagline}</div>
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5">
                <Clock size={15} style={{ color: "#2563EB" }} />
                <span className="text-[11px] font-bold" style={{ color: "var(--text-mute)" }}>Launches in</span>
              </div>
              <span className="text-[16px] font-black tabular-nums" style={{ color: "#2563EB" }} data-testid="ts-countdown">
                {tl?.done ? "Launching now" : `${tl?.d ? tl.d + "d " : ""}${String(tl?.h || 0).padStart(2, "0")}:${String(tl?.m || 0).padStart(2, "0")}:${String(tl?.s || 0).padStart(2, "0")}`}
              </span>
            </div>
            <div className="text-[10.5px] font-semibold mt-2.5 leading-snug" style={{ color: "var(--text-mute)" }}>
              Set up your strategy now — it saves automatically and your bot will be ready to trade the moment {upcoming.asset} goes live.
            </div>
          </div>
        )}

        <Row Icon={Database} title="First buy in amount" sub="Initial order amount"
          right={<NumInput value={bot.first_buy_amount} unit="USDT" testid="ts-first-buy" onChange={(v) => setBot({ ...bot, first_buy_amount: v })} />} />

        <Row Icon={ArrowUpDown} title="Margin call limit" sub="Number of safety orders"
          right={<Stepper value={bot.margin_call_limit} onChange={setLimit} testid="ts-limit" />} />

        <Row Icon={Target} title="Whole position take profit ratio" sub="Take profit for total position"
          right={<NumInput value={bot.whole_take_profit_ratio} unit="%" testid="ts-tp-ratio" onChange={(v) => setBot({ ...bot, whole_take_profit_ratio: v })} />} />

        <Row Icon={RotateCcw} title="Whole position take profit callback" sub="Callback from total take profit"
          right={<NumInput value={bot.whole_take_profit_callback} unit="%" testid="ts-tp-callback" onChange={(v) => setBot({ ...bot, whole_take_profit_callback: v })} />} />

        <Row Icon={ArrowUpCircle} title="Buy in callback" sub="Extra buy when price rebounds"
          right={<NumInput value={bot.buy_in_callback} unit="%" testid="ts-buy-callback" onChange={(v) => setBot({ ...bot, buy_in_callback: v })} />} />

        <Row Icon={BarChart3} title="Sub position take profit callback" sub="Callback from each sub position"
          right={<NumInput value={bot.sub_take_profit_callback} unit="%" testid="ts-sub-callback" onChange={(v) => setBot({ ...bot, sub_take_profit_callback: v })} />} />

        <Row Icon={Settings} title="Margin configuration" sub={`Leverage, max positions and mode · ${bot.margin_call_limit} calls`}
          onClick={() => setView("margin")} testid="ts-margin-config"
          right={<ChevronRight size={20} className="shrink-0" style={{ color: "var(--ink)" }} />} />

        <Row Icon={PieChart} title="Distribution and take profit allocation" sub="Set profit distribution for each call"
          onClick={() => setView("dist")} testid="ts-distribution"
          right={<ChevronRight size={20} className="shrink-0" style={{ color: "var(--ink)" }} />} />

        <Row Icon={Copy} title="Open position double" sub="Open next position with double amount"
          right={
            <button onClick={() => setBot({ ...bot, open_position_double: !bot.open_position_double })}
              className="w-14 h-8 rounded-full relative transition-colors shrink-0"
              style={{ background: bot.open_position_double ? "#16A34A" : "var(--toggle-off)", touchAction: "manipulation" }}
              data-testid="ts-double-toggle">
              <span className="absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all" style={{ left: bot.open_position_double ? "30px" : "4px" }} />
            </button>
          } />

        <Row Icon={Repeat} title="Trade method" sub="Select trading method"
          right={
            <div className="flex gap-1.5 shrink-0">
              {["Cycle", "One-Shot"].map((m) => (
                <button key={m} onClick={() => setBot({ ...bot, trade_method: m })}
                  className="px-4 py-2 rounded-xl text-[12.5px] font-black select-none"
                  style={bot.trade_method === m ? { background: GRAD, color: "#fff" } : { background: "var(--surface-3)", color: "var(--ink)", border: "1px solid var(--border)" }}
                  data-testid={`ts-method-${m.toLowerCase()}`}>
                  {m}
                </button>
              ))}
            </div>
          } />

        <UpdateBtn />
      </div>
    </div>
  );
}
