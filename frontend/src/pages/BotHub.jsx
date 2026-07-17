import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Wallet as WalletIcon,
  Zap,
  Coins,
  ArrowDownToLine,
  ArrowUpToLine,
  ArrowRightLeft,
  History,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Check,
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
import WithdrawModal from "@/components/WithdrawModal";
import { BnbLogo, PolygonLogo, TronLogo, TetherLogo, TETHER_LOGO } from "@/components/CryptoLogos";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const HERO_IMAGE =
  "https://customer-assets.emergentagent.com/job_tgx-api-gateway/artifacts/v63grioq_file_000000003580720b84b6c5daae428f49.png";

const DEPOSIT_NETWORKS = [
  { id: "BEP20", name: "BNB Smart Chain", tag: "BEP20", Logo: BnbLogo },
  { id: "POLYGON", name: "Polygon", tag: "POS", Logo: PolygonLogo },
  { id: "TRC20", name: "TRON", tag: "TRC20", Logo: TronLogo, soon: true },
];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [modal, setModal] = useState(null); // 'activate' | 'deposit' | 'withdraw' | 'p2p' | 'info' | null
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("BEP20");
  const [recipient, setRecipient] = useState("");
  const [p2pMode, setP2pMode] = useState("email"); // 'email' | 'address'
  const [depNet, setDepNet] = useState("BEP20");
  const [depositInfo, setDepositInfo] = useState(null);
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    const action = searchParams.get("action");
    if (["deposit", "withdraw", "p2p"].includes(action)) {
      setModal(action);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => {
    stopScan();
    setModal(null);
    setAmount("");
    setAddress("");
    setNetwork("BEP20");
    setRecipient("");
    setP2pMode("email");
    setPassword("");
    setCopied(false);
  };

  const copyDepositAddress = () => {
    if (!depositInfo?.address) return;
    const text = depositInfo.address;
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    };
    try {
      navigator.clipboard.writeText(text).catch(fallback);
    } catch {
      fallback();
    }
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1800);
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

        {/* Wallet balance moved to Asset section — see Asset tab */}

        {/* Actions moved to Asset section — see Asset tab */}

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

        {/* Transaction history moved to the Asset page — see Asset tab */}
        <button
          onClick={() => navigate("/wallet")}
          className="mt-3 w-full flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] bg-[var(--surface)]/60 px-4 py-2.5 hover:border-[color:var(--warn)]/30 transition"
          data-testid="bot-view-history"
        >
          <div className="flex items-center gap-2">
            <History size={12} className="text-[color:var(--warn)]" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-[color:var(--text-mute)]">Transaction History</span>
          </div>
          <span className="text-[11px] font-semibold text-[color:var(--warn)]">View in Asset ›</span>
        </button>
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
              This fee will be deducted from your <span className="text-[color:var(--text)]">Wallet balance</span> ({fmtUSD(balance)}).
              After activation, your bot can start trading using this wallet.
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
              disabled={loading || balance < actFee}
              className="flex-1 py-3 rounded-lg bg-[color:var(--good)] text-black font-bold text-sm disabled:opacity-40"
              data-testid="btn-confirm-activate"
            >
              {loading ? "Processing..." : `Pay $${actFee}`}
            </button>
          </div>
          {balance < actFee && (
            <p className="text-xs text-[color:var(--bad)] text-center mt-2">Insufficient balance — deposit USDT first to activate.</p>
          )}
        </ModalShell>
      )}

      {/* ========== DEPOSIT DIALOG ========== */}
      {modal === "deposit" && (
        <ModalShell title="Deposit" onClose={closeModal} testid="dialog-deposit">
          <>
              {/* Network cards with official logos */}
              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                {DEPOSIT_NETWORKS.map((n) => {
                  const active = depNet === n.id;
                  return (
                    <button
                      key={n.id}
                      onClick={() => setDepNet(n.id)}
                      className={`relative flex flex-col items-center gap-1 rounded-xl py-2 px-1 border transition-all duration-300 active:scale-95 ${
                        active
                          ? "border-[color:var(--gold)] bg-[color:var(--good)]/5 net-glow"
                          : "border-[color:var(--border-soft)] bg-[var(--surface)] hover:border-[color:var(--good)]/40"
                      }`}
                      data-testid={`deposit-net-${n.id.toLowerCase()}`}
                    >
                      <n.Logo size={22} />
                      <span
                        className={`text-[10px] font-bold leading-tight ${
                          active ? "text-[color:var(--good)]" : "text-[color:var(--text-soft)]"
                        }`}
                      >
                        {n.id === "BEP20" ? "BSC · BEP20" : n.name}
                      </span>
                      {n.soon && (
                        <span className="absolute -top-1.5 right-1.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[color:var(--gold)] text-black">
                          Soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!depositInfo ? (
                <div className="text-center text-[12px] text-[color:var(--text-mute)] py-6">
                  Generating your deposit address…
                </div>
              ) : (
                (() => {
                  const net = DEPOSIT_NETWORKS.find((n) => n.id === depNet);
                  const isSoon = depNet === "TRC20";
                  const shownAddress = isSoon
                    ? "TN3W4H8mP9QkX5vR2LcD7sJ4fA6bE1gYhU"
                    : depositInfo.address;
                  return (
                    <>
                      {/* Selected network header */}
                      <div
                        className="flex items-center justify-center gap-2 mb-2"
                        data-testid="deposit-selected-network"
                      >
                        <net.Logo size={16} />
                        <span className="text-[12px] font-bold text-[color:var(--text)]">
                          {net.name} <span className="text-[color:var(--text-mute)] font-semibold">({net.tag})</span>
                        </span>
                      </div>

                      {/* Premium QR with green→gold gradient border + USDT center logo */}
                      <div className="flex justify-center mb-2.5">
                        <div
                          className="qr-float relative rounded-2xl p-[2.5px]"
                          style={{
                            background: "linear-gradient(135deg, var(--good) 0%, var(--gold) 100%)",
                            boxShadow: "0 12px 34px rgba(22,163,74,0.28), 0 4px 14px rgba(245,158,11,0.18)",
                          }}
                          data-testid="deposit-qr"
                        >
                          <div className="bg-white rounded-[13px] p-2.5 overflow-hidden">
                            <div className={isSoon ? "blur-[7px] opacity-60 select-none pointer-events-none" : ""}>
                              <QRCodeCanvas
                                value={shownAddress}
                                size={130}
                                level="H"
                                imageSettings={{ src: TETHER_LOGO, height: 32, width: 32, excavate: true }}
                              />
                            </div>
                          </div>
                          {isSoon && (
                            <div className="absolute inset-0 flex items-center justify-center" data-testid="deposit-coming-soon">
                              <span
                                className="px-4 py-1.5 rounded-full bg-[#EF0027] text-white text-[11px] font-black uppercase tracking-[0.18em] shadow-lg animate-pulse"
                                style={{ boxShadow: "0 6px 20px rgba(239,0,39,0.45)" }}
                              >
                                Coming Soon
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Wallet address */}
                      <div className="rounded-xl bg-[var(--surface)] border border-[color:var(--border-soft)] px-3 py-2">
                        <div className="text-[9px] tracking-[0.25em] uppercase font-bold text-[color:var(--good)] mb-1">
                          Wallet Address ({net.tag})
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex-1 text-[11px] font-mono break-all text-[color:var(--text)] leading-snug ${
                              isSoon ? "blur-[5px] opacity-60 select-none" : ""
                            }`}
                            data-testid="deposit-address-text"
                          >
                            {shownAddress}
                          </div>
                          <button
                            onClick={copyDepositAddress}
                            disabled={isSoon}
                            className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-300 active:scale-90 ${
                              isSoon
                                ? "bg-[var(--surface)] border-[color:var(--border-soft)] text-[color:var(--text-mute)] opacity-50"
                                : copied
                                ? "bg-[color:var(--good)] border-[color:var(--good)] text-white copy-pop"
                                : "bg-[color:var(--good)]/10 border-[color:var(--good)]/40 text-[color:var(--good)] hover:bg-[color:var(--good)]/20"
                            }`}
                            data-testid="btn-copy-deposit-address"
                          >
                            {copied && !isSoon ? <Check size={16} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Notices */}
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-start gap-2 text-[10px] text-[color:var(--text-soft)]">
                          <CheckCircle2 size={12} className="text-[color:var(--good)] shrink-0 mt-0.5" />
                          <span>
                            Send only <span className="font-bold text-[color:var(--text)]">USDT</span> on{" "}
                            <span className="font-bold text-[color:var(--text)]">
                              {net.name} ({net.tag})
                            </span>{" "}
                            to this address.
                          </span>
                        </div>
                        <div className="flex items-start gap-2 text-[10px] text-[color:var(--text-soft)]" data-testid="deposit-confirm-note">
                          <CheckCircle2 size={12} className="text-[color:var(--good)] shrink-0 mt-0.5" />
                          <span>
                            Funds are automatically credited to your Bot Wallet within approximately{" "}
                            <span className="font-bold text-[color:var(--text)]">1 minute</span> after blockchain
                            confirmation.
                          </span>
                        </div>
                      </div>

                      {/* Coin / Network / Secure info row */}
                      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                        <div className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border-soft)] bg-[var(--surface)] px-2 py-1.5">
                          <TetherLogo size={18} />
                          <div className="min-w-0">
                            <div className="text-[8px] uppercase tracking-widest text-[color:var(--text-mute)]">Coin</div>
                            <div className="text-[10px] font-bold text-[color:var(--text)]">USDT</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border-soft)] bg-[var(--surface)] px-2 py-1.5">
                          <net.Logo size={18} />
                          <div className="min-w-0">
                            <div className="text-[8px] uppercase tracking-widest text-[color:var(--text-mute)]">Network</div>
                            <div className="text-[10px] font-bold text-[color:var(--text)]">{net.tag}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border-soft)] bg-[var(--surface)] px-2 py-1.5">
                          <span className="w-[18px] h-[18px] rounded-full bg-[color:var(--good)] flex items-center justify-center shrink-0">
                            <ShieldCheck size={11} className="text-white" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[8px] uppercase tracking-widest text-[color:var(--text-mute)]">Secure</div>
                            <div className="text-[10px] font-bold text-[color:var(--text)]">100% Safe</div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()
              )}
          </>
        </ModalShell>
      )}

      {/* ========== WITHDRAW DIALOG (premium green+gold) ========== */}
      {modal === "withdraw" && (
        <WithdrawModal
          balance={balance}
          onClose={closeModal}
          onSubmitted={async () => {
            await loadStatus();
            await loadTxns();
            await loadWithdrawals();
            await refresh?.();
          }}
        />
      )}

      {/* ========== P2P DIALOG (Email tab + Address/Scan tab) ========== */}
      {modal === "p2p" && (
        <ModalShell title="P2P Transfer" onClose={closeModal} testid="dialog-p2p">
          {/* Balance strip */}
          <div
            className="rounded-xl px-3.5 py-2.5 flex items-center justify-between border mb-3"
            style={{ background: "var(--surface-3)", borderColor: "rgba(212,160,23,0.35)" }}
          >
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-[color:var(--gold-deep,#D97706)]" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--text-mute)]">Available</span>
            </div>
            <span className="text-[color:var(--text)] font-black text-base">{fmtUSD(balance)} <span className="text-[10px] text-[color:var(--gold-deep,#D97706)]">USDT</span></span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 rounded-xl bg-[var(--surface-3)] p-1 mb-3 border" style={{ borderColor: "var(--border-soft)" }}>
            <button
              onClick={() => setP2pMode("email")}
              className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${
                p2pMode === "email"
                  ? "bg-[color:var(--gold)] text-black shadow-[0_2px_10px_rgba(245,158,11,0.35)]"
                  : "text-[color:var(--text-mute)] hover:text-[color:var(--text)]"
              }`}
              data-testid="tab-p2p-email"
            >
              By Email
            </button>
            <button
              onClick={() => setP2pMode("address")}
              className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${
                p2pMode === "address"
                  ? "bg-[color:var(--gold)] text-black shadow-[0_2px_10px_rgba(245,158,11,0.35)]"
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
              <label className="block text-[10px] tracking-[0.22em] uppercase font-bold text-[color:var(--gold-deep,#D97706)] mb-1.5">
                Recipient Email
              </label>
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--surface-3)] border border-[color:var(--gold)]/25 text-[color:var(--text)] text-[13px] focus:border-[color:var(--gold)] focus:shadow-[0_0_12px_rgba(245,158,11,0.2)] outline-none transition"
                data-testid="input-p2p-recipient"
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px] text-[color:var(--text-mute)] mb-2">
                <Users size={12} className="text-[color:var(--warn)]" />
                <span>Send to another HUBXBOT user's deposit address (BSC / Polygon) — instant & free</span>
              </div>
              <label className="block text-[10px] tracking-[0.22em] uppercase font-bold text-[color:var(--gold-deep,#D97706)] mb-1.5">
                Recipient Deposit Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paste address or scan QR"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[color:var(--surface-3)] border border-[color:var(--gold)]/25 text-[color:var(--text)] text-[13px] font-mono focus:border-[color:var(--gold)] focus:shadow-[0_0_12px_rgba(245,158,11,0.2)] outline-none transition"
                  data-testid="input-p2p-address"
                />
                <button
                  onClick={startScan}
                  className="px-3.5 rounded-xl bg-[color:var(--gold)]/10 border border-[color:var(--gold)]/40 text-[color:var(--gold-deep,#D97706)] hover:bg-[color:var(--gold)]/20 transition"
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
              <label className="block text-[10px] tracking-[0.22em] uppercase font-bold text-[color:var(--gold-deep,#D97706)] mt-3 mb-1.5">
                Amount (USDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--surface-3)] border border-[color:var(--gold)]/25 text-[color:var(--text)] text-lg font-bold focus:border-[color:var(--gold)] focus:shadow-[0_0_12px_rgba(245,158,11,0.2)] outline-none transition"
                data-testid="input-p2p-amount"
              />
              <div className="text-[10px] text-[color:var(--text-mute)] mt-1">
                Available: <span className="text-[color:var(--text)]">{fmtUSD(balance)}</span>
              </div>
              <button
                onClick={doP2P}
                disabled={loading}
                className="mt-4 w-full py-3 rounded-2xl text-black font-black text-sm uppercase tracking-wider disabled:opacity-40 transition active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #F5C518, #E8A804)", boxShadow: "0 6px 18px rgba(245,158,11,0.35)" }}
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
        className="w-full max-w-[440px] max-h-[88vh] overflow-y-auto bg-[color:var(--surface)] rounded-3xl p-5 border"
        style={{
          borderColor: "rgba(212,160,23,0.45)",
          boxShadow: "0 18px 50px rgba(22,163,74,0.18), 0 0 24px rgba(245,158,11,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-black text-[color:var(--text)]">{title}</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border text-[color:var(--gold-deep,#D97706)] hover:bg-[color:var(--gold)]/10"
            style={{ borderColor: "rgba(212,160,23,0.45)" }}
            data-testid="btn-close-dialog"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
