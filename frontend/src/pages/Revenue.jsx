import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, CalendarDays, ChevronDown, X } from "lucide-react";
import api from "@/lib/api";
import { fmtNum } from "@/lib/format";
import CoinIcon from "@/components/CoinIcon";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { IconPeople as IconGroup, IconProfit, IconBars, IconCoinStack, IconPersonAdd, IconCrown, IconHandDollar, IconGift } from "@/components/IncomeIcons";

const TABS = [
  { id: "all", label: "All" },
  { id: "trading_profit", label: "Trading Profit", Icon: IconProfit, title: "Trading Profit" },
  { id: "trading_commission", label: "Trading Commission", Icon: IconHandDollar, title: "Trading Commission" },
  { id: "royalty_income", label: "Royalty Income", Icon: IconCrown, title: "Royalty Income" },
  { id: "direct_income", label: "Direct Income", Icon: IconPersonAdd, title: "Direct Income" },
  { id: "bot_difference", label: "Bot Difference", Icon: IconCoinStack, title: "Bot Difference" },
  { id: "support_income", label: "Support Income", Icon: IconGroup, title: "Support Income" },
  { id: "bonanza", label: "Bonanza", Icon: IconGift, title: "Bonanza" },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `global_${i + 2}`,
    label: `Global-:V${i + 2}`,
    Icon: IconCrown,
    title: `Global-:V${i + 2} Royalty`,
  })),
];
const META = Object.fromEntries(TABS.filter((t) => t.id !== "all").map((t) => [t.id, t]));

const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-2.5 py-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 4px 14px rgba(0,0,0,0.1)" }}>
      <div className="text-[9px] font-bold" style={{ color: "var(--text-mute)" }}>{d.date.slice(5)}</div>
      <div className="text-[13px] font-black" style={{ color: "var(--good)" }}>+{fmtNum(d.total, 4)}</div>
    </div>
  );
}

/* Single income record card (same design, self-managed expand) */
function IncomeRow({ r, meta, showCoin }) {
  const [open, setOpen] = useState(false);
  const coin = showCoin && r.trade?.symbol ? r.trade.symbol.replace(/USDT$/, "") : null;
  return (
    <div
      onClick={() => setOpen(!open)}
      className="rounded-xl px-3 py-2 cursor-pointer select-none"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", touchAction: "manipulation" }}
      data-testid={`income-row-${r.category}`}
    >
      <div className="flex items-center gap-2.5">
        {coin ? (
          <>
            <div className="shrink-0"><CoinIcon symbol={coin} size={30} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-black truncate leading-tight" style={{ color: "var(--ink)" }}>{coin} / USDT</div>
              <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: "var(--text-mute)" }}>
                {new Date(r.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="shrink-0"><meta.Icon s={30} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-black truncate leading-tight" style={{ color: "var(--ink)" }}>{meta.title}</div>
              <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: "var(--text-mute)" }}>{fmtDate(r.created_at)}</div>
            </div>
          </>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--good)" }}>
            +{fmtNum(r.amount, 4)} USDT
            {open && r.category === "trading_profit" && r.trade?.deal_amount > r.amount && (
              <span className="ml-1 text-[11px] font-black" data-testid="income-profit-pct">
                (+{fmtNum((r.amount / (r.trade.deal_amount - r.amount)) * 100, 2)}%)
              </span>
            )}
          </span>
          <ChevronRight size={16} strokeWidth={2.4} style={{ color: "var(--ink)", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        </div>
      </div>
      {open && (
        r.category === "trading_profit" && r.trade ? (
          <div className="mt-1.5 pt-2 space-y-1.5" style={{ borderTop: "1px dashed var(--border)" }} data-testid="income-row-detail">
            <div className="flex items-center justify-between pb-1.5" style={{ borderBottom: "1px dashed var(--border)" }}>
              <div className="flex items-center gap-2">
                <CoinIcon symbol={r.trade.symbol.replace(/USDT$/, "")} size={26} />
                <span className="text-[13px] font-black" style={{ color: "var(--ink)" }}>
                  {r.trade.symbol.replace(/USDT$/, "")} / USDT
                </span>
                <span className="text-[9.5px] font-black text-white px-2 py-0.5 rounded-md" style={{ background: "#DC2626" }}>SELL</span>
              </div>
              <div className="flex items-center gap-1.5">
                {(() => {
                  const isKucoin = String(r.trade.exchange || "binance").toLowerCase() === "kucoin";
                  const logo = isKucoin
                    ? "https://coin-images.coingecko.com/markets/images/61/small/kucoin.png"
                    : "https://coin-images.coingecko.com/markets/images/52/small/binance.jpg";
                  const label = isKucoin ? "KUCOIN" : "BINANCE";
                  return (
                    <>
                      <img
                        src={logo}
                        alt={label}
                        className="w-[18px] h-[18px] rounded-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                      <span className="text-[10.5px] font-black tracking-wide" style={{ color: "var(--ink)" }} data-testid={`revenue-exchange-${r.trade.symbol}`}>{label}</span>
                    </>
                  );
                })()}
              </div>
            </div>
            {[
              ["Date", new Date(r.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })],
              ["Order Number", String(r.trade.order_id || "—")],
              ["Filled Quantity", r.trade.quantity != null ? `${fmtNum(r.trade.quantity, 4)} ${r.trade.symbol.replace(/USDT$/, "")}` : "—"],
              ["Deal Amount", r.trade.deal_amount != null ? `${fmtNum(r.trade.deal_amount, 2)} USDT` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-[11px]">
                <span className="font-semibold" style={{ color: "var(--text-mute)" }}>{k}</span>
                <span className="font-bold tabular-nums text-right" style={{ color: "var(--ink)" }}>{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold" style={{ color: "var(--text-mute)" }}>Role</span>
              <span className="font-black" style={{ color: "#2563EB" }}>Trade Skill Bot</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold" style={{ color: "var(--text-mute)" }}>Status</span>
              <span className="font-black" style={{ color: "var(--good)" }}>{r.trade.status || "Completed"}</span>
            </div>
          </div>
        ) : (
          <div className="mt-1.5 pt-1.5 text-[10.5px] leading-snug" style={{ borderTop: "1px dashed var(--border)", color: "var(--text-soft)" }} data-testid="income-row-detail">
            {r.note || meta.title} · {new Date(r.created_at).toLocaleString()}
          </div>
        )
      )}
    </div>
  );
}

/* Trading Profit — one summary card per date; tap opens that day's entries */
function ProfitDayGroup({ date, total, count, items }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl select-none"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", touchAction: "manipulation" }}
      data-testid="income-day-group-trading_profit"
    >
      <div onClick={() => setOpen(!open)} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer">
        <div className="shrink-0"><IconProfit s={30} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-black truncate leading-tight" style={{ color: "var(--ink)" }}>Trading Profit</div>
          <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: "var(--text-mute)" }}>
            {fmtDate(date)} · {count} {count > 1 ? "trades" : "trade"}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--good)" }} data-testid="income-day-group-total">+{fmtNum(total, 4)} USDT</span>
          <ChevronRight size={16} strokeWidth={2.4} style={{ color: "var(--ink)", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        </div>
      </div>
      {open && (
        <div className="px-2 pb-2 pt-1.5" style={{ borderTop: "1px dashed var(--border)" }} data-testid="income-day-group-detail">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-[11px] font-black tabular-nums" style={{ color: "var(--text-mute)" }}>{fmtDate(date)} · {count} {count > 1 ? "trades" : "trade"}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black select-none"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--ink)", touchAction: "manipulation" }}
              data-testid="income-day-group-close"
            >
              <X size={13} strokeWidth={2.6} /> Close
            </button>
          </div>
          <div className="space-y-1.5">
            {items.map((it) => <IncomeRow key={it.id} r={it} meta={META.trading_profit} showCoin />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Revenue() {
  const [data, setData] = useState(null);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState(initialTab && (initialTab === "all" || META[initialTab]) ? initialTab : "all");
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("tgx_revenue_cache") || "null");
      if (c) setData(c);
    } catch {}
    const load = () =>
      api.get("/revenue/income").then(({ data }) => {
        setData(data);
        try { localStorage.setItem("tgx_revenue_cache", JSON.stringify(data)); } catch {}
      }).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const today = data?.all?.today || 0;
  const total = data?.all?.total || 0;
  const catStats = tab === "all" ? null : data?.categories?.[tab] || { today: 0, total: 0 };

  const rows = useMemo(() => {
    const h = data?.history || [];
    if (tab === "all") return h;
    if (tab.startsWith("global_")) {
      const lvl = parseInt(tab.split("_")[1], 10);
      return h.filter((r) => (r.category === "trading_commission" || r.category === "royalty_income") && r.level === lvl);
    }
    return h.filter((r) => r.category === tab);
  }, [data, tab]);

  const lastVal = useMemo(() => {
    const t = data?.trend || [];
    for (let i = t.length - 1; i >= 0; i--) if (t[i].total > 0) return t[i].total;
    return 0;
  }, [data]);

  // Trading Profit entries ko date-wise group karo (UI-only). Ek date par 1+
  // entry -> summary group card; 1 entry -> normal card. Baaki categories as-is.
  const displayList = useMemo(() => {
    const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const groups = {};
    for (const r of rows) {
      if (r.category !== "trading_profit") continue;
      const k = dayKey(r.created_at);
      if (!groups[k]) groups[k] = { items: [], total: 0, date: r.created_at };
      groups[k].items.push(r);
      groups[k].total += (r.amount || 0);
    }
    const emitted = {};
    const out = [];
    for (const r of rows) {
      if (r.category === "trading_profit") {
        const k = dayKey(r.created_at);
        if (emitted[k]) continue;
        emitted[k] = true;
        const g = groups[k];
        if (g.items.length > 1) out.push({ type: "group", key: k, date: g.date, total: g.total, count: g.items.length, items: g.items });
        else out.push({ type: "single", row: g.items[0] });
      } else {
        out.push({ type: "single", row: r });
      }
    }
    return out;
  }, [rows]);

  return (
    <div className="pb-24" data-testid="revenue-page">
      {/* Sticky top: header + income cards (scroll par fixed) */}
      <div className="sticky top-0 z-20 pt-3 pb-2" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div className="px-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-1" style={{ color: "var(--ink)" }} data-testid="revenue-back">
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <div className="text-center">
          <div className="font-display font-black text-2xl leading-tight" style={{ color: "var(--ink)" }}>Revenue</div>
          <div className="text-[12px]" style={{ color: "var(--text-mute)" }}>Track your income & growth</div>
        </div>
        <CalendarDays size={22} strokeWidth={2.2} style={{ color: "var(--ink)" }} />
      </div>

      {/* Today / Total income cards */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl px-3 py-3 flex items-center gap-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }} data-testid="revenue-today-card">
          <IconBars s={28} />
          <div className="min-w-0">
            <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Today&apos;s Income</div>
            <div className="text-[16px] font-black tabular-nums leading-tight" style={{ color: "var(--good)" }} data-testid="revenue-today">
              +{fmtNum(today, 4)} <span className="text-[10px]">USDT</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl px-3 py-3 flex items-center gap-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }} data-testid="revenue-total-card">
          <IconCoinStack s={28} />
          <div className="min-w-0">
            <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Total Income</div>
            <div className="text-[16px] font-black tabular-nums leading-tight" style={{ color: "var(--good)" }} data-testid="revenue-total">
              +{fmtNum(total, 4)} <span className="text-[10px]">USDT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Income trend — MASTER (same on every tab) */}
      <div className="px-4 mt-2.5">
        <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }} data-testid="income-trend">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[12px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Income Trend</div>
            <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--text)" }}>
              Last 30 Days <ChevronDown size={13} />
            </div>
          </div>
          <div className="relative">
            {lastVal > 0 && (
              <div className="absolute right-1 top-0 z-10 px-2 py-0.5 rounded-md text-[10px] font-black text-white" style={{ background: "var(--good)" }}>
                +{fmtNum(lastVal, 4)}
              </div>
            )}
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={data?.trend || []} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16A34A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16A34A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "var(--text-mute)", fontSize: 8.5 }} tickFormatter={(v) => {
                  const d = new Date(v + "T00:00:00Z");
                  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" });
                }} interval="preserveStartEnd" minTickGap={40} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-mute)", fontSize: 8.5 }} tickFormatter={(v) => `$${v}`} width={38} axisLine={false} tickLine={false} />
                <Tooltip content={<TrendTooltip />} />
                <Area type="monotone" dataKey="total" stroke="#16A34A" strokeWidth={2.2} fill="url(#incomeGrad)" dot={false} activeDot={{ r: 4, fill: "#16A34A" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-3 px-4 flex gap-2 overflow-x-auto no-scrollbar" data-testid="revenue-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-[12.5px] font-bold transition-all"
            style={
              tab === t.id
                ? { background: "linear-gradient(90deg, #2563EB, #10B981)", color: "#fff" }
                : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)" }
            }
            data-testid={`revenue-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Selected category earning cards (not on All — overall cards upar already hain) */}
      {catStats && (() => {
        const CatIcon = META[tab]?.Icon || IconBars;
        return (
          <div className="px-4 mt-3 grid grid-cols-2 gap-2.5" data-testid="category-earning-cards">
            <div className="rounded-xl px-3 py-3 flex items-center gap-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }} data-testid="category-today-card">
              <CatIcon s={26} />
              <div className="min-w-0">
                <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Today Earning</div>
                <div className="text-[16px] font-black tabular-nums leading-tight" style={{ color: "var(--good)" }} data-testid="category-today">
                  +{fmtNum(catStats.today || 0, 4)} <span className="text-[10px]">USDT</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl px-3 py-3 flex items-center gap-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }} data-testid="category-total-card">
              <CatIcon s={26} />
              <div className="min-w-0">
                <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Total Earning</div>
                <div className="text-[16px] font-black tabular-nums leading-tight" style={{ color: "var(--good)" }} data-testid="category-total">
                  +{fmtNum(catStats.total || 0, 4)} <span className="text-[10px]">USDT</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      </div>

      {/* Income history — heading sirf All tab par */}
      <div className="px-4 mt-4">
        {tab === "all" && (
          <>
            <div className="font-display font-black text-2xl" style={{ color: "var(--ink)" }}>Income History</div>
            <div className="text-[12px] mb-2.5" style={{ color: "var(--text-mute)" }}>Tap a record to see the details</div>
          </>
        )}

        {rows.length === 0 ? (
          <div className="text-center text-sm py-10 rounded-xl" style={{ color: "var(--text-mute)", background: "var(--surface)", border: "1px solid var(--border)" }} data-testid="income-empty">
            No income records yet in this category
          </div>
        ) : (
          <div className="space-y-1.5" data-testid="income-history-list">
            {displayList.slice(0, 100).map((item) => {
              if (item.type === "group") {
                return <ProfitDayGroup key={`g-${item.key}`} date={item.date} total={item.total} count={item.count} items={item.items} />;
              }
              const r = item.row;
              const meta = tab.startsWith("global_")
                ? META[tab]
                : META[r.category] || { Icon: IconBars, title: r.category };
              return <IncomeRow key={r.id} r={r} meta={meta} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
