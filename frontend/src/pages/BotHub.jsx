import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Wallet as WalletIcon,
  Zap,
  ArrowDownToLine,
  ArrowUpToLine,
  ArrowRightLeft,
  History,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  X,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const HERO_IMAGE =
  "https://customer-assets.emergentagent.com/job_tgx-api-gateway/artifacts/v63grioq_file_000000003580720b84b6c5daae428f49.png";

const TRACES = [
  { d: "M 40,42 L 30,52 L 18,58", delay: "0s" },
  { d: "M 60,42 L 70,52 L 82,58", delay: "0.5s" },
  { d: "M 45,44 L 42,58 L 30,66", delay: "1.0s" },
  { d: "M 55,44 L 58,58 L 70,66", delay: "1.5s" },
  { d: "M 50,44 L 50,60 L 50,68", delay: "0.7s" },
];

export default function BotHub() {
  const { refresh } = useAuth();
  const [status, setStatus] = useState(null);
  const [modal, setModal] = useState(null); // 'activate' | 'deposit' | 'withdraw' | 'info' | null
  const [amount, setAmount] = useState("");
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(""); // YYYY-MM-DD, empty = all

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await api.get("/bot-wallet/status");
      setStatus(data);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, []);

  const loadTxns = useCallback(async () => {
    try {
      const { data } = await api.get("/bot-wallet/transactions");
      setTxns(data || []);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadTxns();
  }, [loadStatus, loadTxns]);

  const closeModal = () => {
    setModal(null);
    setAmount("");
  };

  const doActivate = async () => {
    setLoading(true);
    try {
      await api.post("/bot-wallet/activate");
      toast.success(`Bot activated! $${status?.activation_fee} fee paid.`);
      await loadStatus();
      await loadTxns();
      await refresh?.();
      closeModal();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const doDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setLoading(true);
    try {
      await api.post("/bot-wallet/deposit", { amount: amt });
      toast.success(`Deposited $${amt.toFixed(2)} to Bot Wallet`);
      await loadStatus();
      await loadTxns();
      await refresh?.();
      closeModal();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const doWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setLoading(true);
    try {
      await api.post("/bot-wallet/withdraw", { amount: amt });
      toast.success(`Withdrew $${amt.toFixed(2)} to Main Wallet`);
      await loadStatus();
      await loadTxns();
      await refresh?.();
      closeModal();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const activated = !!status?.activated;
  const balance = status?.balance ?? 0;
  const mainBal = status?.main_wallet_usdt ?? 0;
  const feePct = status?.trading_fee_pct ?? 20;
  const actFee = status?.activation_fee ?? 70;

  // Filter txns by selected date (YYYY-MM-DD compare against ISO date prefix)
  const visibleTxns = useMemo(() => {
    if (!filterDate) return txns;
    return txns.filter((t) => (t.created_at || "").slice(0, 10) === filterDate);
  }, [txns, filterDate]);

  return (
    <div className="pb-40" data-testid="bothub-page">
      <PageHeader title="Welcome to TGX BOT" subtitle="AI Powered Exchange" showBack={false} />

      {/* Hero image with animated overlays */}
      <div className="px-4 mt-2">
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-[#39FF14]/25"
          style={{
            boxShadow: "0 0 30px rgba(57,255,20,0.15), inset 0 0 20px rgba(0,0,0,0.4)",
          }}
          data-testid="bothub-hero"
        >
          <img
            src={HERO_IMAGE}
            alt="TGX BOT — AI Powered Exchange"
            className="w-full h-auto block select-none"
            loading="eager"
            draggable={false}
          />
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="tgxTraceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF3B3B" stopOpacity="0" />
                <stop offset="45%" stopColor="#FF3B3B" stopOpacity="0.9" />
                <stop offset="55%" stopColor="#39FF14" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#39FF14" stopOpacity="0" />
              </linearGradient>
            </defs>
            {TRACES.map((tr, i) => (
              <path
                key={i}
                d={tr.d}
                stroke="url(#tgxTraceGrad)"
                strokeWidth="0.4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="8 92"
                className="tgx-trace"
                style={{ animationDelay: tr.delay }}
              />
            ))}
          </svg>
          <span className="tgx-fan-glow" data-testid="fan-glow" />
        </div>
      </div>

      {/* ========== BOT WALLET SECTION ========== */}
      <div className="px-4 mt-6" data-testid="bot-wallet-section">
        {/* Activation status — thin, centered */}
        <div
          className={`rounded-xl border px-4 py-2.5 mb-3 ${
            activated
              ? "bg-[#39FF14]/5 border-[#39FF14]/40"
              : "bg-[#FF3B3B]/5 border-[#FF3B3B]/40"
          }`}
          data-testid="bot-activation-banner"
        >
          <div className="flex items-center justify-center gap-2">
            {activated ? (
              <CheckCircle2 size={16} className="text-[#39FF14]" style={{ filter: "drop-shadow(0 0 6px rgba(57,255,20,0.6))" }} />
            ) : (
              <Lock size={16} className="text-[#FF3B3B]" style={{ filter: "drop-shadow(0 0 6px rgba(255,59,59,0.6))" }} />
            )}
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#8B9BB4]">Bot Status</span>
            <span
              className={`text-sm font-bold tracking-wider ${activated ? "text-[#39FF14]" : "text-[#FF3B3B]"}`}
              data-testid="bot-status-text"
            >
              {activated ? "ACTIVE" : "DEACTIVATE"}
            </span>
          </div>
          {!activated && (
            <button
              onClick={() => setModal("activate")}
              className="mt-2 w-full py-2 rounded-md text-xs font-bold bg-[#39FF14] text-black hover:bg-[#39FF14]/90 transition"
              data-testid="btn-open-activate"
            >
              ACTIVATE • ${actFee}
            </button>
          )}
        </div>

        {/* Balance card — thin, balance only */}
        <div
          className="rounded-xl border border-[#00F0FF]/30 bg-gradient-to-br from-[#00F0FF]/5 to-[#39FF14]/5 px-4 py-2.5 mb-3"
          style={{ boxShadow: "0 0 16px rgba(0,240,255,0.06)" }}
          data-testid="bot-wallet-balance-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WalletIcon size={14} className="text-[#00F0FF]" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-[#8B9BB4]">Wallet Balance</span>
            </div>
            <div className="text-xl font-bold text-white tabular-nums" data-testid="bot-wallet-balance">
              {fmtUSD(balance)}
            </div>
          </div>
          {activated && balance <= 0 && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[#FF3B3B]">
              <AlertTriangle size={12} />
              <span>Balance is zero — bots are paused. Deposit to resume.</span>
            </div>
          )}
        </div>

        {/* Actions row — thin inline buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            disabled={!activated}
            onClick={() => setModal("deposit")}
            className="rounded-lg border border-[#39FF14]/30 bg-[#39FF14]/5 py-2 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#39FF14]/10 transition"
            data-testid="btn-open-deposit"
          >
            <ArrowDownToLine size={14} className="text-[#39FF14]" />
            <span className="text-[11px] font-semibold text-white">Deposit</span>
          </button>
          <button
            disabled={!activated || balance <= 0}
            onClick={() => setModal("withdraw")}
            className="rounded-lg border border-[#FF007A]/30 bg-[#FF007A]/5 py-2 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FF007A]/10 transition"
            data-testid="btn-open-withdraw"
          >
            <ArrowUpToLine size={14} className="text-[#FF007A]" />
            <span className="text-[11px] font-semibold text-white">Withdraw</span>
          </button>
          <button
            onClick={() => toast.info("P2P coming soon")}
            className="rounded-lg border border-[#FFD700]/30 bg-[#FFD700]/5 py-2 flex items-center justify-center gap-1.5 hover:bg-[#FFD700]/10 transition"
            data-testid="btn-open-p2p"
          >
            <ArrowRightLeft size={14} className="text-[#FFD700]" />
            <span className="text-[11px] font-semibold text-white">P2P</span>
          </button>
        </div>

        {/* How it works — thin card, tap ⓘ to see conditions */}
        <button
          onClick={() => setModal("info")}
          className="mt-4 w-full flex items-center justify-between rounded-xl border border-white/10 bg-[#0B1220]/60 px-4 py-2.5 hover:border-[#00F0FF]/30 transition"
          data-testid="bot-wallet-info"
        >
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-[#00F0FF]" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#8B9BB4]">How it works</span>
          </div>
          <Info
            size={18}
            className="text-[#00F0FF]"
            style={{ filter: "drop-shadow(0 0 4px rgba(0,240,255,0.6))" }}
            data-testid="btn-open-info"
          />
        </button>

        {/* ===== History section (Choose Date filter + inline list) ===== */}
        <div
          className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-[#0B1220]/60 px-4 py-2.5"
          data-testid="bot-history-filter"
        >
          <div className="flex items-center gap-2">
            <History size={12} className="text-[#FFD700]" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#8B9BB4]">History Record</span>
          </div>
          <label className="relative flex items-center gap-1 cursor-pointer text-[11px] text-[#00F0FF] font-semibold">
            <Calendar size={12} />
            <span>{filterDate || "Choose Date"}</span>
            {filterDate && (
              <button
                onClick={(e) => { e.preventDefault(); setFilterDate(""); }}
                className="ml-1 text-[#8B9BB4] hover:text-white"
                data-testid="btn-clear-date"
              >
                <X size={11} />
              </button>
            )}
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              data-testid="input-history-date"
            />
          </label>
        </div>

        <div className="mt-2 space-y-1.5" data-testid="bot-history-list">
          {visibleTxns.length === 0 ? (
            <div className="text-center text-[11px] text-[#8B9BB4] py-3 rounded-lg border border-white/5 bg-[#0B1220]/40">
              {filterDate ? "No transactions on this date." : "No transactions yet."}
            </div>
          ) : (
            visibleTxns.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#0B1220]/70 border border-white/5"
                data-testid="bot-txn-row"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white uppercase tracking-wide leading-tight">
                    {t.kind.replace("_", " ")}
                  </div>
                  <div className="text-[9px] text-[#8B9BB4] leading-tight">{fmtTime(t.created_at)}</div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div
                    className={`text-[12px] font-bold leading-tight ${
                      t.amount > 0 ? "text-[#39FF14]" : t.amount < 0 ? "text-[#FF3B3B]" : "text-[#8B9BB4]"
                    }`}
                  >
                    {t.amount > 0 ? "+" : ""}
                    {fmtUSD(t.amount)}
                  </div>
                  {t.balance_after != null && (
                    <div className="text-[9px] text-[#8B9BB4] leading-tight">Bal: {fmtUSD(t.balance_after)}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========== INFO DIALOG (Conditions) ========== */}
      {modal === "info" && (
        <ModalShell title="How it works" onClose={closeModal} testid="dialog-info">
          <ul className="text-[13px] text-[#B8C4D8] leading-relaxed space-y-2.5 list-disc pl-5">
            <li>Pay one-time <span className="text-white font-semibold">${actFee}</span> to activate the trading bot.</li>
            <li>Pre-fund your Wallet — fees are auto-deducted from here, never from your Binance funds.</li>
            <li>Every profitable SELL deducts <span className="text-[#FFD700] font-semibold">{feePct}%</span> of the profit.</li>
            <li>If balance hits <span className="text-[#FF3B3B] font-semibold">$0</span>, bots pause automatically until you deposit again.</li>
          </ul>
          <button
            onClick={closeModal}
            className="mt-5 w-full py-3 rounded-lg bg-[#00F0FF]/15 text-[#00F0FF] font-semibold text-sm border border-[#00F0FF]/30"
            data-testid="btn-close-info"
          >
            Got it
          </button>
        </ModalShell>
      )}

      {/* ========== ACTIVATE DIALOG ========== */}
      {modal === "activate" && (
        <ModalShell title="Activate Bot" onClose={closeModal} testid="dialog-activate">
          <div className="flex flex-col items-center py-2">
            <div className="w-16 h-16 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/40 flex items-center justify-center mb-3"
                 style={{ boxShadow: "0 0 24px rgba(57,255,20,0.25)" }}>
              <Zap size={32} className="text-[#39FF14]" />
            </div>
            <div className="text-sm text-[#8B9BB4]">One-time Activation Fee</div>
            <div className="text-4xl font-bold text-white mt-1">${actFee}</div>
            <p className="text-xs text-[#8B9BB4] text-center mt-3 leading-relaxed">
              This fee will be deducted from your <span className="text-white">Main Wallet</span> (${fmtUSD(mainBal).replace("$","")}).
              After activation, you can deposit funds to your Bot Wallet and start trading.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={closeModal}
              className="flex-1 py-3 rounded-lg border border-white/10 text-white/70 text-sm"
              data-testid="btn-cancel-activate"
            >
              Cancel
            </button>
            <button
              onClick={doActivate}
              disabled={loading || mainBal < actFee}
              className="flex-1 py-3 rounded-lg bg-[#39FF14] text-black font-bold text-sm disabled:opacity-40"
              data-testid="btn-confirm-activate"
            >
              {loading ? "Processing..." : `Pay $${actFee}`}
            </button>
          </div>
          {mainBal < actFee && (
            <p className="text-xs text-[#FF3B3B] text-center mt-2">Insufficient main wallet balance.</p>
          )}
        </ModalShell>
      )}

      {/* ========== DEPOSIT DIALOG ========== */}
      {modal === "deposit" && (
        <ModalShell title="Deposit to Wallet" onClose={closeModal} testid="dialog-deposit">
          <div className="text-xs text-[#8B9BB4] mb-2">
            From Main Wallet ({fmtUSD(mainBal)}) → Wallet
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in USDT"
            className="w-full px-4 py-3 rounded-lg bg-[#0B1220] border border-white/10 text-white text-lg font-semibold focus:border-[#39FF14] outline-none"
            data-testid="input-deposit-amount"
          />
          <div className="flex gap-2 mt-2">
            {[50, 100, 500, 1000].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="flex-1 py-1.5 text-xs rounded-md border border-white/10 text-[#B8C4D8] hover:border-[#39FF14]/40"
              >
                ${v}
              </button>
            ))}
          </div>
          <button
            onClick={doDeposit}
            disabled={loading}
            className="mt-4 w-full py-3 rounded-lg bg-[#39FF14] text-black font-bold text-sm disabled:opacity-40"
            data-testid="btn-confirm-deposit"
          >
            {loading ? "Processing..." : "Confirm Deposit"}
          </button>
        </ModalShell>
      )}

      {/* ========== WITHDRAW DIALOG ========== */}
      {modal === "withdraw" && (
        <ModalShell title="Withdraw from Wallet" onClose={closeModal} testid="dialog-withdraw">
          <div className="text-xs text-[#8B9BB4] mb-2">
            Wallet ({fmtUSD(balance)}) → Main Wallet
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in USDT"
            className="w-full px-4 py-3 rounded-lg bg-[#0B1220] border border-white/10 text-white text-lg font-semibold focus:border-[#FF007A] outline-none"
            data-testid="input-withdraw-amount"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setAmount(String(balance))}
              className="flex-1 py-1.5 text-xs rounded-md border border-white/10 text-[#B8C4D8] hover:border-[#FF007A]/40"
            >
              Max ({fmtUSD(balance)})
            </button>
          </div>
          <button
            onClick={doWithdraw}
            disabled={loading}
            className="mt-4 w-full py-3 rounded-lg bg-[#FF007A] text-white font-bold text-sm disabled:opacity-40"
            data-testid="btn-confirm-withdraw"
          >
            {loading ? "Processing..." : "Confirm Withdraw"}
          </button>
        </ModalShell>
      )}

      {/* ========== HISTORY inline above — modal removed ========== */}
    </div>
  );
}

function ModalShell({ title, children, onClose, testid }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
      data-testid={testid}
    >
      <div
        className="w-full max-w-[440px] bg-[#0F1524] border border-[#00F0FF]/25 rounded-2xl p-5"
        style={{ boxShadow: "0 0 30px rgba(0,240,255,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-white">{title}</div>
          <button onClick={onClose} className="text-[#8B9BB4] hover:text-white" data-testid="btn-close-dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
