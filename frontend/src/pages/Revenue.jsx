import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Wallet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD } from "@/lib/format";
import CoinIcon from "@/components/CoinIcon";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

// Piecewise Y-axis scale: fixed positive ticks $0, $10, $50, $500, $1k
const PROFIT_BUCKETS = [0, 10, 50, 500, 1000];
const PROFIT_LABELS = ["$0", "$10", "$50", "$500", "$1k"];
const MAX_TICK_INDEX = PROFIT_BUCKETS.length - 1; // 4

function scaleProfit(p) {
  if (p == null || Number.isNaN(p)) return 0;
  // Loss days render as a tiny red marker (0.12) so they're visible for tap
  if (p < 0) return 0.12;
  for (let i = 0; i < MAX_TICK_INDEX; i++) {
    const lo = PROFIT_BUCKETS[i];
    const hi = PROFIT_BUCKETS[i + 1];
    if (p <= hi) {
      const t = hi === lo ? 0 : (p - lo) / (hi - lo);
      return i + t;
    }
  }
  return MAX_TICK_INDEX;
}

const BinanceLogo = ({ size = 14 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2500 2500" width={size} height={size} aria-hidden>
    <path fill="#F59E0B" d="M764.48,1050.52,1250,565l485.75,485.73,282.5-282.5L1250,0,482,768l282.49,282.5M0,1250l282.51-282.51L565,1250,282.5,1532.49Zm764.48,199.51L1250,1935l485.74-485.72,282.65,282.35h0l-768,768.13L482,1732.01l-.14-.15,282.62-282.35M1935,1250l282.5-282.51L2500,1250l-282.5,282.5Z" />
    <path fill="#F59E0B" d="M1536.52,1249.85h.12L1250,963.19,1038.13,1175h0l-24.34,24.35-50.2,50.21-.4.39.4.41L1250,1536.81l286.66-286.66.14-.16-.26-.14" />
  </svg>
);

function ProfitBarTooltip({ active, payload, trades }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const meta = (trades || []).find((x) => x.date === d.date);
  const positive = d.profit >= 0;
  const dt = new Date(d.date + "T00:00:00Z");
  const dateLabel = dt.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <div
      className="bg-[color:var(--surface)] border rounded-lg px-2.5 py-2 shadow-xl"
      style={{
        borderColor: positive ? "rgba(22,163,74,0.4)" : "rgba(248,113,113,0.4)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">
        {dateLabel}
      </div>
      <div
        className={`font-mono font-black text-[14px] leading-none mt-1 ${positive ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"}`}
      >
        {positive ? "+" : ""}${(d.profit || 0).toFixed(2)}
      </div>
      {meta && (
        <div className="text-[9px] text-[color:var(--text-mute)] mt-1 leading-tight">
          {meta.trades} sells · {meta.symbols.length} coin
          {meta.symbols.length === 1 ? "" : "s"}
        </div>
      )}
      {meta?.symbols?.length > 0 && (
        <div className="text-[9px] text-[color:var(--text-soft)] mt-0.5 leading-tight truncate max-w-[160px]">
          {meta.symbols.map((s) => s.replace("USDT", "")).join(" · ")}
        </div>
      )}
    </div>
  );
}

export default function Revenue() {
  const [data, setData] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => {
      api.get("/revenue/summary").then(({ data }) => setData(data));
      api.get("/wallet/spot").then(({ data }) => setWallet(data)).catch(() => {
        /* keep previous wallet value on transient failure */
      });
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const today = data?.today_profit || 0;
  const total = data?.total_profit || 0;

  const scaledDaily = (data?.daily || []).map((d) => ({
    ...d,
    scaled: scaleProfit(d.profit),
  }));
  const yDomain = [0, MAX_TICK_INDEX];
  const yTicks = [0, 1, 2, 3, 4];
  const yTickFormatter = (v) => PROFIT_LABELS[v] || "";

  return (
    <div className="pb-24">
      <PageHeader title="Revenue" subtitle="Profit & Loss · Auto-refresh 15s" />

      {/* CARD 1: Wallet Balance (Spot) */}
      <div className="px-4">
        <div
          className="rounded-3xl border border-[color:var(--gold)]/30 p-5 bg-[color:var(--surface-2)] backdrop-blur-xl backdrop-blur-xl relative overflow-hidden"
          data-testid="wallet-balance-card"
        >
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-25"
            style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }}
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 flex items-center justify-center shrink-0">
              <Wallet size={20} className="text-[#F59E0B]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <BinanceLogo size={12} />
                <div className="text-[9px] uppercase tracking-[0.25em] text-[#F59E0B] font-bold">
                  Binance Spot Wallet
                </div>
                {wallet?.connected ? (
                  <span className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-px rounded-full bg-[color:var(--good)]/15 text-[color:var(--good)] border border-[color:var(--good)]/40 leading-none">
                    Live · {wallet.mode?.toUpperCase()}
                  </span>
                ) : (
                  <span className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-px rounded-full bg-[color:var(--text)]/5 text-[color:var(--text-mute)] border border-[color:var(--border)] leading-none">
                    Demo
                  </span>
                )}
              </div>
              <div
                className="font-mono font-black text-[26px] mt-1 leading-none text-[color:var(--text)]"
                style={{ fontVariantNumeric: "tabular-nums" }}
                data-testid="wallet-usdt-balance"
              >
                {wallet == null ? "—" : fmtUSD(wallet.usdt_balance ?? 0)}
              </div>
              <div className="text-[9px] text-[color:var(--text-mute)] mt-1">
                Available USDT · {wallet?.connected ? "Fetched from Binance API" : "Bind API keys for live balance"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CARDS 2 & 3: Today's Profit | Cumulative Profit — thin twin cards */}
      <div className="px-4 mt-2.5 grid grid-cols-2 gap-2.5">
        <div
          className="rounded-2xl app-card p-3"
          data-testid="today-profit-card"
        >
          <div className="text-[9px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-semibold">
            Today&apos;s Profit
          </div>
          <div
            className={`font-mono font-bold text-[18px] tabular-nums mt-1.5 leading-none ${
              today >= 0 ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"
            }`}
            data-testid="today-profit"
          >
            {today >= 0 ? "+" : ""}
            {fmtUSD(today)}
          </div>
          <div className="text-[9px] text-[color:var(--text-mute)] mt-1.5 leading-none">
            {data?.today_trades || 0} sells today
          </div>
        </div>

        <div
          className="rounded-2xl app-card p-3"
          data-testid="cumulative-profit-card"
        >
          <div className="text-[9px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-semibold">
            Cumulative Profit
          </div>
          <div
            className={`font-mono font-bold text-[18px] tabular-nums mt-1.5 leading-none ${
              total >= 0 ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"
            }`}
            data-testid="total-profit"
          >
            {total >= 0 ? "+" : ""}
            {fmtUSD(total)}
          </div>
          <div className="text-[9px] text-[color:var(--text-mute)] mt-1.5 leading-none">
            {data?.total_trades || 0} sells · {data?.by_symbol?.length || 0} symbols
          </div>
        </div>
      </div>

      {data?.daily?.length > 0 && (
        <div className="px-4 mt-2.5">
          <div className="app-card rounded-2xl p-2.5">
            <div className="flex items-center justify-between mb-1 px-1">
              <div className="text-[9px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-semibold">
                Daily Profit
              </div>
              <div className="text-[9px] text-[color:var(--text-mute)] tabular-nums">
                All-Time · {data.daily.length}d
              </div>
            </div>
            <ResponsiveContainer width="100%" height={115}>
              <BarChart
                data={scaledDaily}
                margin={{ top: 4, right: 6, left: -8, bottom: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid stroke="#ffffff08" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-mute)", fontSize: 8 }}
                  tickFormatter={(v) => v.slice(5)}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  ticks={yTicks}
                  domain={yDomain}
                  tick={{ fill: "var(--text-mute)", fontSize: 8 }}
                  tickFormatter={yTickFormatter}
                  width={32}
                />
                <ReferenceLine y={0} stroke="#ffffff30" strokeDasharray="2 2" />
                <Tooltip
                  cursor={{ fill: "rgba(22,163,74,0.06)" }}
                  content={<ProfitBarTooltip trades={data.by_date} />}
                />
                <Bar
                  dataKey="scaled"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={22}
                  cursor="pointer"
                  onClick={(entry) => entry?.date && setSelectedDay(entry.date)}
                >
                  {scaledDaily.map((d) => (
                    <Cell
                      key={d.date}
                      fill={d.profit >= 0 ? "var(--good)" : "#F87171"}
                      opacity={selectedDay && selectedDay !== d.date ? 0.35 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {selectedDay && (() => {
              const sel = scaledDaily.find((x) => x.date === selectedDay);
              const meta = (data.by_date || []).find((x) => x.date === selectedDay);
              if (!sel) return null;
              const pos = sel.profit >= 0;
              const dt = new Date(selectedDay + "T00:00:00Z");
              const label = dt.toLocaleDateString(undefined, {
                month: "short",
                day: "2-digit",
                year: "numeric",
                timeZone: "UTC",
              });
              return (
                <div
                  className="mt-2 rounded-xl border p-2.5 bg-[color:var(--bg-base)]/70 backdrop-blur-xl"
                  style={{
                    borderColor: pos ? "rgba(22,163,74,0.35)" : "rgba(248,113,113,0.35)",
                  }}
                  data-testid="bar-detail-panel"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {label} · UTC
                      </div>
                      <div
                        className={`font-mono font-black text-[20px] leading-none mt-1 ${pos ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {pos ? "+" : ""}${(sel.profit || 0).toFixed(2)}
                      </div>
                      {meta && (
                        <div className="text-[9px] text-[color:var(--text-mute)] mt-1">
                          {meta.trades} sells · {meta.symbols.length} coin
                          {meta.symbols.length === 1 ? "" : "s"}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedDay(null)}
                      data-testid="bar-detail-close"
                      className="w-6 h-6 rounded-full bg-[color:var(--text)]/10 hover:bg-[color:var(--text)]/15 flex items-center justify-center shrink-0"
                      aria-label="Close"
                    >
                      <span className="text-[10px]">✕</span>
                    </button>
                  </div>
                  {meta?.symbols?.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {meta.symbols.map((s) => (
                        <div
                          key={s}
                          className="flex items-center gap-1 rounded-full bg-[color:var(--text)]/5 border border-[color:var(--border-soft)] pl-1 pr-2 py-0.5"
                        >
                          <CoinIcon symbol={s} size={14} />
                          <span className="text-[9px] font-bold uppercase tracking-widest">
                            {s.replace("USDT", "")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/transactions?date=${selectedDay}`)}
                    data-testid="bar-detail-view-trades"
                    className="mt-2 w-full py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/30 text-[color:var(--primary)] hover:bg-[color:var(--primary)]/20 transition"
                  >
                    View all trades of this day →
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {data?.by_date?.length > 0 && (
        <div className="px-4 mt-4">
          <div className="font-display font-bold text-lg mb-1">Daily History</div>
          <div className="text-[10px] uppercase tracking-widest text-[color:var(--text-mute)] mb-2">
            Tap a date to see the trades of that day
          </div>
          <div className="space-y-1.5" data-testid="by-date-list">
            {data.by_date.map((d) => {
              const dt = new Date(d.date + "T00:00:00Z");
              const label = dt.toLocaleDateString(undefined, {
                month: "short",
                day: "2-digit",
                year: "numeric",
                timeZone: "UTC",
              });
              const todayStr = new Date().toISOString().slice(0, 10);
              const isToday = d.date === todayStr;
              return (
                <button
                  key={d.date}
                  onClick={() => navigate(`/transactions?date=${d.date}`)}
                  data-testid={`revenue-date-${d.date}`}
                  className="w-full app-card rounded-lg py-1.5 px-2.5 flex items-center justify-between hover:border-[color:var(--primary)]/40 hover:bg-[color:var(--primary)]/5 active:scale-[0.99] transition text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/25 flex flex-col items-center justify-center shrink-0">
                      <div className="text-[6px] uppercase tracking-wider text-[color:var(--text-mute)] font-bold leading-none">
                        {dt.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })}
                      </div>
                      <div
                        className="font-mono font-extrabold text-[11px] leading-none mt-px text-[color:var(--primary)]"
                        style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
                      >
                        {String(dt.getUTCDate()).padStart(2, "0")}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div
                        className="font-bold text-[12px] flex items-center gap-1.5 leading-tight"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {label}
                        {isToday && (
                          <span className="text-[7px] uppercase tracking-widest font-bold px-1 py-px rounded-full bg-[color:var(--good)]/15 text-[color:var(--good)] border border-[color:var(--good)]/40 leading-none">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-[color:var(--text-mute)] mt-0.5 truncate leading-none">
                        {d.trades} sells · {d.symbols.length} coin{d.symbols.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pl-2">
                    <div
                      className={`font-display font-bold tabular-nums text-[12px] ${
                        d.profit >= 0 ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"
                      }`}
                    >
                      {d.profit >= 0 ? "+" : ""}
                      {fmtUSD(d.profit)}
                    </div>
                    <ChevronRight size={12} className="text-[color:var(--text-mute)]" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(!data?.total_trades) && (
        <div className="text-center text-sm text-[color:var(--text-mute)] py-8 px-6" data-testid="empty-revenue">
          No completed sells yet. Once your bot closes a position, profit will appear here.
        </div>
      )}
    </div>
  );
}
