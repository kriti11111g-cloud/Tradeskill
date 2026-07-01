import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD, fmtNum, fmtTime, shortSymbol } from "@/lib/format";
import CoinIcon from "@/components/CoinIcon";

const filters = ["ALL", "BUY", "SELL"];

export default function Transactions() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState("ALL");

  useEffect(() => {
    api.get("/transactions").then(({ data }) => setRows(data));
  }, []);

  const filtered = rows.filter((r) => (f === "ALL" ? true : r.side === f));

  return (
    <div className="pb-4">
      <PageHeader title="Transactions" subtitle="Trade History" showBack={false} />

      <div className="px-4 flex gap-2 mb-3">
        {filters.map((x) => (
          <button
            key={x}
            onClick={() => setF(x)}
            data-testid={`filter-${x}`}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition ${
              f === x
                ? "bg-[#00F0FF] text-[#050914] border-[#00F0FF]"
                : "bg-white/5 text-[#8B9BB4] border-white/25 hover:bg-white/10"
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="px-4">
        {filtered.length === 0 && (
          <div className="text-center text-sm text-[#8B9BB4] py-16" data-testid="empty-tx">
            No transactions yet. Place a trade to get started.
          </div>
        )}
        <div className="space-y-2" data-testid="tx-list">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3 flex items-center justify-between hover:border-[#00F0FF]/30 transition"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <CoinIcon symbol={t.symbol} size={40} />
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#050914] flex items-center justify-center font-display font-black text-[8px] ${
                      t.side === "BUY"
                        ? "bg-[#39FF14] text-[#050914]"
                        : "bg-[#FF007A] text-white"
                    }`}
                  >
                    {t.side === "BUY" ? "B" : "S"}
                  </div>
                </div>
                <div>
                  <div className="font-display font-bold text-sm">
                    {t.side} {shortSymbol(t.symbol)}
                  </div>
                  <div className="text-[10px] text-[#8B9BB4] tabular-nums mt-0.5">
                    {fmtNum(t.quantity, 6)} @ {fmtNum(t.price, 4)} · {fmtTime(t.created_at)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold tabular-nums text-sm">{fmtUSD(t.amount)}</div>
                {t.side === "SELL" && (
                  <div
                    className={`text-[11px] font-bold tabular-nums mt-0.5 ${
                      t.profit >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
                    }`}
                  >
                    {t.profit >= 0 ? "+" : ""}
                    {fmtUSD(t.profit)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
