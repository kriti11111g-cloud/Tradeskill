import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  X,
  QrCode,
  Lock,
  Zap,
  Headphones,
  ShieldCheck,
  Shield,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Globe,
  User,
  Coins,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { BnbLogo, PolygonLogo, TronLogo } from "@/components/CryptoLogos";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const GOLD_BORDER = "rgba(212,160,23,0.45)";
const GOLD_SOFT = "rgba(245,158,11,0.28)";
const NETWORKS = [
  { id: "BEP20", name: "BSC · BEP20", Logo: BnbLogo },
  { id: "POLYGON", name: "Polygon", Logo: PolygonLogo },
  { id: "TRC20", name: "TRON", Logo: TronLogo, soon: true },
];
const STEPS = ["Request", "Email OTP", "Verify OTP", "Password", "Success"];

const GmailIcon = ({ size = 15 }) => (
  <svg width={size} height={Math.round(size * 0.75)} viewBox="52 42 88 66">
    <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
    <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
    <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
    <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
    <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
  </svg>
);

const OtpBoxes = ({ value, onChange, disabled }) => {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");
  const setDigit = (i, d) => {
    const arr = digits.slice();
    arr[i] = d;
    onChange(arr.join(""));
    if (d && i < 5) refs.current[i + 1]?.focus();
  };
  return (
    <div className="flex gap-1.5" data-testid="otp-boxes">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          disabled={disabled}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
            if (t.length > 1) {
              e.preventDefault();
              onChange(t);
              refs.current[Math.min(t.length, 5)]?.focus();
            }
          }}
          inputMode="numeric"
          className="w-full aspect-square max-w-[42px] text-center text-base font-black rounded-lg bg-[color:var(--surface-3)] text-[color:var(--text)] outline-none transition disabled:opacity-50 border focus:shadow-[0_0_12px_rgba(245,158,11,0.35)]"
          style={{ borderColor: GOLD_BORDER }}
          data-testid={`otp-box-${i}`}
        />
      ))}
    </div>
  );
};

export default function WithdrawModal({ balance, onClose, onSubmitted }) {
  const { user } = useAuth();
  const [network, setNetwork] = useState("BEP20");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [demoOtp, setDemoOtp] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  const amt = parseFloat(amount) || 0;
  const validAddress = address.startsWith("0x") && address.length === 42;
  const step = success ? 5 : otpVerified ? 4 : otpSent ? 3 : validAddress && amt >= 10 ? 2 : 1;
  const soon = network === "TRC20";
  const mask =
    maskedEmail ||
    (() => {
      const [n, d] = (user?.email || "").split("@");
      return d ? `${(n || "").slice(0, 2)}***@${d}` : "";
    })();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const stopScan = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const startScan = () => {
    setScanning(true);
    setTimeout(async () => {
      try {
        const sc = new Html5Qrcode("wd-qr-reader");
        scannerRef.current = sc;
        await sc.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            setAddress(decoded);
            toast.success("Address scanned");
            stopScan();
          },
          () => {},
        );
      } catch {
        toast.error("Camera access denied");
        setScanning(false);
      }
    }, 80);
  };

  const getOtp = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/bot-wallet/withdraw/otp/request");
      setOtpSent(true);
      setOtpVerified(false);
      setOtp("");
      setResendIn(data.resend_in || 60);
      setMaskedEmail(data.email_masked || "");
      if (data.demo_otp) {
        setDemoOtp(data.demo_otp);
        toast.info(`DEMO MODE — OTP: ${data.demo_otp}`);
      } else {
        toast.success("OTP sent to your Gmail");
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (code) => {
    setLoading(true);
    try {
      await api.post("/bot-wallet/withdraw/otp/verify", { code });
      setOtpVerified(true);
      toast.success("OTP verified ✅");
    } catch (e) {
      toast.error(formatApiError(e));
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (otp.length === 6 && !otpVerified && !loading) verifyOtp(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const submit = async () => {
    if (soon) return;
    if (!validAddress) return toast.error("Enter a valid wallet address");
    if (amt < 10) return toast.error("Minimum withdrawal is $10 USDT");
    if (!otpVerified) return toast.error("Verify the Gmail OTP first");
    if (!password) return toast.error("Enter your transaction password");
    setLoading(true);
    try {
      const { data } = await api.post("/bot-wallet/withdraw", {
        amount: amt,
        address,
        network,
        password,
      });
      setSuccess({ amount: amt, net: data.net_amount, network, address });
      await onSubmitted?.();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const label = "block text-[10px] tracking-[0.22em] uppercase font-bold text-[color:var(--gold-deep,#D97706)] mb-1";
  const inputCls =
    "w-full px-3 py-1.5 rounded-lg bg-[color:var(--surface-3)] border text-[color:var(--text)] text-[13px] placeholder:text-[color:var(--text-mute)] outline-none transition focus:shadow-[0_0_14px_rgba(245,158,11,0.22)]";
  const inputStyle = { borderColor: GOLD_SOFT };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm py-4 px-4"
      onClick={onClose}
      data-testid="dialog-withdraw"
    >
      <div
        className="w-full max-w-[440px] max-h-[88vh] overflow-y-auto overscroll-contain rounded-2xl p-4 border bg-[color:var(--surface)]"
        style={{
          borderColor: GOLD_BORDER,
          boxShadow: "0 18px 50px rgba(22,163,74,0.18), 0 0 24px rgba(245,158,11,0.12)",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="text-center py-6" data-testid="withdraw-success">
            <div
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 copy-pop"
              style={{ background: "rgba(22,163,74,0.1)", border: "2px solid var(--good)", boxShadow: "0 0 30px rgba(22,163,74,0.3)" }}
            >
              <CheckCircle2 size={42} className="text-[color:var(--good)]" />
            </div>
            <div className="text-[color:var(--text)] font-black text-base">Withdrawal Request Submitted</div>
            <div className="text-[color:var(--text-mute)] text-[12px] mt-1">Success! Processing — USDT will reach your wallet in just a few seconds ⚡</div>
            <div className="mt-4 rounded-2xl bg-[color:var(--surface-3)] border p-3.5 text-left space-y-1.5 text-[12px]" style={{ borderColor: GOLD_SOFT }}>
              <div className="flex justify-between"><span className="text-[color:var(--text-mute)]">Amount</span><span className="text-[color:var(--text)] font-bold">{success.amount.toFixed(2)} USDT</span></div>
              <div className="flex justify-between"><span className="text-[color:var(--text-mute)]">You receive</span><span className="text-[color:var(--good)] font-bold">{Number(success.net).toFixed(2)} USDT</span></div>
              <div className="flex justify-between"><span className="text-[color:var(--text-mute)]">Network</span><span className="text-[color:var(--text)] font-bold">{success.network}</span></div>
              <div className="flex justify-between"><span className="text-[color:var(--text-mute)]">Address</span><span className="text-[color:var(--text)] font-mono">{success.address.slice(0, 8)}…{success.address.slice(-6)}</span></div>
            </div>
            <button
              onClick={onClose}
              className="mt-5 w-full py-3 rounded-xl font-black text-sm text-white"
              style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", border: `1.5px solid ${GOLD_BORDER}`, boxShadow: "0 8px 22px rgba(22,163,74,0.35)" }}
              data-testid="btn-withdraw-done"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[color:var(--text)] font-black text-base">Withdraw</div>
                <div className="text-[color:var(--text-mute)] text-[11px]">Withdraw your funds to your wallet</div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center border text-[color:var(--gold-deep,#D97706)] hover:bg-[color:var(--gold)]/10"
                style={{ borderColor: GOLD_BORDER }}
                data-testid="btn-close-withdraw"
              >
                <X size={15} />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-center mt-2 mb-2" data-testid="withdraw-stepper">
              {STEPS.map((s, i) => {
                const n = i + 1;
                const active = step >= n;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && (
                      <div
                        className="absolute top-[11px] right-1/2 w-full h-[2px]"
                        style={{ background: step >= n ? "var(--gold)" : "var(--border-soft)" }}
                      />
                    )}
                    <div
                      className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300"
                      style={{
                        background: active ? "rgba(22,163,74,0.1)" : "var(--surface-3)",
                        border: `1.5px solid ${active ? "var(--gold)" : GOLD_SOFT}`,
                        color: active ? "var(--gold-deep, #D97706)" : "var(--text-mute)",
                        boxShadow: step === n ? "0 0 12px rgba(245,158,11,0.45)" : "none",
                      }}
                    >
                      {n}
                    </div>
                    <div className={`text-[8px] mt-1 font-bold ${active ? "text-[color:var(--gold-deep,#D97706)]" : "text-[color:var(--text-mute)]"}`}>{s}</div>
                  </div>
                );
              })}
            </div>

            {/* Network */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <Globe size={12} className="text-[color:var(--gold-deep,#D97706)]" />
              <span className={label + " mb-0"}>Network</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-1.5">
              {NETWORKS.map((n) => {
                const active = network === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setNetwork(n.id)}
                    className="relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 border transition-all duration-300 active:scale-95 bg-[color:var(--surface)]"
                    style={{
                      borderColor: active ? "var(--gold)" : "var(--border-soft)",
                      background: active ? "rgba(22,163,74,0.06)" : undefined,
                      boxShadow: active ? "0 0 14px rgba(22,163,74,0.25)" : "none",
                    }}
                    data-testid={`withdraw-net-${n.id.toLowerCase()}`}
                  >
                    <n.Logo size={20} />
                    <span className={`text-[9px] font-bold ${active ? "text-[color:var(--good)]" : "text-[color:var(--text-mute)]"}`}>{n.name}</span>
                    {n.soon && (
                      <span className="absolute -top-1.5 right-1 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-[#EF0027] text-white">Soon</span>
                    )}
                  </button>
                );
              })}
            </div>

            {soon ? (
              <div className="rounded-2xl border border-[#EF0027]/40 bg-[#EF0027]/5 p-4 text-center mb-3.5" data-testid="withdraw-coming-soon">
                <div className="text-[#EF0027] font-black text-sm uppercase tracking-widest">Coming Soon</div>
                <div className="text-[11px] text-[color:var(--text-mute)] mt-1">TRON (TRC20) withdrawals are not available yet. Use BSC or Polygon.</div>
              </div>
            ) : (
              <>
                {/* Address */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <User size={12} className="text-[color:var(--gold-deep,#D97706)]" />
                  <span className={label + " mb-0"}>Recipient Address</span>
                </div>
                <div className="flex gap-2 mb-1.5">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value.trim())}
                    placeholder="Paste USDT address or scan"
                    className={inputCls + " font-mono flex-1"}
                    style={inputStyle}
                    data-testid="input-withdraw-address"
                  />
                  <button
                    onClick={startScan}
                    className="px-3.5 rounded-xl border text-[color:var(--gold-deep,#D97706)] hover:bg-[color:var(--gold)]/10 flex flex-col items-center justify-center gap-0.5"
                    style={{ borderColor: GOLD_BORDER }}
                    data-testid="btn-scan-qr"
                    type="button"
                  >
                    <QrCode size={16} />
                    <span className="text-[8px] font-bold">Scan</span>
                  </button>
                </div>
                {address && !validAddress && (
                  <div className="text-[10px] text-[color:var(--bad)] -mt-2.5 mb-3">Invalid address — must start with 0x (42 characters)</div>
                )}
                {scanning && (
                  <div className="mb-3.5 rounded-xl overflow-hidden border bg-black" style={{ borderColor: GOLD_BORDER }}>
                    <div id="wd-qr-reader" className="w-full" />
                    <button onClick={stopScan} className="w-full py-1.5 text-[11px] font-semibold bg-[color:var(--surface)] text-[color:var(--bad)]" data-testid="btn-stop-scan">
                      Cancel scan
                    </button>
                  </div>
                )}

                {/* Amount */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Coins size={12} className="text-[color:var(--gold-deep,#D97706)]" />
                  <span className={label + " mb-0"}>Amount (USDT)</span>
                </div>
                <div className="relative mb-1.5">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="How much to send"
                    className={inputCls + " text-base font-bold pr-12"}
                    style={inputStyle}
                    data-testid="input-withdraw-amount"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--text-mute)] text-[12px] font-bold">USDT</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-1">
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => setAmount((Math.floor(balance * p) / 100).toFixed(2))}
                      className="py-1 text-[11px] font-bold rounded-md border transition active:scale-95"
                      style={{
                        borderColor: p === 100 ? "var(--gold)" : GOLD_SOFT,
                        color: p === 100 ? "var(--gold-deep, #D97706)" : "var(--text-mute)",
                        background: p === 100 ? "rgba(245,158,11,0.08)" : "transparent",
                      }}
                      data-testid={`btn-amount-${p}`}
                    >
                      {p === 100 ? "Max" : `${p}%`}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-[color:var(--text-mute)] mb-1.5">
                  Maximum Available: <span className="text-[color:var(--good)] font-bold">{Number(balance).toFixed(2)} USDT</span>
                  {amt >= 10 && (
                    <span> · You receive: <span className="text-[color:var(--gold-deep,#D97706)] font-bold">{Math.max(0, amt - 2).toFixed(2)} USDT</span> (fee 2 USDT)</span>
                  )}
                </div>

                {/* Gmail OTP */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Mail size={12} className="text-[color:var(--gold-deep,#D97706)]" />
                  <span className={label + " mb-0"}>Receive OTP on Gmail</span>
                </div>
                <div className="flex gap-2 mb-1.5">
                  <div className={inputCls + " flex-1 flex items-center"} style={inputStyle} data-testid="withdraw-masked-email">
                    {mask}
                  </div>
                  <button
                    onClick={getOtp}
                    disabled={loading || resendIn > 0}
                    className="px-3.5 rounded-xl font-black text-[12px] text-black flex items-center gap-1.5 disabled:opacity-45 transition active:scale-95"
                    style={{ background: "linear-gradient(135deg, #F5C518, #E8A804)", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}
                    data-testid="btn-get-otp"
                  >
                    <span className="bg-white rounded-[4px] p-[2px] flex items-center justify-center"><GmailIcon size={13} /></span>
                    {otpSent ? (resendIn > 0 ? `${resendIn}s` : "Resend") : "Get OTP"}
                  </button>
                </div>
                <div className="text-[9px] text-[color:var(--text-mute)] mb-1.5">ⓘ OTP will be sent to your Gmail address</div>
                {demoOtp && !otpVerified && (
                  <div className="mb-3 rounded-lg border px-3 py-2 text-[11px] font-bold text-[color:var(--gold-deep,#D97706)]" style={{ borderColor: GOLD_BORDER, background: "rgba(245,158,11,0.08)" }} data-testid="demo-otp-note">
                    DEMO MODE — Your OTP: <span className="font-mono text-[color:var(--text)] tracking-[0.3em]">{demoOtp}</span>
                  </div>
                )}

                {otpSent && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield size={12} className="text-[color:var(--gold-deep,#D97706)]" />
                      <span className={label + " mb-0"}>Enter OTP</span>
                      {otpVerified && (
                        <span className="ml-auto flex items-center gap-1 text-[color:var(--good)] text-[10px] font-black" data-testid="otp-verified-badge">
                          <CheckCircle2 size={12} /> VERIFIED
                        </span>
                      )}
                    </div>
                    <OtpBoxes value={otp} onChange={setOtp} disabled={otpVerified} />
                  </div>
                )}

                {/* Password */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lock size={12} className="text-[color:var(--gold-deep,#D97706)]" />
                  <span className={label + " mb-0"}>Transaction Password</span>
                </div>
                <div className="relative mb-2.5">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your transaction password"
                    className={inputCls + " pr-11"}
                    style={inputStyle}
                    data-testid="input-withdraw-password"
                  />
                  <button
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--gold-deep,#D97706)]"
                    type="button"
                    data-testid="btn-toggle-password"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Submit */}
                <button
                  onClick={submit}
                  disabled={loading || !validAddress || amt < 10 || !otpVerified || !password}
                  className="w-full py-2.5 rounded-xl font-black text-[14px] uppercase tracking-wider text-white transition active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #1DB954, #0E8A3C)",
                    border: "1.5px solid var(--gold)",
                    boxShadow: "0 8px 22px rgba(22,163,74,0.35), 0 0 10px rgba(245,158,11,0.2)",
                  }}
                  data-testid="btn-confirm-withdraw"
                >
                  <ShieldCheck size={17} className="text-[#FFE9A8]" />
                  {loading ? "Processing..." : "Submit Withdrawal Request"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
