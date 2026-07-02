import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Revenue() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => api.get("/revenue/summary").then(({ data }) => setData(data));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const today = data?.today_profit || 0;
  const total = data?.total_profit || 0;

  return (
    <div className="pb-24">
      <PageHeader title="Revenue" subtitle="Profit & Loss · Auto-refresh 15s" />

      {/* HERO: Today + Cumulative side-by-side (HiTechBot style) */}
      <div className="px-4">
        <div className="rounded-3xl border border-white/25 p-6 bg-gradient-to-br from-[#0F1524]/80 to-[#050914]/60 backdrop-blur-xl relative overflow-hidden">
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-30"
            style={{
              background:
                today >= 0
                  ? "radial-gradient(circle, #39FF14 0%, transparent 70%)"
                  : "radial-gradient(circle, #FF007A 0%, transparent 70%)",
            }}
          />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#8B9BB4] font-bold">
              Today&apos;s Profit
            </div>
            <div
              className={`font-display font-black text-4xl tabular-nums mt-2 ${
                today >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
              }`}
              data-testid="today-profit"
            >
              {today >= 0 ? "+" : ""}
              {fmtUSD(today)}
            </div>
            <div className="text-[10px] text-[#8B9BB4] mt-1">
              {data?.today_trades || 0} sells today
            </div>

            <div className="h-px w-full bg-white/10 my-4" />

            <div className="text-[10px] uppercase tracking-[0.3em] text-[#8B9BB4] font-bold">
              Cumulative Profit
            </div>
            <div
              className={`font-display font-black text-3xl tabular-nums mt-2 ${
                total >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
              }`}
              data-testid="total-profit"
            >
              {total >= 0 ? "+" : ""}
              {fmtUSD(total)}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold">
                  Total Sells
                </div>
                <div className="font-display font-bold text-lg tabular-nums mt-0.5">
                  {data?.total_trades || 0}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold">
                  Symbols
                </div>
                <div className="font-display font-bold text-lg tabular-nums mt-0.5">
                  {data?.by_symbol?.length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {data?.daily?.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
            <div className="font-display font-bold text-sm mb-2">Daily Profit (Last 14d)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.daily}>
                <CartesianGrid stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#8B9BB4", fontSize: 10 }} />
                <YAxis tick={{ fill: "#8B9BB4", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0F1524",
                    border: "1px solid rgba(0,240,255,0.3)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                />
                <Line type="monotone" dataKey="profit" stroke="#00F0FF" strokeWidth={2} dot={{ fill: "#00F0FF", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data?.by_date?.length > 0 && (
        <div className="px-4 mt-4">
          <div className="font-display font-bold text-lg mb-1">Daily History</div>
          <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] mb-2">
            Tap a date to see the trades of that day
          </div>
          <div className="space-y-1.5" data-testid="by-date-list">
            {data.by_date.map((d) => {
              const dt = new Date(d.date + "T00:00:00Z");
              const label = dt.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
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
                  className="w-full bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-lg py-1.5 px-2.5 flex items-center justify-between hover:border-[#00F0FF]/40 hover:bg-[#00F0FF]/5 active:scale-[0.99] transition text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-[#00F0FF]/10 border border-[#00F0FF]/25 flex flex-col items-center justify-center shrink-0">
                      <div className="text-[6px] uppercase tracking-wider text-[#8B9BB4] font-bold leading-none">
                        {dt.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })}
                      </div>
                      <div className="font-display font-black text-[11px] leading-none mt-px text-[#00F0FF] tabular-nums">
                        {dt.getUTCDate()}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-[12px] flex items-center gap-1.5 leading-tight">
                        {label}
                        {isToday && (
                          <span className="text-[7px] uppercase tracking-widest font-bold px-1 py-px rounded-full bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/40 leading-none">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-[#8B9BB4] mt-0.5 truncate leading-none">
                        {d.trades} sells · {d.symbols.length} coin{d.symbols.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pl-2">
                    <div
                      className={`font-display font-bold tabular-nums text-[12px] ${
                        d.profit >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
                      }`}
                    >
                      {d.profit >= 0 ? "+" : ""}
                      {fmtUSD(d.profit)}
                    </div>
                    <ChevronRight size={12} className="text-[#8B9BB4]" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(!data?.total_trades) && (
        <div className="text-center text-sm text-[#8B9BB4] py-8 px-6" data-testid="empty-revenue">
          No completed sells yet. Once your bot closes a position, profit will appear here.
        </div>
      )}
    </div>
  );
}
