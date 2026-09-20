import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, CalendarDays, ChevronDown } from "lucide-react";
import api from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { IconPeople as IconGroup, IconProfit, IconBars, IconCoinStack, IconPersonAdd, IconCrown, IconHandDollar } from "@/components/IncomeIcons";

const TABS = [
  { id: "all", label: "All" },
  { id: "trading_profit", label: "Trading Profit", Icon: IconProfit, title: "Trading Profit" },
  { id: "trading_commission", label: "Trading Commission", Icon: IconHandDollar, title: "Trading Commission" },
  { id: "direct_income", label: "Direct Income", Icon: IconPersonAdd, title: "Direct Income" },
  { id: "support_income", label: "Support Income", Icon: IconGroup, title: "Support Income" },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `global_${i + 1}`,
    label: `Global Level-${String(i + 1).padStart(2, "0")}`,
    Icon: IconCrown,
    title: `Global Royalty Level-${String(i + 1).padStart(2, "0")}`,
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
      <div className="text-[13px] font-black" style={{ color: "var(--good)" }}>+{fmtNum(d.total, 2)}</div>
    </div>
  );
}

export default function Revenue() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("all");
  const [openRow, setOpenRow] = useState(null);
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
      return h.filter((r) => r.category === "trading_commission" && r.level === lvl);
    }
    return h.filter((r) => r.category === tab);
  }, [data, tab]);

  const lastVal = useMemo(() => {
    const t = data?.trend || [];
    for (let i = t.length - 1; i >= 0; i--) if (t[i].total > 0) return t[i].total;
    return 0;
  }, [data]);

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
              +{fmtNum(today, 2)} <span className="text-[10px]">USDT</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl px-3 py-3 flex items-center gap-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }} data-testid="revenue-total-card">
          <IconCoinStack s={28} />
          <div className="min-w-0">
            <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Total Income</div>
            <div className="text-[16px] font-black tabular-nums leading-tight" style={{ color: "var(--good)" }} data-testid="revenue-total">
              +{fmtNum(total, 2)} <span className="text-[10px]">USDT</span>
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
                +{fmtNum(lastVal, 2)}
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
            onClick={() => { setTab(t.id); setOpenRow(null); }}
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
                  +{fmtNum(catStats.today || 0, 2)} <span className="text-[10px]">USDT</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl px-3 py-3 flex items-center gap-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }} data-testid="category-total-card">
              <CatIcon s={26} />
              <div className="min-w-0">
                <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: "var(--ink)" }}>Total Earning</div>
                <div className="text-[16px] font-black tabular-nums leading-tight" style={{ color: "var(--good)" }} data-testid="category-total">
                  +{fmtNum(catStats.total || 0, 2)} <span className="text-[10px]">USDT</span>
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
            {rows.slice(0, 100).map((r) => {
              const meta =
                tab.startsWith("global_")
                  ? META[tab]
                  : META[r.category] || { Icon: IconBars, title: r.category };
              const open = openRow === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setOpenRow(open ? null : r.id)}
                  className="rounded-xl px-3 py-2 cursor-pointer select-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", touchAction: "manipulation" }}
                  data-testid={`income-row-${r.category}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0"><meta.Icon s={30} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-black truncate leading-tight" style={{ color: "var(--ink)" }}>
                        {meta.title}
                      </div>
                      <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: "var(--text-mute)" }}>
                        {fmtDate(r.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--good)" }}>
                        +{fmtNum(r.amount, 2)} USDT
                      </span>
                      <ChevronRight size={16} strokeWidth={2.4} style={{ color: "var(--ink)", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                    </div>
                  </div>
                  {open && (
                    r.category === "trading_profit" && r.trade ? (
                      <div className="mt-1.5 pt-2 space-y-1.5" style={{ borderTop: "1px dashed var(--border)" }} data-testid="income-row-detail">
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}
