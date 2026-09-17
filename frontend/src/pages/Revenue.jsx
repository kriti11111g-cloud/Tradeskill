import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, CalendarDays, ChevronDown } from "lucide-react";
import api from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

/* Solid black icons — 100% match with reference image */
const Ink = ({ children, s }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="var(--ink)">{children}</svg>
);
const IconBars = ({ s = 30 }) => (
  <Ink s={s}><path d="M4 20.5h3v-7H4v7zm5 0h3V9H9v11.5zm5 0h3v-5h-3v5zm5 0h3V4h-3v16.5z" /></Ink>
);
const IconCoinStack = ({ s = 30 }) => (
  <Ink s={s}><path d="M12 3C7.58 3 4 4.34 4 6s3.58 3 8 3 8-1.34 8-3-3.58-3-8-3zM4 8.5V11c0 1.66 3.58 3 8 3s8-1.34 8-3V8.5c0 1.66-3.58 3-8 3s-8-1.34-8-3zm0 5V16c0 1.66 3.58 3 8 3s8-1.34 8-3v-2.5c0 1.66-3.58 3-8 3s-8-1.34-8-3z" /></Ink>
);
const IconGroup = ({ s = 30 }) => (
  <Ink s={s}><path d="M0 18v-1.575q0-1.1 1.113-1.763Q2.225 14 4 14q.325 0 .625.012.3.013.575.063-.35.5-.525 1.075-.175.575-.175 1.225V18Zm6 0v-1.625q0-.8.437-1.463.438-.662 1.238-1.162.8-.5 1.912-.75.813-.25 2.113-.25 1.325 0 2.438.25 1.112.25 1.912.75t1.225 1.162q.425.663.425 1.463V18Zm13.5 0v-1.625q0-.65-.163-1.225-.162-.575-.487-1.075.275-.05.563-.063Q19.7 14 20 14q1.775 0 2.888.65Q24 15.3 24 16.425V18ZM4 13q-.825 0-1.412-.588Q2 11.825 2 11t.588-1.413Q3.175 9 4 9t1.412.587Q6 10.175 6 11q0 .825-.588 1.412Q4.825 13 4 13Zm16 0q-.825 0-1.413-.588Q18 11.825 18 11t.587-1.413Q19.175 9 20 9q.825 0 1.413.587Q22 10.175 22 11q0 .825-.587 1.412Q20.825 13 20 13Zm-8-1q-1.25 0-2.125-.875T9 9q0-1.25.875-2.125T12 6q1.25 0 2.125.875T15 9q0 1.25-.875 2.125T12 12Z" /></Ink>
);
const IconPersonAdd = ({ s = 30 }) => (
  <Ink s={s}><path d="M10 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h13.5a6.5 6.5 0 0 1-.4-6h-.02c-1.6-.6-3.6 0-5.08 0z" /><path d="M17.5 12.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm2.9 5.7h-2.2v2.2h-1.4v-2.2h-2.2v-1.4h2.2v-2.2h1.4v2.2h2.2v1.4z" /></Ink>
);
const IconCrown = ({ s = 30 }) => (
  <Ink s={s}><path d="M4.5 16 2.6 5.9l5.3 4.4L12 4.2l4.1 6.1 5.3-4.4L19.5 16h-15zm0 2.2h15V20h-15v-1.8z" /></Ink>
);

const TABS = [
  { id: "all", label: "All" },
  { id: "trading_profit", label: "Trading Profit", Icon: IconBars, title: "Trading Profit" },
  { id: "trading_commission", label: "Trading Commission", Icon: IconBars, title: "Trading Commission" },
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
    const load = () => api.get("/revenue/income").then(({ data }) => setData(data)).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const stats = tab === "all" ? data?.all : data?.categories?.[tab];
  const today = stats?.today || 0;
  const total = stats?.total || 0;

  const rows = useMemo(() => {
    const h = data?.history || [];
    return tab === "all" ? h : h.filter((r) => r.category === tab);
  }, [data, tab]);

  const lastVal = useMemo(() => {
    const t = data?.trend || [];
    for (let i = t.length - 1; i >= 0; i--) if (t[i].total > 0) return t[i].total;
    return 0;
  }, [data]);

  return (
    <div className="pb-24 pt-3" data-testid="revenue-page">
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

      {/* Income history */}
      <div className="px-4 mt-4">
        <div className="font-display font-black text-2xl" style={{ color: "var(--ink)" }}>Income History</div>
        <div className="text-[12px] mb-2.5" style={{ color: "var(--text-mute)" }}>Tap a record to see the details</div>

        {rows.length === 0 ? (
          <div className="text-center text-sm py-10 rounded-xl" style={{ color: "var(--text-mute)", background: "var(--surface)", border: "1px solid var(--border)" }} data-testid="income-empty">
            No income records yet in this category
          </div>
        ) : (
          <div className="space-y-1.5" data-testid="income-history-list">
            {rows.slice(0, 100).map((r) => {
              const meta = META[r.category] || { Icon: IconBars, title: r.category };
              const open = openRow === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setOpenRow(open ? null : r.id)}
                  className="rounded-xl px-3 py-2 cursor-pointer"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
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
                    <div className="mt-1.5 pt-1.5 text-[10.5px] leading-snug" style={{ borderTop: "1px dashed var(--border)", color: "var(--text-soft)" }} data-testid="income-row-detail">
                      {r.note || meta.title} · {new Date(r.created_at).toLocaleString()}
                    </div>
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
