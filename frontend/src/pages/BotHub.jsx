import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  QrCode,
  Users,
  Trophy,
  Copy,
  X,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
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
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [modal, setModal] = useState(null); // 'activate' | 'deposit' | 'withdraw' | 'p2p' | 'info' | null
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("BEP20");
  const [recipient, setRecipient] = useState("");
  const [p2pMode, setP2pMode] = useState("email"); // 'email' | 'address'
  const [depositTab, setDepositTab] = useState("crypto"); // 'crypto' | 'main'
  const [depNet, setDepNet] = useState("BEP20");
  const [depositInfo, setDepositInfo] = useState(null);
  const [password, setPassword] = useState("");
  const [withdrawals, setWithdrawals] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(""); // YYYY-MM-DD, empty = all
  const qrRef = useRef(null);
  const qrScannerRef = useRef(null);

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

  const loadWithdrawals = useCallback(async () => {
    try {
      const { data } = await api.get("/bot-wallet/withdrawals");
      setWithdrawals(data || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadTxns();
    loadWithdrawals();
  }, [loadStatus, loadTxns, loadWithdrawals]);

  useEffect(() => {
    if (modal === "deposit" && !depositInfo) {
      api.get("/bot-wallet/deposit-address")
        .then(({ data }) => setDepositInfo(data))
        .catch(() => toast.error("Could not load deposit address"));
    }
  }, [modal, depositInfo]);

  const closeModal = () => {
    stopScan();
    setModal(null);
    setAmount("");
    setAddress("");
    setNetwork("BEP20");
    setRecipient("");
    setP2pMode("email");
    setPassword("");
    setDepositTab("crypto");
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

  const stopScan = useCallback(async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
        await qrScannerRef.current.clear();
      } catch {
        /* ignore */
      }
      qrScannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScan = async () => {
    setScanning(true);
    // wait a tick for the DOM node to mount
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            setAddress(decoded);
            toast.success("Address scanned");
            stopScan();
          },
          () => {},
        );
      } catch (e) {
        toast.error("Camera access denied");
        setScanning(false);
      }
    }, 80);
  };

  const doWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (address && !password) return toast.error("Enter your login password to confirm");
    setLoading(true);
    try {
      await api.post("/bot-wallet/withdraw", {
        amount: amt,
        address: address || null,
        network: address ? network : null,
        password: address ? password : null,
      });
      toast.success(
        address
          ? "Withdrawal request submitted — pending admin approval"
          : `Withdrew $${amt.toFixed(2)} to Main Wallet`,
      );
      await loadStatus();
      await loadTxns();
      await loadWithdrawals();
      await refresh?.();
      closeModal();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const cancelWithdrawal = async (id) => {
    try {
      await api.post(`/bot-wallet/withdrawals/${id}/cancel`);
      toast.success("Withdrawal cancelled — amount refunded");
      await loadStatus();
      await loadTxns();
      await loadWithdrawals();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const doP2P = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const isAddressMode = p2pMode === "address";
    if (isAddressMode) {
      if (!address.trim()) return toast.error("Paste or scan an address");
    } else if (!recipient.trim()) {
      return toast.error("Enter recipient email");
    }
    setLoading(true);
    try {
      const payload = isAddressMode
        ? { recipient_address: address.trim(), amount: amt }
        : { recipient_email: recipient.trim(), amount: amt };
      const { data } = await api.post("/bot-wallet/p2p", payload);
      toast.success(
        isAddressMode
          ? `Sent $${amt.toFixed(2)} to ${address.slice(0, 8)}…`
          : `Sent $${amt.toFixed(2)} to ${data.recipient}`,
      );
      await loadStatus();
      await loadTxns();
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
  const feePct = status?.trading_fee_pct ?? 25;
  const actFee = status?.activation_fee ?? 70;
  const minFuel = status?.min_fuel_balance ?? 10;
  const lowFuel = activated && balance < minFuel;

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
          className="relative w-full overflow-hidden rounded-2xl border border-[color:var(--good)]/25"
          style={{
            boxShadow: "0 0 30px rgba(22,163,74,0.15), inset 0 0 20px rgba(0,0,0,0.4)",
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
                <stop offset="0%" stopColor="#F87171" stopOpacity="0" />
                <stop offset="45%" stopColor="#F87171" stopOpacity="0.9" />
                <stop offset="55%" stopColor="var(--good)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="var(--good)" stopOpacity="0" />
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
        {/* Rank quick access */}
        <button
          onClick={() => navigate("/rank")}
          className="w-full flex items-center justify-between rounded-xl border border-[color:var(--warn)]/30 bg-gradient-to-r from-[color:var(--gold)]/10 to-transparent px-4 py-2.5 mb-3 hover:border-[color:var(--warn)]/50 transition"
          data-testid="btn-open-rank"
        >
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-[color:var(--warn)]" style={{ filter: "drop-shadow(0 0 6px var(--gold-glow))" }} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--text)]">
              Rank Levels
            </span>
            <span className="text-[10px] text-[color:var(--text-mute)]">· 1 STAR → 10 STAR</span>
          </div>
          <span className="text-[color:var(--warn)] text-lg">›</span>
        </button>

        {/* Activation status — thin, centered */}
        <div
          className={`rounded-xl border px-4 py-2.5 mb-3 ${
            activated
              ? "bg-[color:var(--good)]/5 border-[color:var(--good)]/40"
              : "bg-[color:var(--bad)]/5 border-[color:var(--bad)]/40"
          }`}
          data-testid="bot-activation-banner"
        >
          <div className="flex items-center justify-center gap-2">
            {activated ? (
              <CheckCircle2 size={16} className="text-[color:var(--good)]" style={{ filter: "drop-shadow(0 0 6px rgba(22,163,74,0.6))" }} />
            ) : (
              <Lock size={16} className="text-[color:var(--bad)]" style={{ filter: "drop-shadow(0 0 6px rgba(248,113,113,0.6))" }} />
            )}
            <span className="text-[10px] tracking-[0.3em] uppercase text-[color:var(--text-mute)]">Bot Status</span>
            <span
              className={`text-sm font-bold tracking-wider ${activated ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"}`}
              data-testid="bot-status-text"
            >
              {activated ? "ACTIVE" : "DEACTIVATE"}
            </span>
          </div>
          {!activated && (
            <button
              onClick={() => setModal("activate")}
              className="mt-2 w-full py-2 rounded-md text-xs font-bold bg-[color:var(--good)] text-black hover:bg-[color:var(--good)]/90 transition"
              data-testid="btn-open-activate"
            >
              ACTIVATE • ${actFee}
            </button>
          )}
        </div>

        {/* Balance card — thin, balance only */}
        <div
          className="rounded-xl border border-[color:var(--primary)]/30 bg-gradient-to-br from-[color:var(--primary)]/5 to-[#16A34A]/5 px-4 py-2.5 mb-3"
          style={{ boxShadow: "0 0 16px rgba(22,163,74,0.06)" }}
          data-testid="bot-wallet-balance-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WalletIcon size={14} className="text-[color:var(--primary)]" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-[color:var(--text-mute)]">Wallet Balance</span>
            </div>
            <div className="text-xl font-bold text-[color:var(--text)] tabular-nums" data-testid="bot-wallet-balance">
              {fmtUSD(balance)}
            </div>
          </div>
          {lowFuel && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--bad)]">
              <AlertTriangle size={12} />
              <span>Fuel below ${minFuel} — bots paused. Deposit to resume.</span>
            </div>
          )}
        </div>

        {/* Actions row — thin inline buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            disabled={!activated}
            onClick={() => setModal("deposit")}
            className="rounded-lg border border-[color:var(--good)]/30 bg-[color:var(--good)]/5 py-2 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[color:var(--good)]/10 transition"
            data-testid="btn-open-deposit"
          >
            <ArrowDownToLine size={14} className="text-[color:var(--good)]" />
            <span className="text-[11px] font-semibold text-[color:var(--text)]">Deposit</span>
          </button>
          <button
            disabled={!activated || balance <= 0}
            onClick={() => setModal("withdraw")}
            className="rounded-lg border border-[color:var(--bad)]/30 bg-[color:var(--bad)]/5 py-2 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[color:var(--bad)]/10 transition"
            data-testid="btn-open-withdraw"
          >
            <ArrowUpToLine size={14} className="text-[color:var(--bad)]" />
            <span className="text-[11px] font-semibold text-[color:var(--text)]">Withdraw</span>
          </button>
          <button
            onClick={() => setModal("p2p")}
            disabled={!activated || balance <= 0}
            className="rounded-lg border border-[color:var(--warn)]/30 bg-[color:var(--gold)]/5 py-2 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[color:var(--gold)]/10 transition"
            data-testid="btn-open-p2p"
          >
            <ArrowRightLeft size={14} className="text-[color:var(--warn)]" />
            <span className="text-[11px] font-semibold text-[color:var(--text)]">P2P</span>
          </button>
        </div>

        {/* Withdrawal requests */}
        {withdrawals.length > 0 && (
          <div className="mt-4" data-testid="withdrawal-requests-section">
            <div className="text-[10px] tracking-[0.3em] uppercase text-[color:var(--text-mute)] mb-2 px-1">
              Withdrawal Requests
            </div>
            <div className="space-y-1.5">
              {withdrawals.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)]/70 px-3 py-2"
                  data-testid="withdrawal-request-row"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[color:var(--text)]">
                        {fmtUSD(r.amount)} · {r.network}
                      </div>
                      <div className="text-[9px] text-[color:var(--text-mute)]">
                        {r.address.slice(0, 10)}…{r.address.slice(-6)} · {fmtTime(r.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          r.status === "pending"
                            ? "bg-[color:var(--gold)]/15 text-[color:var(--warn)]"
                            : r.status === "completed"
                            ? "bg-[color:var(--good)]/15 text-[color:var(--good)]"
                            : "bg-[color:var(--bad)]/15 text-[color:var(--bad)]"
                        }`}
                        data-testid="withdrawal-status"
                      >
                        {r.status}
                      </span>
                      {r.status === "pending" && (
                        <button
                          onClick={() => cancelWithdrawal(r.id)}
                          className="text-[9px] font-semibold text-[color:var(--bad)] border border-[color:var(--bad)]/40 rounded-md px-2 py-0.5"
                          data-testid="btn-cancel-withdrawal"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  {r.tx_hash && (
                    <div className="text-[9px] font-mono text-[color:var(--text-mute)] mt-1 truncate">
                      tx: {r.tx_hash}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works — thin card, tap ⓘ to see conditions */}
        <button
          onClick={() => setModal("info")}
          className="mt-4 w-full flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] bg-[var(--surface)]/60 px-4 py-2.5 hover:border-[color:var(--primary)]/30 transition"
          data-testid="bot-wallet-info"
        >
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-[color:var(--primary)]" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-[color:var(--text-mute)]">How it works</span>
          </div>
          <Info
            size={18}
            className="text-[color:var(--primary)]"
            style={{ filter: "drop-shadow(0 0 4px rgba(22,163,74,0.6))" }}
            data-testid="btn-open-info"
          />
        </button>

        {/* ===== History section (Choose Date filter + inline list) ===== */}
        <div
          className="mt-4 flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] bg-[var(--surface)]/60 px-4 py-2.5"
          data-testid="bot-history-filter"
        >
          <div className="flex items-center gap-2">
            <History size={12} className="text-[color:var(--warn)]" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-[color:var(--text-mute)]">History Record</span>
          </div>
          <label className="relative flex items-center gap-1 cursor-pointer text-[11px] text-[color:var(--primary)] font-semibold">
            <Calendar size={12} />
            <span>{filterDate || "Choose Date"}</span>
            {filterDate && (
              <button
                onClick={(e) => { e.preventDefault(); setFilterDate(""); }}
                className="ml-1 text-[color:var(--text-mute)] hover:text-[color:var(--text)]"
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
            <div className="text-center text-[11px] text-[color:var(--text-mute)] py-3 rounded-lg border border-[color:var(--border-soft)] bg-[var(--surface)]/40">
              {filterDate ? "No transactions on this date." : "No transactions yet."}
            </div>
          ) : (
            visibleTxns.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface)]/70 border border-[color:var(--border)] shadow-[inset_0_0_10px_rgba(22,163,74,0.03)]"
                data-testid="bot-txn-row"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[color:var(--text)] capitalize tracking-wide leading-tight">
                    {t.kind === "fuel" ? "Bot Fuel" : t.kind.replace("_", " ")}
                  </div>
                  <div className="text-[9px] text-[color:var(--text-mute)] leading-tight">{fmtTime(t.created_at)}</div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div
                    className={`text-[12px] font-bold leading-tight ${
                      t.amount > 0 ? "text-[color:var(--good)]" : t.amount < 0 ? "text-[color:var(--bad)]" : "text-[color:var(--text-mute)]"
                    }`}
                  >
                    {t.amount > 0 ? "+" : ""}
                    {fmtUSD(t.amount)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========== INFO DIALOG (Conditions) ========== */}
      {modal === "info" && (
        <ModalShell title="How it works" onClose={closeModal} testid="dialog-info">
          <ul className="text-[13px] text-[color:var(--text-soft)] leading-relaxed space-y-2.5 list-disc pl-5">
            <li>Pay one-time <span className="text-[color:var(--text)] font-semibold">${actFee}</span> to activate the trading bot.</li>
            <li>Pre-fund your Wallet with <span className="text-[color:var(--text)] font-semibold">Fuel</span> — the bot burns fuel from here on every profitable trade.</li>
            <li>Every profitable SELL deducts <span className="text-[color:var(--warn)] font-semibold">{feePct}% Fuel</span> from your Wallet (paid to the platform).</li>
            <li>Keep at least <span className="text-[color:var(--text)] font-semibold">${minFuel}</span> Fuel — if balance drops below, all bots pause automatically.</li>
          </ul>
          <button
            onClick={closeModal}
            className="mt-5 w-full py-3 rounded-lg bg-[color:var(--primary)]/15 text-[color:var(--primary)] font-semibold text-sm border border-[color:var(--primary)]/30"
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
            <div className="w-16 h-16 rounded-full bg-[color:var(--good)]/10 border border-[color:var(--good)]/40 flex items-center justify-center mb-3"
                 style={{ boxShadow: "0 0 24px rgba(22,163,74,0.25)" }}>
              <Zap size={32} className="text-[color:var(--good)]" />
            </div>
            <div className="text-sm text-[color:var(--text-mute)]">One-time Activation Fee</div>
            <div className="text-4xl font-bold text-[color:var(--text)] mt-1">${actFee}</div>
            <p className="text-xs text-[color:var(--text-mute)] text-center mt-3 leading-relaxed">
              This fee will be deducted from your <span className="text-[color:var(--text)]">Main Wallet</span> (${fmtUSD(mainBal).replace("$","")}).
              After activation, you can deposit funds to your Bot Wallet and start trading.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={closeModal}
              className="flex-1 py-3 rounded-lg border border-[color:var(--border-soft)] text-[color:var(--text-soft)] text-sm"
              data-testid="btn-cancel-activate"
            >
              Cancel
            </button>
            <button
              onClick={doActivate}
              disabled={loading || mainBal < actFee}
              className="flex-1 py-3 rounded-lg bg-[color:var(--good)] text-black font-bold text-sm disabled:opacity-40"
              data-testid="btn-confirm-activate"
            >
              {loading ? "Processing..." : `Pay $${actFee}`}
            </button>
          </div>
          {mainBal < actFee && (
            <p className="text-xs text-[color:var(--bad)] text-center mt-2">Insufficient main wallet balance.</p>
          )}
        </ModalShell>
      )}

      {/* ========== DEPOSIT DIALOG ========== */}
      {modal === "deposit" && (
        <ModalShell title="Deposit" onClose={closeModal} testid="dialog-deposit">
          <div className="flex gap-1.5 rounded-lg bg-[var(--surface)] p-1 mb-3">
            <button
              onClick={() => setDepositTab("crypto")}
              className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition ${
                depositTab === "crypto"
                  ? "bg-[color:var(--good)] text-black"
                  : "text-[color:var(--text-mute)] hover:text-[color:var(--text)]"
              }`}
              data-testid="tab-deposit-crypto"
            >
              Crypto (USDT)
            </button>
            <button
              onClick={() => setDepositTab("main")}
              className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition ${
                depositTab === "main"
                  ? "bg-[color:var(--good)] text-black"
                  : "text-[color:var(--text-mute)] hover:text-[color:var(--text)]"
              }`}
              data-testid="tab-deposit-main"
            >
              Main Wallet
            </button>
          </div>

          {depositTab === "crypto" ? (
            <>
              <div className="flex gap-1.5 mb-3">
                {[
                  { id: "BEP20", label: "BSC · BEP20" },
                  { id: "POLYGON", label: "Polygon" },
                  { id: "TRC20", label: "TRC20", soon: true },
                ].map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setDepNet(n.id)}
                    className={`flex-1 py-2 rounded-md text-[10px] font-bold border transition ${
                      depNet === n.id
                        ? "border-[color:var(--good)] bg-[color:var(--good)]/10 text-[color:var(--good)]"
                        : "border-[color:var(--border-soft)] text-[color:var(--text-mute)]"
                    }`}
                    data-testid={`deposit-net-${n.id.toLowerCase()}`}
                  >
                    {n.label}
                    {n.soon && <span className="block text-[8px] text-[color:var(--warn)]">Soon</span>}
                  </button>
                ))}
              </div>

              {depNet === "TRC20" ? (
                <div
                  className="rounded-lg border border-[color:var(--warn)]/40 bg-[color:var(--gold)]/5 p-4 text-center"
                  data-testid="deposit-coming-soon"
                >
                  <div className="text-[color:var(--warn)] font-bold text-sm">Coming Soon</div>
                  <div className="text-[11px] text-[color:var(--text-mute)] mt-1">
                    TRC20 deposits are not available yet. Use BSC or Polygon.
                  </div>
                </div>
              ) : !depositInfo ? (
                <div className="text-center text-[12px] text-[color:var(--text-mute)] py-6">
                  Generating your deposit address…
                </div>
              ) : (
                <>
                  <div className="flex justify-center my-3">
                    <div className="bg-white p-2.5 rounded-xl" data-testid="deposit-qr">
                      <QRCodeCanvas value={depositInfo.address} size={150} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--surface)] border border-[color:var(--border-soft)] px-3 py-2.5">
                    <div
                      className="flex-1 text-[11px] font-mono break-all text-[color:var(--text)]"
                      data-testid="deposit-address-text"
                    >
                      {depositInfo.address}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(depositInfo.address);
                        toast.success("Address copied");
                      }}
                      className="shrink-0 px-2.5 py-1.5 rounded-md bg-[color:var(--good)]/10 border border-[color:var(--good)]/40 text-[color:var(--good)]"
                      data-testid="btn-copy-deposit-address"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <ul className="mt-3 text-[10px] text-[color:var(--text-mute)] space-y-1 list-disc pl-4">
                    <li>
                      Send only <span className="text-[color:var(--text)] font-semibold">USDT</span> on{" "}
                      <span className="text-[color:var(--text)] font-semibold">
                        {depNet === "BEP20" ? "BNB Smart Chain (BEP20)" : "Polygon"}
                      </span>{" "}
                      to this address.
                    </li>
                    <li>Same address works on both BSC & Polygon networks.</li>
                    <li>Funds auto-credit to your Bot Wallet within ~1 minute of confirmation.</li>
                  </ul>
                </>
              )}
            </>
          ) : (
            <>
              <div className="text-xs text-[color:var(--text-mute)] mb-2">
                From Main Wallet ({fmtUSD(mainBal)}) → Wallet
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount in USDT"
                className="w-full px-4 py-3 rounded-lg bg-[var(--surface)] border border-[color:var(--border-soft)] text-[color:var(--text)] text-lg font-semibold focus:border-[color:var(--good)] outline-none"
                data-testid="input-deposit-amount"
              />
              <div className="flex gap-2 mt-2">
                {[50, 100, 500, 1000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="flex-1 py-1.5 text-xs rounded-md border border-[color:var(--border-soft)] text-[color:var(--text-soft)] hover:border-[color:var(--good)]/40"
                  >
                    ${v}
                  </button>
                ))}
              </div>
              <button
                onClick={doDeposit}
                disabled={loading}
                className="mt-4 w-full py-3 rounded-lg bg-[color:var(--good)] text-black font-bold text-sm disabled:opacity-40"
                data-testid="btn-confirm-deposit"
              >
                {loading ? "Processing..." : "Confirm Deposit"}
              </button>
            </>
          )}
        </ModalShell>
      )}

      {/* ========== WITHDRAW DIALOG ========== */}
      {modal === "withdraw" && (
        <ModalShell title="Withdraw" onClose={closeModal} testid="dialog-withdraw">
          <div className="text-[11px] text-[color:var(--text-mute)] mb-3">
            Wallet Balance: <span className="text-[color:var(--text)] font-semibold">{fmtUSD(balance)}</span>
          </div>

          {/* Network first */}
          <label className="block text-[10px] tracking-[0.2em] uppercase text-[color:var(--text-mute)] mb-1">
            Network
          </label>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[color:var(--border-soft)] text-[color:var(--text)] text-[13px] focus:border-[color:var(--bad)] outline-none"
            data-testid="select-withdraw-network"
          >
            <option value="BEP20">BEP20 (BSC · Binance Smart Chain)</option>
            <option value="POLYGON">Polygon</option>
            <option value="TRC20">TRC20 (Tron)</option>
            <option value="ERC20">ERC20 (Ethereum)</option>
            <option value="SOL">Solana</option>
          </select>

          {!["BEP20", "POLYGON"].includes(network) ? (
            <div
              className="mt-3 rounded-lg border border-[color:var(--warn)]/40 bg-[color:var(--gold)]/5 p-3 text-center"
              data-testid="withdraw-coming-soon"
            >
              <div className="text-[color:var(--warn)] font-bold text-sm">Coming Soon</div>
              <div className="text-[11px] text-[color:var(--text-mute)] mt-1">
                {network} liquidity is not available yet. Only BEP20 & Polygon are supported today.
              </div>
            </div>
          ) : (
            <>
              {/* Address */}
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[color:var(--text-mute)] mt-3 mb-1">
                Recipient Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paste USDT address or scan"
                  className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[color:var(--border-soft)] text-[color:var(--text)] text-[13px] font-mono focus:border-[color:var(--bad)] outline-none"
                  data-testid="input-withdraw-address"
                />
                <button
                  onClick={startScan}
                  className="px-3 rounded-lg bg-[color:var(--bad)]/10 border border-[color:var(--bad)]/40 text-[color:var(--bad)] hover:bg-[color:var(--bad)]/20 transition"
                  data-testid="btn-scan-qr"
                  type="button"
                >
                  <QrCode size={18} />
                </button>
              </div>
              {scanning && (
                <div className="mt-2 rounded-lg overflow-hidden border border-[color:var(--bad)]/40 bg-black">
                  <div id="qr-reader" ref={qrRef} className="w-full" />
                  <button
                    onClick={stopScan}
                    className="w-full py-1.5 text-[11px] font-semibold bg-[var(--surface)] text-[color:var(--bad)] border-t border-[color:var(--border-soft)]"
                    data-testid="btn-stop-scan"
                  >
                    Cancel scan
                  </button>
                </div>
              )}
              <div className="text-[10px] text-[color:var(--text-mute)] mt-1">
                Leave empty to withdraw to your Main Wallet instead.
              </div>

              {/* Amount */}
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[color:var(--text-mute)] mt-3 mb-1">
                Amount (USDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="How much to send"
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[color:var(--border-soft)] text-[color:var(--text)] text-lg font-semibold focus:border-[color:var(--bad)] outline-none"
                data-testid="input-withdraw-amount"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setAmount(String(balance))}
                  className="flex-1 py-1.5 text-xs rounded-md border border-[color:var(--border-soft)] text-[color:var(--text-soft)] hover:border-[color:var(--bad)]/40"
                >
                  Max ({fmtUSD(balance)})
                </button>
              </div>
              {address && (
                <>
                  <div
                    className="mt-3 rounded-lg border border-[color:var(--warn)]/30 bg-[color:var(--gold)]/5 px-3 py-2 text-[11px] text-[color:var(--text-soft)] space-y-0.5"
                    data-testid="withdraw-fee-info"
                  >
                    <div>Network fee: <span className="font-semibold text-[color:var(--text)]">2 USDT</span> · Minimum: <span className="font-semibold text-[color:var(--text)]">$10</span></div>
                    <div>
                      You will receive:{" "}
                      <span className="font-bold text-[color:var(--good)]">
                        {Math.max(0, (parseFloat(amount) || 0) - 2).toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="text-[10px] text-[color:var(--text-mute)]">External withdrawals require manual admin approval.</div>
                  </div>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-[color:var(--text-mute)] mt-3 mb-1">
                    Login Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Confirm with your password"
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[color:var(--border-soft)] text-[color:var(--text)] text-[13px] focus:border-[color:var(--bad)] outline-none"
                    data-testid="input-withdraw-password"
                  />
                </>
              )}
              <button
                onClick={doWithdraw}
                disabled={loading}
                className="mt-4 w-full py-3 rounded-lg bg-[color:var(--bad)] text-white font-bold text-sm disabled:opacity-40"
                data-testid="btn-confirm-withdraw"
              >
                {loading ? "Processing..." : address ? "Submit Withdrawal Request" : "Withdraw to Main Wallet"}
              </button>
            </>
          )}
        </ModalShell>
      )}

      {/* ========== P2P DIALOG (Email tab + Address/Scan tab) ========== */}
      {modal === "p2p" && (
        <ModalShell title="P2P Transfer" onClose={closeModal} testid="dialog-p2p">
          {/* Tabs */}
          <div className="flex gap-1.5 rounded-lg bg-[var(--surface)] p-1 mb-3">
            <button
              onClick={() => setP2pMode("email")}
              className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition ${
                p2pMode === "email"
                  ? "bg-[color:var(--gold)] text-black"
                  : "text-[color:var(--text-mute)] hover:text-[color:var(--text)]"
              }`}
              data-testid="tab-p2p-email"
            >
              By Email
            </button>
            <button
              onClick={() => setP2pMode("address")}
              className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition ${
                p2pMode === "address"
                  ? "bg-[color:var(--gold)] text-black"
                  : "text-[color:var(--text-mute)] hover:text-[color:var(--text)]"
              }`}
              data-testid="tab-p2p-address"
            >
              By Address
            </button>
          </div>

          {p2pMode === "email" ? (
            <>
              <div className="flex items-center gap-2 text-[11px] text-[color:var(--text-mute)] mb-2">
                <Users size={12} className="text-[color:var(--warn)]" />
                <span>Send USDT directly to another TGX BOT user</span>
              </div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[color:var(--text-mute)] mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[color:var(--border-soft)] text-[color:var(--text)] text-[13px] focus:border-[color:var(--warn)] outline-none"
                data-testid="input-p2p-recipient"
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px] text-[color:var(--text-mute)] mb-2">
                <Users size={12} className="text-[color:var(--warn)]" />
                <span>Send to another HUBXBOT user's deposit address (BSC / Polygon) — instant & free</span>
              </div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[color:var(--text-mute)] mb-1">
                Recipient Deposit Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paste address or scan QR"
                  className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[color:var(--border-soft)] text-[color:var(--text)] text-[13px] font-mono focus:border-[color:var(--warn)] outline-none"
                  data-testid="input-p2p-address"
                />
                <button
                  onClick={startScan}
                  className="px-3 rounded-lg bg-[color:var(--gold)]/10 border border-[color:var(--warn)]/40 text-[color:var(--warn)] hover:bg-[color:var(--gold)]/20 transition"
                  data-testid="btn-scan-p2p-qr"
                  type="button"
                >
                  <QrCode size={18} />
                </button>
              </div>
              {scanning && (
                <div className="mt-2 rounded-lg overflow-hidden border border-[color:var(--warn)]/40 bg-black">
                  <div id="qr-reader" ref={qrRef} className="w-full" />
                  <button
                    onClick={stopScan}
                    className="w-full py-1.5 text-[11px] font-semibold bg-[var(--surface)] text-[color:var(--bad)] border-t border-[color:var(--border-soft)]"
                    data-testid="btn-stop-scan-p2p"
                  >
                    Cancel scan
                  </button>
                </div>
              )}
            </>
          )}

          {/* Amount + Send */}
          {(
            <>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[color:var(--text-mute)] mt-3 mb-1">
                Amount (USDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[color:var(--border-soft)] text-[color:var(--text)] text-lg font-semibold focus:border-[color:var(--warn)] outline-none"
                data-testid="input-p2p-amount"
              />
              <div className="text-[10px] text-[color:var(--text-mute)] mt-1">
                Available: <span className="text-[color:var(--text)]">{fmtUSD(balance)}</span>
              </div>
              <button
                onClick={doP2P}
                disabled={loading}
                className="mt-4 w-full py-3 rounded-lg bg-[color:var(--gold)] text-black font-bold text-sm disabled:opacity-40"
                data-testid="btn-confirm-p2p"
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </>
          )}
        </ModalShell>
      )}

      {/* ========== HISTORY inline above — modal removed ========== */}
    </div>
  );
}

function ModalShell({ title, children, onClose, testid }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid={testid}
    >
      <div
        className="w-full max-w-[440px] bg-[color:var(--surface)] border border-[color:var(--primary)]/25 rounded-2xl p-5"
        style={{ boxShadow: "0 0 30px rgba(22,163,74,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-[color:var(--text)]">{title}</div>
          <button onClick={onClose} className="text-[color:var(--text-mute)] hover:text-[color:var(--text)]" data-testid="btn-close-dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
