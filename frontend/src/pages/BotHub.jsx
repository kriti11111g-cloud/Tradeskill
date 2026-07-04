import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  X,
} from "lucide-react";
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
  const [status, setStatus] = useState(null);
  const [modal, setModal] = useState(null); // 'activate' | 'deposit' | 'withdraw' | 'p2p' | 'info' | null
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("BEP20");
  const [recipient, setRecipient] = useState("");
  const [p2pMode, setP2pMode] = useState("email"); // 'email' | 'address'
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

  useEffect(() => {
    loadStatus();
    loadTxns();
  }, [loadStatus, loadTxns]);

  const closeModal = () => {
    stopScan();
    setModal(null);
    setAmount("");
    setAddress("");
    setNetwork("BEP20");
    setRecipient("");
    setP2pMode("email");
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
    setLoading(true);
    try {
      await api.post("/bot-wallet/withdraw", {
        amount: amt,
        address: address || null,
        network: address ? network : null,
      });
      toast.success(
        address
          ? `Sent $${amt.toFixed(2)} to ${address.slice(0, 8)}…`
          : `Withdrew $${amt.toFixed(2)} to Main Wallet`,
      );
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

  const doP2P = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const isAddressMode = p2pMode === "address";
    if (isAddressMode) {
      if (!address.trim()) return toast.error("Paste or scan an address");
      if (network !== "BEP20") return toast.error(`${network} coming soon — only BEP20 supported`);
    } else if (!recipient.trim()) {
      return toast.error("Enter recipient email");
    }
    setLoading(true);
    try {
      const payload = isAddressMode
        ? { recipient_address: address.trim(), network, amount: amt }
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
          {lowFuel && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[#FF3B3B]">
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
            onClick={() => setModal("p2p")}
            disabled={!activated || balance <= 0}
            className="rounded-lg border border-[#FFD700]/30 bg-[#FFD700]/5 py-2 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FFD700]/10 transition"
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
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B1220]/70 border border-white/25 shadow-[inset_0_0_10px_rgba(0,240,255,0.03)]"
                data-testid="bot-txn-row"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white capitalize tracking-wide leading-tight">
                    {t.kind === "fuel" ? "Bot Fuel" : t.kind.replace("_", " ")}
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
            <li>Pre-fund your Wallet with <span className="text-white font-semibold">Fuel</span> — the bot burns fuel from here on every profitable trade.</li>
            <li>Every profitable SELL deducts <span className="text-[#FFD700] font-semibold">{feePct}% Fuel</span> from your Wallet (paid to the platform).</li>
            <li>Keep at least <span className="text-white font-semibold">${minFuel}</span> Fuel — if balance drops below, all bots pause automatically.</li>
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
        <ModalShell title="Withdraw" onClose={closeModal} testid="dialog-withdraw">
          <div className="text-[11px] text-[#8B9BB4] mb-3">
            Wallet Balance: <span className="text-white font-semibold">{fmtUSD(balance)}</span>
          </div>

          {/* Network first */}
          <label className="block text-[10px] tracking-[0.2em] uppercase text-[#8B9BB4] mb-1">
            Network
          </label>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-[#0B1220] border border-white/10 text-white text-[13px] focus:border-[#FF007A] outline-none"
            data-testid="select-withdraw-network"
          >
            <option value="BEP20">BEP20 (BSC · Binance Smart Chain)</option>
            <option value="ERC20">ERC20 (Ethereum)</option>
            <option value="TRC20">TRC20 (Tron)</option>
            <option value="SOL">Solana</option>
            <option value="POLYGON">Polygon</option>
          </select>

          {network !== "BEP20" ? (
            <div
              className="mt-3 rounded-lg border border-[#FFD700]/40 bg-[#FFD700]/5 p-3 text-center"
              data-testid="withdraw-coming-soon"
            >
              <div className="text-[#FFD700] font-bold text-sm">Coming Soon</div>
              <div className="text-[11px] text-[#8B9BB4] mt-1">
                {network} liquidity is not available yet. Only BEP20 is supported today.
              </div>
            </div>
          ) : (
            <>
              {/* Address */}
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#8B9BB4] mt-3 mb-1">
                Recipient Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paste USDT address or scan"
                  className="flex-1 px-3 py-2.5 rounded-lg bg-[#0B1220] border border-white/10 text-white text-[13px] font-mono focus:border-[#FF007A] outline-none"
                  data-testid="input-withdraw-address"
                />
                <button
                  onClick={startScan}
                  className="px-3 rounded-lg bg-[#FF007A]/10 border border-[#FF007A]/40 text-[#FF007A] hover:bg-[#FF007A]/20 transition"
                  data-testid="btn-scan-qr"
                  type="button"
                >
                  <QrCode size={18} />
                </button>
              </div>
              {scanning && (
                <div className="mt-2 rounded-lg overflow-hidden border border-[#FF007A]/40 bg-black">
                  <div id="qr-reader" ref={qrRef} className="w-full" />
                  <button
                    onClick={stopScan}
                    className="w-full py-1.5 text-[11px] font-semibold bg-[#0B1220] text-[#FF3B3B] border-t border-white/10"
                    data-testid="btn-stop-scan"
                  >
                    Cancel scan
                  </button>
                </div>
              )}
              <div className="text-[10px] text-[#8B9BB4] mt-1">
                Leave empty to withdraw to your Main Wallet instead.
              </div>

              {/* Amount */}
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#8B9BB4] mt-3 mb-1">
                Amount (USDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="How much to send"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0B1220] border border-white/10 text-white text-lg font-semibold focus:border-[#FF007A] outline-none"
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
                {loading ? "Processing..." : address ? `Send ${network}` : "Withdraw to Main Wallet"}
              </button>
            </>
          )}
        </ModalShell>
      )}

      {/* ========== P2P DIALOG (Email tab + Address/Scan tab) ========== */}
      {modal === "p2p" && (
        <ModalShell title="P2P Transfer" onClose={closeModal} testid="dialog-p2p">
          {/* Tabs */}
          <div className="flex gap-1.5 rounded-lg bg-[#0B1220] p-1 mb-3">
            <button
              onClick={() => setP2pMode("email")}
              className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition ${
                p2pMode === "email"
                  ? "bg-[#FFD700] text-black"
                  : "text-[#8B9BB4] hover:text-white"
              }`}
              data-testid="tab-p2p-email"
            >
              By Email
            </button>
            <button
              onClick={() => setP2pMode("address")}
              className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition ${
                p2pMode === "address"
                  ? "bg-[#FFD700] text-black"
                  : "text-[#8B9BB4] hover:text-white"
              }`}
              data-testid="tab-p2p-address"
            >
              By Address
            </button>
          </div>

          {p2pMode === "email" ? (
            <>
              <div className="flex items-center gap-2 text-[11px] text-[#8B9BB4] mb-2">
                <Users size={12} className="text-[#FFD700]" />
                <span>Send USDT directly to another TGX BOT user</span>
              </div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#8B9BB4] mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0B1220] border border-white/10 text-white text-[13px] focus:border-[#FFD700] outline-none"
                data-testid="input-p2p-recipient"
              />
            </>
          ) : (
            <>
              {/* Network */}
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#8B9BB4] mb-1">
                Network
              </label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#0B1220] border border-white/10 text-white text-[13px] focus:border-[#FFD700] outline-none"
                data-testid="select-p2p-network"
              >
                <option value="BEP20">BEP20 (BSC · Binance Smart Chain)</option>
                <option value="ERC20">ERC20 (Ethereum)</option>
                <option value="TRC20">TRC20 (Tron)</option>
                <option value="SOL">Solana</option>
                <option value="POLYGON">Polygon</option>
              </select>

              {network !== "BEP20" ? (
                <div
                  className="mt-3 rounded-lg border border-[#FFD700]/40 bg-[#FFD700]/5 p-3 text-center"
                  data-testid="p2p-coming-soon"
                >
                  <div className="text-[#FFD700] font-bold text-sm">Coming Soon</div>
                  <div className="text-[11px] text-[#8B9BB4] mt-1">
                    {network} liquidity is not available yet. Only BEP20 is supported today.
                  </div>
                </div>
              ) : (
                <>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-[#8B9BB4] mt-3 mb-1">
                    Recipient Address
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Paste address or scan QR"
                      className="flex-1 px-3 py-2.5 rounded-lg bg-[#0B1220] border border-white/10 text-white text-[13px] font-mono focus:border-[#FFD700] outline-none"
                      data-testid="input-p2p-address"
                    />
                    <button
                      onClick={startScan}
                      className="px-3 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/40 text-[#FFD700] hover:bg-[#FFD700]/20 transition"
                      data-testid="btn-scan-p2p-qr"
                      type="button"
                    >
                      <QrCode size={18} />
                    </button>
                  </div>
                  {scanning && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-[#FFD700]/40 bg-black">
                      <div id="qr-reader" ref={qrRef} className="w-full" />
                      <button
                        onClick={stopScan}
                        className="w-full py-1.5 text-[11px] font-semibold bg-[#0B1220] text-[#FF3B3B] border-t border-white/10"
                        data-testid="btn-stop-scan-p2p"
                      >
                        Cancel scan
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Amount + Send (shown unless coming-soon banner is active) */}
          {!(p2pMode === "address" && network !== "BEP20") && (
            <>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#8B9BB4] mt-3 mb-1">
                Amount (USDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0B1220] border border-white/10 text-white text-lg font-semibold focus:border-[#FFD700] outline-none"
                data-testid="input-p2p-amount"
              />
              <div className="text-[10px] text-[#8B9BB4] mt-1">
                Available: <span className="text-white">{fmtUSD(balance)}</span>
              </div>
              <button
                onClick={doP2P}
                disabled={loading}
                className="mt-4 w-full py-3 rounded-lg bg-[#FFD700] text-black font-bold text-sm disabled:opacity-40"
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
