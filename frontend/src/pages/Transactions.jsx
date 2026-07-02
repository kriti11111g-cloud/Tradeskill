import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { X, Calendar, ChevronDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD, fmtNum, shortSymbol } from "@/lib/format";
import CoinIcon from "@/components/CoinIcon";

const filters = ["SELL", "BUY"];

const monoNum = { fontVariantNumeric: "tabular-nums" };

const fmtDateUTC = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
};

const fmtTimeUTC = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const fmtFullUTC = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${fmtDateUTC(iso)} · ${hh}:${mm}:${ss} UTC`;
};

export default function Transactions() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState("SELL");
  const [openId, setOpenId] = useState(null);
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
    setOpenId(null);
  }, [symbolFilter, dateFilter]);

  const filtered = rows.filter((r) => r.side === f);

  const clearFilter = (key) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next);
  };

  const totalProfit = filtered
    .filter((r) => r.side === "SELL")
    .reduce((s, r) => s + (r.profit || 0), 0);

  const dateLabel = dateFilter ? fmtDateUTC(dateFilter + "T00:00:00Z") : "";

  return (
    <div className="pb-24">
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
                <span className="font-bold uppercase tracking-widest text-[#FFD700]" style={monoNum}>
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

      {/* SELL / BUY toggle */}
      <div className="px-4 flex gap-2 mb-3">
        {filters.map((x) => (
          <button
            key={x}
            onClick={() => {
              setF(x);
              setOpenId(null);
            }}
            data-testid={`filter-${x}`}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition ${
              f === x
                ? x === "SELL"
                  ? "bg-[#FF007A] text-white border-[#FF007A]"
                  : "bg-[#39FF14] text-[#050914] border-[#39FF14]"
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
            No {f.toLowerCase()} transactions in this view.
          </div>
        )}
        <div className="space-y-1.5" data-testid="tx-list">
          {filtered.map((t) => {
            const isOpen = openId === t.id;
            const sideColor = t.side === "SELL" ? "#FF007A" : "#39FF14";
            const profitPositive = (t.profit || 0) >= 0;
            return (
              <div
                key={t.id}
                data-testid={`tx-row-${t.id}`}
                className={`bg-[#0F1524]/60 backdrop-blur-xl border rounded-lg overflow-hidden transition ${
                  isOpen ? "border-[#00F0FF]/50" : "border-white/20 hover:border-[#00F0FF]/30"
                }`}
              >
                {/* Slim clickable row */}
                <button
                  onClick={() => setOpenId(isOpen ? null : t.id)}
                  data-testid={`tx-toggle-${t.id}`}
                  className="w-full py-1.5 px-2.5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 font-mono font-extrabold text-[10px] leading-none"
                      style={{
                        background: `${sideColor}22`,
                        border: `1px solid ${sideColor}66`,
                        color: sideColor,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {t.side === "SELL" ? "SEL" : "BUY"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[12px] leading-tight flex items-center gap-1.5">
                        {shortSymbol(t.symbol)}/USDT
                      </div>
                      <div
                        className="text-[9px] text-[#8B9BB4] mt-0.5 truncate leading-none"
                        style={monoNum}
                      >
                        {fmtTimeUTC(t.created_at)} UTC · {fmtNum(t.quantity, 6)} @ {fmtNum(t.price, 4)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pl-2">
                    {t.side === "SELL" ? (
                      <div
                        className={`font-bold text-[12px] ${profitPositive ? "text-[#39FF14]" : "text-[#FF007A]"}`}
                        style={monoNum}
                      >
                        {profitPositive ? "+" : ""}
                        {fmtUSD(t.profit || 0)}
                      </div>
                    ) : (
                      <div className="font-bold text-[12px]" style={monoNum}>
                        {fmtUSD(t.amount)}
                      </div>
                    )}
                    <ChevronDown
                      size={12}
                      className={`text-[#8B9BB4] transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {/* Expanded details card */}
                {isOpen && (
                  <div
                    className="px-3 pb-3 pt-1 border-t border-white/10 bg-[#050914]/40"
                    data-testid={`tx-detail-${t.id}`}
                  >
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2" style={monoNum}>
                      <Row label="Date" value={fmtDateUTC(t.created_at)} />
                      <Row label="Time" value={`${fmtTimeUTC(t.created_at)} UTC`} />
                      <Row label="Side" value={t.side} valueColor={sideColor} />
                      <Row label="Mode" value={(t.mode || "demo").toUpperCase()} />
                      <Row label="Symbol" value={t.symbol} />
                      <Row label="Source" value={(t.source || "manual").toUpperCase()} />
                      <Row label="Price" value={fmtNum(t.price, 6)} />
                      <Row label="Quantity" value={fmtNum(t.quantity, 8)} />
                      <Row label="Amount" value={fmtUSD(t.amount)} full />
                      {t.side === "SELL" && (
                        <Row
                          label="Profit"
                          value={`${profitPositive ? "+" : ""}${fmtUSD(t.profit || 0)}`}
                          valueColor={profitPositive ? "#39FF14" : "#FF007A"}
                          full
                        />
                      )}
                      {t.binance_order_id && (
                        <Row label="Order ID" value={String(t.binance_order_id)} full mono />
                      )}
                      {!t.binance_order_id && (
                        <Row label="Order ID" value={t.id.slice(0, 8) + "…" + t.id.slice(-4)} full mono />
                      )}
                      {t.binance_status && <Row label="Status" value={t.binance_status} full />}
                      <Row label="Timestamp" value={fmtFullUTC(t.created_at)} full mono />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor, full, mono }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[8px] uppercase tracking-widest text-[#8B9BB4] font-bold leading-none">
        {label}
      </div>
      <div
        className={`text-[11px] font-bold mt-0.5 break-all leading-tight ${mono ? "font-mono" : ""}`}
        style={{ color: valueColor || "#fff" }}
      >
        {value}
      </div>
    </div>
  );
}
