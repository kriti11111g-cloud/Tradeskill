import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpToLine, ArrowRightLeft, RefreshCw, Zap, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtNum, fmtTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import CoinIcon from "@/components/CoinIcon";

const actions = [
  { type: "deposit", label: "Deposit", icon: ArrowDownToLine, color: "#39FF14", testid: "wallet-deposit" },
  { type: "withdraw", label: "Withdraw", icon: ArrowUpToLine, color: "#FF007A", testid: "wallet-withdraw" },
  { type: "transfer", label: "Transfer", icon: ArrowRightLeft, color: "#FFD700", testid: "wallet-transfer" },
];

export default function Wallet() {
  const { refresh } = useAuth();
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState("");
  const [bind, setBind] = useState(null);
  const [live, setLive] = useState(null);
  const [liveErr, setLiveErr] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [prices, setPrices] = useState({});
  const [search, setSearch] = useState("");

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

  const load = async () => {
    const [s, h, bd] = await Promise.all([
      api.get("/wallet/summary").then((r) => r.data),
      api.get("/wallet/history").then((r) => r.data),
      api.get("/binance/bind").then((r) => r.data).catch(() => null),
    ]);
    setSummary(s);
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
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/wallet/transaction", { type: modal, amount: parseFloat(amount), asset: "USDT" });
      toast.success(`${modal} · ${fmtUSD(amount)} processed`);
      setModal(null);
      setAmount("");
      load();
      refresh();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="pb-4">
      <PageHeader title="Assets" subtitle="Wallet · Portfolio" />

      {/* Balance card */}
      <div className="px-4">
        <div
          className="relative overflow-hidden rounded-3xl border border-[color:var(--border)] p-6"
          style={{
            background: "linear-gradient(135deg, rgba(0,240,255,0.12), rgba(255,215,0,0.08)), #0F1524",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--text-mute)] font-bold">
              {isLiveMode
                ? summary?.wallet_connected
                  ? `Live ${bind.mode === "real" ? "Binance" : "Testnet"} Balance`
                  : `${bind.mode === "real" ? "Real" : "Testnet"} · Not Connected`
                : "Total Assets (USDT)"}
            </div>
            {isLiveMode && (
              <div
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                  bind.mode === "real"
                    ? "bg-[#FF007A]/15 text-[color:var(--bad)] border-[color:var(--bad)]/40"
                    : "bg-[#FFD700]/15 text-[color:var(--warn)] border-[color:var(--warn)]/40"
                }`}
                data-testid="wallet-mode-badge"
              >
                {bind.mode}
              </div>
            )}
          </div>
          <div className="font-display font-black text-4xl tabular-nums mt-2" data-testid="wallet-total">
            {fmtNum(summary?.total_usdt || 0, 2)}
          </div>
          {/* Wallet connection error banner (real/testnet mode, Binance unreachable) */}
          {isLiveMode && summary?.wallet_error && (
            <div
              className="mt-3 rounded-xl border border-[color:var(--warn)]/40 bg-[#FFD700]/10 px-3 py-2 text-[11px] text-white/85 leading-snug"
              data-testid="wallet-connection-error"
            >
              <div className="text-[9px] uppercase tracking-widest text-[color:var(--warn)] font-black mb-0.5">
                Cannot Reach Binance
              </div>
              {summary.wallet_error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">Available USDT</div>
              <div className="font-display font-bold text-lg tabular-nums mt-0.5">
                {fmtNum(summary?.wallet_usdt || 0, 2)}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">In Positions</div>
              <div className="font-display font-bold text-lg tabular-nums mt-0.5 text-[color:var(--primary)]">
                {fmtNum(summary?.positions_value_usdt || 0, 2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Binance Balances (real/testnet) */}
      {isLiveMode && (
        <div className="px-4 mt-4">
          <div
            className={`rounded-3xl border p-5 relative overflow-hidden ${
              bind.mode === "real"
                ? "border-[color:var(--bad)]/30 bg-gradient-to-br from-[#FF007A]/10 to-transparent"
                : "border-[color:var(--warn)]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent"
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
                className="w-8 h-8 rounded-lg bg-white/5 border border-[color:var(--border)] flex items-center justify-center hover:bg-white/10 disabled:opacity-50"
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
              <div className="bg-[#FF007A]/10 border border-[color:var(--bad)]/30 rounded-xl p-3 text-xs text-white/90 leading-relaxed" data-testid="live-error">
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

      {/* Actions */}
      <div className="grid grid-cols-3 gap-3 px-4 mt-4">
        {actions.map((a) => (
          <button
            key={a.type}
            onClick={() => setModal(a.type)}
            data-testid={a.testid}
            className="flex flex-col items-center gap-2 py-4 bg-[color:var(--surface)]/60 backdrop-blur-xl border border-[color:var(--border)] rounded-2xl hover:border-[color:var(--primary)]/30 transition"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: `${a.color}15`, boxShadow: `inset 0 0 20px ${a.color}22` }}
            >
              <a.icon size={20} strokeWidth={1.8} style={{ color: a.color }} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Positions */}
      {summary?.positions?.length > 0 && (
        <div className="px-4 mt-5">
          <div className="font-display font-bold text-lg mb-3">Open Positions</div>
          <div className="space-y-2">
            {summary.positions.map((p) => (
              <div
                key={p.symbol}
                className="bg-[color:var(--surface)]/60 backdrop-blur-xl border border-[color:var(--border)] rounded-2xl p-3 flex items-center justify-between"
                data-testid={`position-${p.symbol}`}
              >
                <div>
                  <div className="font-display font-bold text-sm">{p.symbol.replace("USDT", "/USDT")}</div>
                  <div className="text-[10px] text-[color:var(--text-mute)] mt-0.5 tabular-nums">
                    {fmtNum(p.qty, 6)} @ {fmtNum(p.avg_price, 4)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold tabular-nums text-sm">{fmtUSD(p.value)}</div>
                  <div className={`text-[11px] tabular-nums ${p.pnl >= 0 ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"}`}>
                    {p.pnl >= 0 ? "+" : ""}
                    {fmtUSD(p.pnl)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="px-4 mt-5">
        <div className="font-display font-bold text-lg mb-3">History</div>
        {history.length === 0 && (
          <div className="text-center text-sm text-[color:var(--text-mute)] py-8" data-testid="empty-history">
            No wallet activity yet
          </div>
        )}
        <div className="space-y-2">
          {history.map((h) => (
            <div
              key={h.id}
              className="bg-[color:var(--surface)]/60 backdrop-blur-xl border border-[color:var(--border)] rounded-2xl p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-display font-bold text-sm capitalize">{h.type}</div>
                <div className="text-[10px] text-[color:var(--text-mute)] mt-0.5">{fmtTime(h.created_at)}</div>
              </div>
              <div className="text-right">
                <div
                  className={`font-display font-bold text-sm tabular-nums ${
                    h.type === "deposit" ? "text-[color:var(--good)]" : h.type === "withdraw" ? "text-[color:var(--bad)]" : "text-white"
                  }`}
                >
                  {h.type === "withdraw" ? "-" : "+"}
                  {fmtUSD(h.amount)}
                </div>
                <div className="text-[10px] text-[color:var(--text-mute)]">Bal {fmtUSD(h.balance_after)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md bg-[color:var(--surface)] border border-[color:var(--border)] rounded-t-3xl sm:rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display font-bold text-xl capitalize mb-4">{modal}</div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-bold">Amount (USDT)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1.5 bg-[color:var(--bg-base)] border border-[color:var(--border)] rounded-xl px-4 py-3 font-display font-bold text-xl tabular-nums focus:outline-none focus:border-[color:var(--primary)]"
                  data-testid="wallet-amount-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="py-3 rounded-xl bg-white/5 border border-[color:var(--border)] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-3 rounded-xl bg-[#00F0FF] text-[#050914] font-display font-bold"
                  data-testid="wallet-submit"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
