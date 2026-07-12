import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { X, Calendar, ChevronDown, Wallet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD, fmtNum, shortSymbol } from "@/lib/format";
import CoinIcon from "@/components/CoinIcon";

const filters = ["ALL", "SELL", "BUY"];
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
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
const fmtFullUTC = (iso) => (iso ? `${fmtDateUTC(iso)} · ${fmtTimeUTC(iso)} UTC` : "");

const BinanceLogo = ({ size = 12 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2500 2500" width={size} height={size} aria-hidden>
    <path fill="#F0B90B" d="M764.48,1050.52,1250,565l485.75,485.73,282.5-282.5L1250,0,482,768l282.49,282.5M0,1250l282.51-282.51L565,1250,282.5,1532.49Zm764.48,199.51L1250,1935l485.74-485.72,282.65,282.35h0l-768,768.13L482,1732.01l-.14-.15,282.62-282.35M1935,1250l282.5-282.51L2500,1250l-282.5,282.5Z" />
    <path fill="#F0B90B" d="M1536.52,1249.85h.12L1250,963.19,1038.13,1175h0l-24.34,24.35-50.2,50.21-.4.39.4.41L1250,1536.81l286.66-286.66.14-.16-.26-.14" />
  </svg>
);

function WalletBar({ wallet }) {
  if (!wallet) return null;
  return (
    <div className="px-4">
      <div
        className="rounded-xl border border-[color:var(--gold)]/30 p-2.5 bg-gradient-to-br from-[#1A1500]/60 to-[color:var(--bg-base)] backdrop-blur-xl flex items-center gap-2.5"
        data-testid="wallet-balance-card"
      >
        <div className="w-8 h-8 rounded-lg bg-[#F0B90B]/15 border border-[#F0B90B]/40 flex items-center justify-center shrink-0">
          <Wallet size={16} className="text-[#F0B90B]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <BinanceLogo size={10} />
            <div className="text-[8px] uppercase tracking-widest text-[#F0B90B] font-bold">
              Binance Spot
            </div>
            <span
              className={`text-[7px] uppercase tracking-widest font-bold px-1 py-px rounded-full leading-none ${wallet.connected ? "bg-[color:var(--good)]/15 text-[color:var(--good)] border border-[color:var(--good)]/40" : "bg-white/5 text-[color:var(--text-mute)] border border-[color:var(--border)]"}`}
            >
              {wallet.connected ? `Live · ${wallet.mode?.toUpperCase()}` : "Demo"}
            </span>
          </div>
          <div
            className="font-mono font-black text-[16px] tabular-nums mt-0.5 leading-none text-white"
            style={monoNum}
            data-testid="wallet-usdt-balance"
          >
            {fmtUSD(wallet.usdt_balance || 0)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Transactions() {
  const [rows, setRows] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [f, setF] = useState("ALL");
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
    api.get("/wallet/spot").then(({ data }) => setWallet(data)).catch(() => {});
    setOpenId(null);
  }, [symbolFilter, dateFilter]);

  const filtered = rows.filter((r) => (f === "ALL" ? true : r.side === f));
  const clearFilter = (key) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next);
  };
  const dateLabel = dateFilter ? fmtDateUTC(dateFilter + "T00:00:00Z") : "";

  return (
    <div className="pb-24">
      <PageHeader
        title="Trade History"
        subtitle={
          dateFilter
            ? `${dateLabel} · Every Buy & Sell`
            : symbolFilter
              ? `${shortSymbol(symbolFilter)} · Every Buy & Sell`
              : "Every Buy & Sell · Latest First"
        }
        showBack={hasFilter}
        onBack={() => navigate("/revenue")}
      />

      <WalletBar wallet={wallet} />

      {/* Filter chips */}
      {hasFilter && (
        <div className="px-4 mt-3" data-testid="filter-active">
          <div className="flex items-center gap-2 flex-wrap">
            {symbolFilter && (
              <div
                className="flex items-center gap-2 rounded-full border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 pl-2 pr-1 py-1 text-xs"
                data-testid="symbol-filter-active"
              >
                <CoinIcon symbol={symbolFilter} size={16} />
                <span className="font-bold uppercase tracking-widest text-[color:var(--primary)]">
                  {shortSymbol(symbolFilter)}
                </span>
                <button
                  onClick={() => clearFilter("symbol")}
                  data-testid="clear-symbol-filter"
                  className="ml-1 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                  aria-label="Clear symbol"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {dateFilter && (
              <div
                className="flex items-center gap-2 rounded-full border border-[color:var(--warn)]/40 bg-[color:var(--gold)]/10 pl-2.5 pr-1 py-1 text-xs"
                data-testid="date-filter-active"
              >
                <Calendar size={11} className="text-[color:var(--warn)]" />
                <span className="font-bold uppercase tracking-widest text-[color:var(--warn)]" style={monoNum}>
                  {dateLabel}
                </span>
                <button
                  onClick={() => clearFilter("date")}
                  data-testid="clear-date-filter"
                  className="ml-1 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                  aria-label="Clear date"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SIDE toggle */}
      <div className="px-4 mt-3 flex gap-2">
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
                  ? "bg-[color:var(--bad)] text-white border-[color:var(--bad)]"
                  : x === "BUY"
                    ? "bg-[color:var(--good)] text-white border-[color:var(--good)]"
                    : "bg-[color:var(--primary)] text-white border-[color:var(--primary)]"
                : "bg-white/5 text-[color:var(--text-mute)] border-[color:var(--border)] hover:bg-white/10"
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      {/* HiTechBot-style thin trade cards */}
      <div className="px-4 mt-3 space-y-1.5" data-testid="tx-list">
        {filtered.length === 0 && (
          <div className="text-center text-sm text-[color:var(--text-mute)] py-12" data-testid="empty-tx">
            {f === "ALL"
              ? "No transactions in this view."
              : `No ${f.toLowerCase()} transactions in this view.`}
          </div>
        )}
        {filtered.map((t) => {
          const isOpen = openId === t.id;
          const isSell = t.side === "SELL";
          const sideColor = isSell ? "#FF007A" : "#39FF14";
          const profitPositive = (t.profit || 0) >= 0;
          return (
            <div
              key={t.id}
              data-testid={`tx-row-${t.id}`}
              className={`bg-[color:var(--surface)]/60 backdrop-blur-xl border rounded-xl overflow-hidden transition ${
                isOpen ? "border-[color:var(--primary)]/50" : "border-[color:var(--border-soft)] hover:border-[color:var(--primary)]/30"
              }`}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : t.id)}
                data-testid={`tx-toggle-${t.id}`}
                className="w-full py-2 px-2.5 flex items-start gap-2.5 text-left"
              >
                <CoinIcon symbol={t.symbol} size={26} className="shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  {/* Top row: pair + side pill + BINANCE */}
                  <div className="flex items-center gap-1.5 leading-none">
                    <span className="font-bold text-[12px]">{shortSymbol(t.symbol)}/USDT</span>
                    <span
                      className="text-[8px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded leading-none"
                      style={{
                        background: sideColor,
                        color: "#fff",
                      }}
                    >
                      {t.side}
                    </span>
                    <span className="flex items-center gap-1 text-[8px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">
                      <BinanceLogo size={9} />
                      Binance
                    </span>
                  </div>
                  {/* Price row */}
                  <div className="flex items-baseline gap-1.5 mt-1" style={monoNum}>
                    <span
                      className="font-mono font-extrabold text-[15px] leading-none"
                      style={{ color: "#EAECEF" }}
                    >
                      {fmtNum(t.price, t.price < 1 ? 4 : 2)}
                    </span>
                  </div>
                  {/* Description */}
                  <div className="text-[9px] text-[color:var(--text-mute)] mt-0.5 leading-none">
                    Average {t.side} in price USDT
                  </div>
                  {/* Date + Time UTC */}
                  <div
                    className="text-[9px] text-[color:var(--text-mute)] mt-1 leading-none"
                    style={monoNum}
                  >
                    {fmtDateUTC(t.created_at)} · {fmtTimeUTC(t.created_at).slice(0, 5)} UTC
                  </div>
                </div>

                {/* Right-side profit / amount block */}
                <div className="flex flex-col items-end shrink-0 pl-2" style={monoNum}>
                  {isSell ? (
                    <>
                      <div className="text-[8px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold leading-none">
                        Profit
                      </div>
                      <div
                        className={`font-mono font-extrabold text-[13px] leading-none mt-1 ${profitPositive ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"}`}
                        data-testid={`tx-profit-${t.id}`}
                      >
                        {profitPositive ? "+" : ""}${(t.profit || 0).toFixed(2)}
                      </div>
                      {(() => {
                        // ROI = profit / cost_basis * 100 where cost = amount - profit.
                        // Guard against garbage data (avg_price=0 stale bots) that
                        // would otherwise produce insane percentages by capping the
                        // display at ±999.99% and hiding it when cost is unreliable.
                        const profit = t.profit || 0;
                        const cost = t.amount - profit;
                        if (!t.quantity || cost <= 0.01) return null;
                        const roi = (profit / cost) * 100;
                        if (!isFinite(roi) || Math.abs(roi) > 500) return null;
                        return (
                          <div
                            className={`text-[9px] font-mono font-bold leading-none mt-0.5 ${profitPositive ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"}`}
                            data-testid={`tx-roi-${t.id}`}
                          >
                            {profitPositive ? "+" : ""}{roi.toFixed(2)}%
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <div className="text-[8px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold leading-none">
                        Amount
                      </div>
                      <div className="font-mono font-extrabold text-[13px] leading-none mt-1 text-[#EAECEF]">
                        ${fmtNum(t.amount, 2)}
                      </div>
                    </>
                  )}
                  <ChevronDown
                    size={12}
                    className={`text-[color:var(--text-mute)] mt-1.5 transition ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {isOpen && (
                <div
                  className="px-3 pb-2.5 pt-1 border-t border-[color:var(--border-soft)] bg-[color:var(--bg-base)]/40 space-y-1"
                  data-testid={`tx-detail-${t.id}`}
                  style={monoNum}
                >
                  <KV label="Date" value={fmtFullUTC(t.created_at)} />
                  <KV
                    label="Order Number"
                    value={t.binance_order_id ? String(t.binance_order_id) : t.id.slice(0, 8) + "…" + t.id.slice(-4)}
                    copyable
                  />
                  <KV label={`Filled Quantity (${shortSymbol(t.symbol)})`} value={fmtNum(t.quantity, 8)} />
                  <KV label="Deal Amount (USDT)" value={fmtUSD(t.amount)} />
                  {isSell && t.quantity > 0 && (
                    <KV
                      label="Avg Buy Price (USDT)"
                      value={`$${fmtNum((t.amount - (t.profit || 0)) / t.quantity, 6)}`}
                      valueColor="#39FF14"
                    />
                  )}
                  {isSell && (
                    <KV
                      label="Profit (USDT)"
                      value={`${profitPositive ? "+" : ""}${fmtUSD(t.profit || 0)}`}
                      valueColor={profitPositive ? "#39FF14" : "#FF007A"}
                    />
                  )}
                  <KV label="Mode" value={(t.mode || "demo").toUpperCase()} />
                  <KV label="Source" value={(t.source || "manual").toUpperCase()} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KV({ label, value, valueColor, copyable }) {
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
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-[color:var(--text-mute)]">{label} :</span>
      <span className="font-mono text-white flex-1 truncate" style={{ color: valueColor || "#fff" }}>
        {value}
      </span>
      {copyable && (
        <button
          onClick={onCopy}
          data-testid="copy-order-id"
          className="w-4 h-4 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
          aria-label="Copy"
        >
          {copied ? (
            <span className="text-[7px] font-black text-[color:var(--good)]">✓</span>
          ) : (
            <span className="text-[8px] text-[color:var(--text-mute)]">⧉</span>
          )}
        </button>
      )}
    </div>
  );
}
