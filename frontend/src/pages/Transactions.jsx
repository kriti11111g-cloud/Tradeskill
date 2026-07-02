import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { X, Calendar } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD, fmtNum, fmtTime, shortSymbol } from "@/lib/format";
import CoinIcon from "@/components/CoinIcon";

const filters = ["ALL", "BUY", "SELL"];

export default function Transactions() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState("ALL");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const symbolFilter = (searchParams.get("symbol") || "").toUpperCase();
  const dateFilter = searchParams.get("date") || "";
  const hasFilter = !!(symbolFilter || dateFilter);

  useEffect(() => {
    const params = new URLSearchParams();
    if (symbolFilter) params.set("symbol", symbolFilter);
    if (dateFilter) params.set("date", dateFilter);
    const qs = params.toString();
    const url = qs ? `/transactions?${qs}` : "/transactions";
    api.get(url).then(({ data }) => setRows(data));
  }, [symbolFilter, dateFilter]);

  const filtered = rows.filter((r) => (f === "ALL" ? true : r.side === f));

  const clearFilter = (key) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next);
  };

  const totalProfit = filtered
    .filter((r) => r.side === "SELL")
    .reduce((s, r) => s + (r.profit || 0), 0);

  const dateLabel = dateFilter
    ? new Date(dateFilter + "T00:00:00Z").toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="pb-4">
      <PageHeader
        title="Transactions"
        subtitle={
          dateFilter
            ? `${dateLabel} · Trade History`
            : symbolFilter
              ? `${shortSymbol(symbolFilter)} · Trade History`
              : "Trade History"
        }
        showBack={hasFilter}
        onBack={() => navigate("/revenue")}
      />

      {/* Filter chips */}
      {hasFilter && (
        <div className="px-4 mb-3" data-testid="filter-active">
          <div className="flex items-center gap-2 flex-wrap">
            {symbolFilter && (
              <div
                className="flex items-center gap-2 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/10 pl-2 pr-1 py-1 text-xs"
                data-testid="symbol-filter-active"
              >
                <CoinIcon symbol={symbolFilter} size={18} />
                <span className="font-bold uppercase tracking-widest text-[#00F0FF]">
                  {shortSymbol(symbolFilter)}
                </span>
                <button
                  onClick={() => clearFilter("symbol")}
                  data-testid="clear-symbol-filter"
                  className="ml-1 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                  aria-label="Clear symbol filter"
                >
                  <X size={11} />
                </button>
              </div>
            )}
            {dateFilter && (
              <div
                className="flex items-center gap-2 rounded-full border border-[#FFD700]/40 bg-[#FFD700]/10 pl-2.5 pr-1 py-1 text-xs"
                data-testid="date-filter-active"
              >
                <Calendar size={12} className="text-[#FFD700]" />
                <span className="font-bold uppercase tracking-widest text-[#FFD700]">
                  {dateLabel}
                </span>
                <button
                  onClick={() => clearFilter("date")}
                  data-testid="clear-date-filter"
                  className="ml-1 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                  aria-label="Clear date filter"
                >
                  <X size={11} />
                </button>
              </div>
            )}
            {rows.length > 0 && (
              <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold">
                <span className="text-white">{rows.length}</span> trades ·
                <span className={totalProfit >= 0 ? "text-[#39FF14] ml-1" : "text-[#FF007A] ml-1"}>
                  {totalProfit >= 0 ? "+" : ""}
                  {fmtUSD(totalProfit)}
                </span>{" "}
                profit
              </div>
            )}
          </div>
        </div>
      )}

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
              data-testid={`tx-row-${t.id}`}
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
