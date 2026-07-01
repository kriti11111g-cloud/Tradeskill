import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD, fmtNum } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Revenue() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/revenue/summary").then(({ data }) => setData(data));
  }, []);

  return (
    <div className="pb-4">
      <PageHeader title="Revenue" subtitle="Profit & Loss" />

      <div className="px-4">
        <div className="rounded-3xl border border-white/25 p-6 bg-[#0F1524]/60 backdrop-blur-xl">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#8B9BB4] font-bold">Total Profit</div>
          <div
            className={`font-display font-black text-4xl tabular-nums mt-2 ${
              (data?.total_profit || 0) >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
            }`}
            data-testid="total-profit"
          >
            {data?.total_profit >= 0 ? "+" : ""}
            {fmtUSD(data?.total_profit || 0)}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold">Total Trades</div>
              <div className="font-display font-bold text-lg tabular-nums mt-0.5">{data?.total_trades || 0}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold">Symbols</div>
              <div className="font-display font-bold text-lg tabular-nums mt-0.5">{data?.by_symbol?.length || 0}</div>
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

      {data?.by_symbol?.length > 0 && (
        <div className="px-4 mt-4">
          <div className="font-display font-bold text-lg mb-3">By Symbol</div>
          <div className="space-y-2">
            {data.by_symbol.map((s) => (
              <div
                key={s.symbol}
                className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3 flex items-center justify-between"
              >
                <div className="font-display font-bold text-sm">{s.symbol.replace("USDT", "/USDT")}</div>
                <div className={`font-display font-bold tabular-nums text-sm ${s.profit >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"}`}>
                  {s.profit >= 0 ? "+" : ""}
                  {fmtUSD(s.profit)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!data?.total_trades) && (
        <div className="text-center text-sm text-[#8B9BB4] py-12 px-6" data-testid="empty-revenue">
          No completed sells yet. Once your bot closes a position, profit will appear here.
        </div>
      )}
    </div>
  );
}
