import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Wallet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const BinanceLogo = ({ size = 14 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2500 2500" width={size} height={size} aria-hidden>
    <path fill="#F0B90B" d="M764.48,1050.52,1250,565l485.75,485.73,282.5-282.5L1250,0,482,768l282.49,282.5M0,1250l282.51-282.51L565,1250,282.5,1532.49Zm764.48,199.51L1250,1935l485.74-485.72,282.65,282.35h0l-768,768.13L482,1732.01l-.14-.15,282.62-282.35M1935,1250l282.5-282.51L2500,1250l-282.5,282.5Z" />
    <path fill="#F0B90B" d="M1536.52,1249.85h.12L1250,963.19,1038.13,1175h0l-24.34,24.35-50.2,50.21-.4.39.4.41L1250,1536.81l286.66-286.66.14-.16-.26-.14" />
  </svg>
);

export default function Revenue() {
  const [data, setData] = useState(null);
  const [wallet, setWallet] = useState(null);
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

  return (
    <div className="pb-24">
      <PageHeader title="Revenue" subtitle="Profit & Loss · Auto-refresh 15s" />

      {/* CARD 1: Wallet Balance (Spot) */}
      <div className="px-4">
        <div
          className="rounded-3xl border border-[#F0B90B]/30 p-5 bg-gradient-to-br from-[#1A1500]/80 to-[#050914]/80 backdrop-blur-xl relative overflow-hidden"
          data-testid="wallet-balance-card"
        >
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-25"
            style={{ background: "radial-gradient(circle, #F0B90B 0%, transparent 70%)" }}
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/15 border border-[#F0B90B]/40 flex items-center justify-center shrink-0">
              <Wallet size={20} className="text-[#F0B90B]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <BinanceLogo size={12} />
                <div className="text-[9px] uppercase tracking-[0.25em] text-[#F0B90B] font-bold">
                  Binance Spot Wallet
                </div>
                {wallet?.connected ? (
                  <span className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-px rounded-full bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/40 leading-none">
                    Live · {wallet.mode?.toUpperCase()}
                  </span>
                ) : (
                  <span className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-px rounded-full bg-white/5 text-[#8B9BB4] border border-white/20 leading-none">
                    Demo
                  </span>
                )}
              </div>
              <div
                className="font-mono font-black text-[26px] mt-1 leading-none text-white"
                style={{ fontVariantNumeric: "tabular-nums" }}
                data-testid="wallet-usdt-balance"
              >
                {wallet == null ? "—" : fmtUSD(wallet.usdt_balance ?? 0)}
              </div>
              <div className="text-[9px] text-[#8B9BB4] mt-1">
                Available USDT · {wallet?.connected ? "Fetched from Binance API" : "Bind API keys for live balance"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CARDS 2 & 3: Today's Profit | Cumulative Profit — thin twin cards */}
      <div className="px-4 mt-2.5 grid grid-cols-2 gap-2.5">
        <div
          className="rounded-2xl border border-white/15 p-3 bg-[#0F1524]/50 backdrop-blur-xl"
          data-testid="today-profit-card"
        >
          <div className="text-[9px] uppercase tracking-[0.2em] text-[#8B9BB4] font-semibold">
            Today&apos;s Profit
          </div>
          <div
            className={`font-mono font-bold text-[18px] tabular-nums mt-1.5 leading-none ${
              today >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
            }`}
            data-testid="today-profit"
          >
            {today >= 0 ? "+" : ""}
            {fmtUSD(today)}
          </div>
          <div className="text-[9px] text-[#8B9BB4] mt-1.5 leading-none">
            {data?.today_trades || 0} sells today
          </div>
        </div>

        <div
          className="rounded-2xl border border-white/15 p-3 bg-[#0F1524]/50 backdrop-blur-xl"
          data-testid="cumulative-profit-card"
        >
          <div className="text-[9px] uppercase tracking-[0.2em] text-[#8B9BB4] font-semibold">
            Cumulative Profit
          </div>
          <div
            className={`font-mono font-bold text-[18px] tabular-nums mt-1.5 leading-none ${
              total >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
            }`}
            data-testid="total-profit"
          >
            {total >= 0 ? "+" : ""}
            {fmtUSD(total)}
          </div>
          <div className="text-[9px] text-[#8B9BB4] mt-1.5 leading-none">
            {data?.total_trades || 0} sells · {data?.by_symbol?.length || 0} symbols
          </div>
        </div>
      </div>

      {data?.daily?.length > 0 && (
        <div className="px-4 mt-2.5">
          <div className="bg-[#0F1524]/50 backdrop-blur-xl border border-white/15 rounded-2xl p-2.5">
            <div className="flex items-center justify-between mb-1 px-1">
              <div className="text-[9px] uppercase tracking-[0.2em] text-[#8B9BB4] font-semibold">
                Daily Profit
              </div>
              <div className="text-[9px] text-[#8B9BB4] tabular-nums">
                All-Time · {data.daily.length}d
              </div>
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={data.daily} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#ffffff08" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#8B9BB4", fontSize: 8 }}
                  tickFormatter={(v) => v.slice(5)}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis tick={{ fill: "#8B9BB4", fontSize: 8 }} width={30} />
                <Tooltip
                  contentStyle={{
                    background: "#0F1524",
                    border: "1px solid rgba(0,240,255,0.3)",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 11,
                    padding: "6px 8px",
                  }}
                  labelStyle={{ color: "#8B9BB4", fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#00F0FF"
                  strokeWidth={1.5}
                  dot={{ fill: "#00F0FF", r: 2 }}
                  activeDot={{ r: 3 }}
                />
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
                  className="w-full bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-lg py-1.5 px-2.5 flex items-center justify-between hover:border-[#00F0FF]/40 hover:bg-[#00F0FF]/5 active:scale-[0.99] transition text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-[#00F0FF]/10 border border-[#00F0FF]/25 flex flex-col items-center justify-center shrink-0">
                      <div className="text-[6px] uppercase tracking-wider text-[#8B9BB4] font-bold leading-none">
                        {dt.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })}
                      </div>
                      <div
                        className="font-mono font-extrabold text-[11px] leading-none mt-px text-[#00F0FF]"
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
