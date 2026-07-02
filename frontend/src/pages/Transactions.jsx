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
                <span className="text-white">{rows.length}</span> trades
                {f === "SELL" && (
                  <>
                    {" "}·
                    <span className={totalProfit >= 0 ? "text-[#39FF14] ml-1" : "text-[#FF007A] ml-1"}>
                      {totalProfit >= 0 ? "+" : ""}
                      {fmtUSD(totalProfit)}
                    </span>{" "}
                    profit
                  </>
                )}
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
                    <CoinIcon symbol={t.symbol} size={28} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 leading-tight">
                        <span className="font-bold text-[12px]">{shortSymbol(t.symbol)}/USDT</span>
                        <span
                          className="text-[8px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded leading-none"
                          style={{
                            background: sideColor,
                            color: t.side === "SELL" ? "#fff" : "#050914",
                          }}
                        >
                          {t.side}
                        </span>
                      </div>
                      <div
                        className="text-[9px] text-[#8B9BB4] mt-0.5 truncate leading-none"
                        style={monoNum}
                      >
                        {fmtTimeUTC(t.created_at)} UTC · {fmtNum(t.quantity, 6)} · ${fmtNum(t.price, 4)}
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
                    className="px-3 pb-3 pt-2.5 border-t border-white/10 bg-[#050914]/40"
                    data-testid={`tx-detail-${t.id}`}
                  >
                    {/* Top strip: icon + pair + side pill (left) · date/time (right) */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CoinIcon symbol={t.symbol} size={32} />
                        <div className="min-w-0">
                          <div className="font-display font-bold text-[14px] leading-none">
                            {shortSymbol(t.symbol)}/USDT
                          </div>
                          <div className="mt-1.5">
                            <span
                              className="text-[8px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded leading-none"
                              style={{
                                background: sideColor,
                                color: t.side === "SELL" ? "#fff" : "#050914",
                              }}
                            >
                              {t.side}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0" style={monoNum}>
                        <div className="text-[10px] text-[#8B9BB4] leading-none">
                          {fmtDateUTC(t.created_at)}
                        </div>
                        <div className="text-[11px] font-mono font-bold text-white mt-1 leading-none">
                          {fmtTimeUTC(t.created_at)} UTC
                        </div>
                      </div>
                    </div>

                    {/* Label · Value list */}
                    <div className="mt-2.5 space-y-2" style={monoNum}>
                      <KV
                        label="Exchange"
                        value={
                          <span className="inline-flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2500 2500" width="14" height="14" aria-hidden>
                              <path fill="#F0B90B" d="M764.48,1050.52,1250,565l485.75,485.73,282.5-282.5L1250,0,482,768l282.49,282.5M0,1250l282.51-282.51L565,1250,282.5,1532.49Zm764.48,199.51L1250,1935l485.74-485.72,282.65,282.35h0l-768,768.13L482,1732.01l-.14-.15,282.62-282.35M1935,1250l282.5-282.51L2500,1250l-282.5,282.5Z" />
                              <path fill="#F0B90B" d="M1536.52,1249.85h.12L1250,963.19,1038.13,1175h0l-24.34,24.35-50.2,50.21-.4.39.4.41L1250,1536.81l286.66-286.66.14-.16-.26-.14" />
                            </svg>
                            Binance
                          </span>
                        }
                        valueClass="text-[#F0B90B]"
                      />
                      <KV
                        label="Order No."
                        value={t.binance_order_id ? String(t.binance_order_id) : t.id.slice(0, 8) + "…" + t.id.slice(-4)}
                        mono
                        copyable
                      />
                      <KV label="Price (USDT)" value={`$${fmtNum(t.price, 6)}`} valueClass={t.side === "SELL" ? "text-[#FF007A]" : "text-[#39FF14]"} />
                      {t.side === "SELL" && t.quantity > 0 && (
                        <KV
                          label="Avg Buy Price (USDT)"
                          value={`$${fmtNum((t.amount - (t.profit || 0)) / t.quantity, 6)}`}
                          valueClass="text-[#39FF14]"
                        />
                      )}
                      <KV label={`Filled (${shortSymbol(t.symbol)})`} value={fmtNum(t.quantity, 8)} />
                      <KV label="Amount (USDT)" value={fmtUSD(t.amount)} />
                      {t.side === "SELL" && (
                        <>
                          <KV
                            label="Profit (USDT)"
                            value={`${profitPositive ? "+" : ""}${fmtUSD(t.profit || 0)}`}
                            valueClass={profitPositive ? "text-[#39FF14] font-black" : "text-[#FF007A] font-black"}
                          />
                          {t.quantity > 0 && (t.amount - (t.profit || 0)) > 0 && (
                            <KV
                              label="ROI"
                              value={`${profitPositive ? "+" : ""}${(((t.profit || 0) / (t.amount - (t.profit || 0))) * 100).toFixed(2)}%`}
                              valueClass={profitPositive ? "text-[#39FF14]" : "text-[#FF007A]"}
                            />
                          )}
                        </>
                      )}
                      <KV label="Role" value="Taker" />
                      <KV label="Mode" value={(t.mode || "demo").toUpperCase()} />
                      <KV label="Source" value={(t.source || "manual").toUpperCase()} />
                      {t.binance_status && <KV label="Status" value={t.binance_status} />}
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

function KV({ label, value, valueClass, mono, copyable }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold shrink-0">
        {label}
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className={`text-[12px] font-bold text-white text-right truncate ${mono ? "font-mono" : ""} ${valueClass || ""}`}
        >
          {value}
        </div>
        {copyable && (
          <button
            onClick={onCopy}
            data-testid="copy-order-id"
            className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
            aria-label="Copy"
          >
            {copied ? (
              <span className="text-[8px] font-black text-[#39FF14]">✓</span>
            ) : (
              <span className="text-[9px] text-[#8B9BB4]">⧉</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
