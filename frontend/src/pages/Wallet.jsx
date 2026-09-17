import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownToLine, ArrowUpToLine, ArrowRightLeft, RefreshCw, Zap, Search,
  Eye, EyeOff, CalendarDays, ChevronRight, X, Send, Repeat,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtNum } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import CoinIcon from "@/components/CoinIcon";

/* Solid black icons — exact reference style (Material-filled) */
const Svg = ({ children, s }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="var(--ink)">{children}</svg>
);
const IconPeople = ({ s = 28 }) => (
  <Svg s={s}><path d="M0 18v-1.575q0-1.1 1.113-1.763Q2.225 14 4 14q.325 0 .625.012.3.013.575.063-.35.5-.525 1.075-.175.575-.175 1.225V18Zm6 0v-1.625q0-.8.437-1.463.438-.662 1.238-1.162.8-.5 1.912-.75.813-.25 2.113-.25 1.325 0 2.438.25 1.112.25 1.912.75t1.225 1.162q.425.663.425 1.463V18Zm13.5 0v-1.625q0-.65-.163-1.225-.162-.575-.487-1.075.275-.05.563-.063Q19.7 14 20 14q1.775 0 2.888.65Q24 15.3 24 16.425V18ZM4 13q-.825 0-1.412-.588Q2 11.825 2 11t.588-1.413Q3.175 9 4 9t1.412.587Q6 10.175 6 11q0 .825-.588 1.412Q4.825 13 4 13Zm16 0q-.825 0-1.413-.588Q18 11.825 18 11t.587-1.413Q19.175 9 20 9q.825 0 1.413.587Q22 10.175 22 11q0 .825-.587 1.412Q20.825 13 20 13Zm-8-1q-1.25 0-2.125-.875T9 9q0-1.25.875-2.125T12 6q1.25 0 2.125.875T15 9q0 1.25-.875 2.125T12 12Z" /></Svg>
);
const IconProfit = ({ s = 28 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24">
    <g fill="var(--ink)">
      <rect x="3" y="15" width="3.4" height="6" rx="1.2" />
      <rect x="8.6" y="11.5" width="3.4" height="9.5" rx="1.2" />
      <rect x="14.2" y="8" width="3.4" height="13" rx="1.2" />
    </g>
    <path d="M4 9C8.5 8.2 12.6 6.4 16 3.9" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    <path d="M20.6 1.4 15 2.3l3.5 3.7z" fill="var(--ink)" />
  </svg>
);
const IconCoins = ({ s = 28 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
    <ellipse cx="9.5" cy="5.6" rx="6" ry="2.4" />
    <path d="M3.5 5.6v3.4c0 1.33 2.69 2.4 6 2.4s6-1.07 6-2.4V5.6" />
    <path d="M3.5 9v3.4c0 1.33 2.69 2.4 6 2.4.53 0 1.05-.03 1.54-.08" />
    <path d="M3.5 12.4v3.2c0 1.33 2.69 2.4 6 2.4.36 0 .72-.01 1.07-.04" />
    <circle cx="16.6" cy="16.4" r="4.4" fill="var(--surface)" />
    <circle cx="16.6" cy="16.4" r="2.4" />
  </svg>
);
const IconDocPlus = ({ s = 28 }) => (
  <Svg s={s}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5.35a6.5 6.5 0 0 1-1.1-2H6V4h7v5h5v2.03c.7.04 1.37.2 2 .44V8l-6-6zM8 12h6.5c-.66.55-1.22 1.23-1.63 2H8v-2zm0 4h4.1c-.06.33-.1.66-.1 1 0 .34.04.67.1 1H8v-2zm0-8h4v2H8V8z" />
    <path d="M18 13a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm2.7 5.2h-2v2h-1.4v-2h-2v-1.4h2v-2h1.4v2h2v1.4z" />
  </Svg>
);
const IconDeposit = ({ s = 28 }) => (
  <Svg s={s}><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" /></Svg>
);
const IconWithdraw = ({ s = 28 }) => (
  <Svg s={s}><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" /></Svg>
);

const KIND_META = {
  deposit: { title: "Deposit", Icon: IconDeposit },
  deposit_onchain: { title: "Deposit", Icon: IconDeposit },
  p2p_received: { title: "Deposit", Icon: IconDeposit },
  withdraw: { title: "Withdrawal", Icon: IconWithdraw },
  withdraw_request: { title: "Withdrawal", Icon: IconWithdraw },
  withdraw_paid: { title: "Withdrawal", Icon: IconWithdraw },
  external_withdraw: { title: "Withdrawal", Icon: IconWithdraw },
  withdraw_refund: { title: "Withdrawal", Icon: IconWithdraw },
  p2p_sent: { title: "Withdrawal", Icon: IconWithdraw },
  activation: { title: "Activation Fee", Icon: IconDocPlus },
  fuel: { title: "Trading Fee", Icon: IconCoins },
  pause: { title: "Trading Fee", Icon: IconCoins },
  trading_fee: { title: "Trading Fee", Icon: IconCoins },
  trade_commission: { title: "Trading Profit", Icon: IconProfit },
  team_commission: { title: "Support Income", Icon: IconPeople },
  support_income: { title: "Support Income", Icon: IconPeople },
  direct_bonus: { title: "Support Income", Icon: IconPeople },
  revenue: { title: "Support Income", Icon: IconPeople },
  social_bonus: { title: "Support Income", Icon: IconPeople },
};

const fmtDT = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const TetherCoin = ({ s = 44 }) => (
  <svg width={s} height={s} viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="23" fill="var(--text)" />
    <circle cx="24" cy="24" r="19" fill="none" stroke="var(--bg-base)" strokeWidth="1.5" />
    <path fill="var(--bg-base)" d="M33.5 15h-19v4.3h7.3v3c-4.8.3-8.3 1.3-8.3 2.6s3.5 2.4 8.3 2.6V35h4.4v-7.5c4.7-.3 8.2-1.3 8.2-2.6s-3.5-2.4-8.2-2.6v-3h7.3V15zm-9.5 10.7c-4.2 0-7.6-.7-7.6-1.6 0-.8 2.8-1.4 6.4-1.6v2.3c.4 0 .8.1 1.2.1s.8 0 1.2-.1v-2.3c3.6.2 6.4.9 6.4 1.6 0 .9-3.4 1.6-7.6 1.6z" />
  </svg>
);

const actions = [
  { type: "deposit", label: "Deposit", icon: ArrowDownToLine, testid: "wallet-deposit", tint: "var(--primary)" },
  { type: "withdraw", label: "Withdraw", icon: ArrowUpToLine, testid: "wallet-withdraw", tint: "var(--gold)" },
  { type: "transfer", label: "Transfer", icon: ArrowRightLeft, testid: "wallet-transfer", tint: "var(--primary)" },
];

export default function Wallet() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [bind, setBind] = useState(null);
  const [live, setLive] = useState(null);
  const [liveErr, setLiveErr] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [prices, setPrices] = useState({});
  const [search, setSearch] = useState("");
  const [hideBal, setHideBal] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const isLiveMode = bind?.mode === "real" || bind?.mode === "testnet";

  const loadLive = async () => {
    setLiveLoading(true);
    setLiveErr(null);
    try {
      const { data } = await api.get("/binance/account");
      setLive(data);
      // Fetch a batch of USDT prices so we can value each asset in USDT
      try {
        const { data: pairs } = await api.get("/market/pairs?limit=200");
        const map = {};
        (pairs.pairs || []).forEach((p) => {
          map[p.symbol.replace("USDT", "")] = p.last_price;
        });
        map.USDT = 1;
        setPrices(map);
      } catch {}
    } catch (err) {
      setLiveErr(formatApiError(err));
      setLive(null);
    } finally {
      setLiveLoading(false);
    }
  };

  const load = async (retry = 2) => {
    let s = null;
    try {
      s = await api.get("/wallet/summary").then((r) => r.data);
    } catch {
      if (retry > 0) return setTimeout(() => load(retry - 1), 1500);
    }
    const [h, bd] = await Promise.all([
      api.get("/bot-wallet/transactions").then((r) => r.data).catch(() => []),
      api.get("/binance/bind").then((r) => r.data).catch(() => null),
    ]);
    if (s) setSummary(s);
    setHistory(h);
    setBind(bd);
    if (bd?.mode === "real" || bd?.mode === "testnet") {
      loadLive();
    } else {
      setLive(null);
      setLiveErr(null);
    }
  };
  useEffect(() => {
    load();
    const action = params.get("action");
    if (action === "deposit" || action === "withdraw" || action === "transfer") {
      navigate(`/bot?action=${action === "transfer" ? "p2p" : action}`, { replace: true });
    }
  }, []);

  const total = summary?.total_usdt || 0;

  return (
    <div className="pb-4 pt-4">
      {/* B&W Balance card */}
      {!isLiveMode && (
        <div className="px-4">
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--surface)",
              border: "1.5px solid color-mix(in srgb, var(--text) 80%, transparent)",
              boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
            }}
            data-testid="assets-bw-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    Total assets converted (USDT)
                  </span>
                  <button
                    onClick={() => setHideBal((v) => !v)}
                    className="p-0.5"
                    style={{ color: "var(--text)" }}
                    data-testid="assets-eye-toggle"
                  >
                    {hideBal ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span
                    className="font-display font-black text-4xl tabular-nums leading-none"
                    style={{ color: "var(--text)" }}
                    data-testid="assets-total"
                  >
                    {hideBal ? "****" : fmtNum(total, 4)}
                  </span>
                  {!hideBal && (
                    <span className="text-sm font-semibold" style={{ color: "var(--text-mute)" }}>
                      ≈ {fmtNum(total, 2)} USDT
                    </span>
                  )}
                </div>
              </div>
              <TetherCoin s={44} />
            </div>

            <div className="grid grid-cols-4 gap-2.5 mt-4">
              {[
                { t: "deposit", label: "Deposit", Icon: ArrowDownToLine, testid: "wallet-deposit" },
                { t: "withdraw", label: "Send", Icon: Send, testid: "wallet-send" },
                { t: "p2p", label: "P2P", Icon: ArrowRightLeft, testid: "wallet-p2p" },
                { t: "swap", label: "Swap", Icon: Repeat, testid: "wallet-swap" },
              ].map(({ t, label, Icon, testid }) => (
                <button
                  key={t}
                  onClick={() =>
                    t === "swap" ? toast("Swap — Coming Soon 🚀") : navigate(`/bot?action=${t}`)
                  }
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition active:scale-95"
                  style={{
                    background: "var(--surface)",
                    border: "1.5px solid color-mix(in srgb, var(--text) 80%, transparent)",
                    color: "var(--text)",
                  }}
                  data-testid={testid}
                >
                  <Icon size={20} strokeWidth={2.2} />
                  <span className="text-[12px] font-bold">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live-mode balance card */}
      {isLiveMode && (
        <div className="px-4">
          <div
            className="relative overflow-hidden rounded-xl p-5 text-white"
            style={{ background: "var(--premium-grad)", boxShadow: "var(--shadow-lg)" }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-bold">
                {summary?.wallet_connected
                  ? `Live ${bind.mode === "real" ? "Binance" : "Testnet"} Balance`
                  : `${bind.mode === "real" ? "Real" : "Testnet"} · Not Connected`}
              </div>
              <div
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                  bind.mode === "real"
                    ? "bg-[color:var(--bad)]/15 text-white border-white/40"
                    : "bg-[color:var(--gold)]/15 text-white border-white/40"
                }`}
                data-testid="wallet-mode-badge"
              >
                {bind.mode}
              </div>
            </div>
            <div className="font-display font-black text-4xl tabular-nums mt-2" data-testid="wallet-total">
              {fmtNum(summary?.total_usdt || 0, 2)}
            </div>
            {summary?.wallet_error && (
              <div
                className="mt-3 rounded-xl border border-white/30 bg-black/20 px-3 py-2 text-[11px] text-white/85 leading-snug"
                data-testid="wallet-connection-error"
              >
                <div className="text-[9px] uppercase tracking-widest text-[color:var(--warn)] font-black mb-0.5">
                  Cannot Reach Binance
                </div>
                {summary.wallet_error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Binance Balances (real/testnet) */}
      {isLiveMode && (
        <div className="px-4 mt-4">
          <div
            className={`rounded-3xl border p-5 relative overflow-hidden ${
              bind.mode === "real"
                ? "border-[color:var(--bad)]/30 bg-gradient-to-br from-[color:var(--bad)]/10 to-transparent"
                : "border-[color:var(--warn)]/30 bg-gradient-to-br from-[color:var(--gold)]/10 to-transparent"
            }`}
            data-testid="live-balances-card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap
                  size={16}
                  className={bind.mode === "real" ? "text-[color:var(--bad)]" : "text-[color:var(--warn)]"}
                />
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold">
                  Live Binance · <span className={bind.mode === "real" ? "text-[color:var(--bad)]" : "text-[color:var(--warn)]"}>{bind.mode}</span>
                </div>
              </div>
              <button
                onClick={loadLive}
                disabled={liveLoading}
                data-testid="live-refresh"
                className="w-8 h-8 rounded-lg bg-[color:var(--surface-2)] border border-[color:var(--border)] flex items-center justify-center hover:bg-[color:var(--text)]/10 disabled:opacity-50"
              >
                <RefreshCw size={14} className={liveLoading ? "animate-spin" : ""} />
              </button>
            </div>

            {liveLoading && !live && (
              <div className="text-center text-xs text-[color:var(--text-mute)] py-4" data-testid="live-loading">
                Fetching balances from Binance...
              </div>
            )}

            {liveErr && (
              <div className="bg-[color:var(--bad)]/10 border border-[color:var(--bad)]/30 rounded-xl p-3 text-xs text-[color:var(--text-soft)] leading-relaxed" data-testid="live-error">
                <div className="font-bold text-[color:var(--bad)] mb-1">Unable to load balances</div>
                {liveErr}
              </div>
            )}

            {live && live.balances && live.balances.length > 0 && (() => {
              const withValue = live.balances.map((b) => {
                const val = (b.free + b.locked) * (prices[b.asset] ?? (b.asset === "USDT" ? 1 : 0));
                return { ...b, usdt_value: val };
              });
              const total = withValue.reduce((a, b) => a + b.usdt_value, 0);
              const q = search.trim().toLowerCase();
              const filtered = withValue
                .filter((b) => (q ? b.asset.toLowerCase().includes(q) : true))
                .sort((a, b) => b.usdt_value - a.usdt_value);
              return (
                <div data-testid="live-balances-list">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[color:var(--border)]">
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">Est. Total Value</div>
                      <div className="font-display font-black text-2xl tabular-nums mt-0.5">
                        {fmtUSD(total)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">Assets</div>
                      <div className="font-display font-bold text-lg tabular-nums mt-0.5" data-testid="live-count">
                        {live.balances.length}
                      </div>
                    </div>
                  </div>

                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-mute)]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search coin..."
                      className="w-full bg-[color:var(--bg-base)] border border-[color:var(--border)] rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[color:var(--primary)] placeholder:text-[color:var(--text-mute)]"
                      data-testid="live-search"
                    />
                  </div>

                  <div className="space-y-1 max-h-[360px] overflow-y-auto">
                    {filtered.map((b) => (
                      <div
                        key={b.asset}
                        className="flex items-center justify-between py-1.5 px-1"
                        data-testid={`live-balance-${b.asset}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <CoinIcon symbol={b.asset} size={30} />
                          <div>
                            <div className="font-display font-bold text-sm">{b.asset}</div>
                            {b.locked > 0 && (
                              <div className="text-[9px] text-[color:var(--text-mute)] tabular-nums">
                                Locked: {fmtNum(b.locked, 6)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display font-bold tabular-nums text-sm">{fmtNum(b.free, 6)}</div>
                          <div className="text-[10px] text-[color:var(--text-mute)] tabular-nums">
                            ≈ {fmtUSD(b.usdt_value)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filtered.length === 0 && (
                      <div className="text-center text-xs text-[color:var(--text-mute)] py-4">
                        No coin matches &quot;{search}&quot;.
                      </div>
                    )}
                  </div>
                  {live.canTrade === false && (
                    <div className="text-[10px] text-[color:var(--bad)] mt-2">
                      ⚠️ This API key does not have trade permission.
                    </div>
                  )}
                </div>
              );
            })()}

            {live && live.balances && live.balances.length === 0 && (
              <div className="text-center text-xs text-[color:var(--text-mute)] py-4" data-testid="live-empty">
                No balances found on Binance account.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Positions removed — Assets page shows History record only (user request) */}

      {/* History record — B&W style */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-bold text-xl" style={{ color: "var(--text)" }}>
            History record
          </div>
          <label
            className="flex items-center gap-1.5 cursor-pointer relative"
            style={{ color: "var(--text)" }}
            data-testid="history-choose-date"
          >
            <CalendarDays size={18} strokeWidth={2.2} />
            <span className="text-[13px] font-semibold">
              {filterDate
                ? new Date(filterDate + "T00:00:00").toLocaleDateString()
                : "Choose date"}
            </span>
            {filterDate ? (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFilterDate(""); }}
                className="p-1 relative z-10"
                data-testid="history-clear-date"
              >
                <X size={14} />
              </button>
            ) : (
              <ChevronRight size={16} style={{ color: "var(--text-mute)" }} />
            )}
            {!filterDate && (
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                data-testid="history-date-input"
              />
            )}
          </label>
        </div>

        {(() => {
          const rows = filterDate
            ? history.filter((h) => {
                const d = new Date(h.created_at);
                const f = new Date(filterDate + "T00:00:00");
                return d.getFullYear() === f.getFullYear() && d.getMonth() === f.getMonth() && d.getDate() === f.getDate();
              })
            : history;
          if (rows.length === 0)
            return (
              <div
                className="text-center text-sm py-8 rounded-2xl"
                style={{
                  color: "var(--text-mute)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
                data-testid="empty-history"
              >
                {filterDate ? "No activity on this date" : "No wallet activity yet"}
              </div>
            );
          return (
            <div className="space-y-1.5" data-testid="history-list">
              {rows.map((h) => {
                const meta = KIND_META[h.kind] || { title: (h.kind || h.type || "").replace(/_/g, " "), Icon: IconCoins };
                const isOut = (h.amount ?? 0) < 0;
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                    }}
                    data-testid={`history-row-${h.kind}`}
                  >
                    <div className="shrink-0"><meta.Icon s={30} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-black capitalize truncate leading-tight" style={{ color: "var(--ink)" }}>
                        {meta.title}
                      </div>
                      <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: "var(--text-mute)" }}>
                        {fmtDT(h.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="text-[13px] font-bold tabular-nums"
                        style={{ color: isOut ? "var(--bad)" : "var(--good)" }}
                      >
                        {isOut ? "-" : ""}{fmtNum(Math.abs(h.amount ?? 0), 4)} USDT
                      </span>
                      <ChevronRight size={16} strokeWidth={2.4} style={{ color: "var(--ink)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Modal removed — unified wallet actions live on /bot */}
    </div>
  );
}
