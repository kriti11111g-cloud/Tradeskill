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
import { BnbLogo, PolygonLogo, TronLogo, TetherLogo } from "@/components/CryptoLogos";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const GOLD = "#F5C518";
const NETWORKS = [
  { id: "BEP20", name: "BSC · BEP20", Logo: BnbLogo },
  { id: "POLYGON", name: "Polygon", Logo: PolygonLogo },
  { id: "TRC20", name: "TRON", Logo: TronLogo, soon: true },
];
const STEPS = ["Request", "Email OTP", "Verify OTP", "Password", "Success"];

const GmailIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill="#EA4335" d="M5.27 5.3L12 10.34 18.73 5.3H5.27z" />
    <path fill="#FBBC04" d="M2 6.6v10.8c0 .88.72 1.6 1.6 1.6H6V9.6L2 6.6z" />
    <path fill="#34A853" d="M18 19h2.4c.88 0 1.6-.72 1.6-1.6V6.6l-4 3v9.4z" />
    <path fill="#4285F4" d="M6 19h12V9.6l-6 4.5-6-4.5V19z" />
    <path fill="#C5221F" d="M2 6.6l4 3V5.3L4.05 3.85C3.14 3.17 2 3.82 2 4.95V6.6zM22 6.6V4.95c0-1.13-1.14-1.78-2.05-1.1L18 5.3v4.3l4-3z" />
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
          className="w-full aspect-square max-w-[46px] text-center text-lg font-black rounded-xl bg-[#0E2E1D] border border-[#F5C518]/30 text-white focus:border-[#F5C518] focus:shadow-[0_0_12px_rgba(245,197,24,0.35)] outline-none transition disabled:opacity-50"
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
  const [success, setSuccess] = useState(null); // {amount, net, network, address}
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
    if (!password) return toast.error("Enter your login password");
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

  const label = "block text-[10px] tracking-[0.22em] uppercase font-bold text-[#F5C518] mb-1.5";
  const inputCls =
    "w-full px-3.5 py-3 rounded-xl bg-[#0E2E1D] border border-[#F5C518]/25 text-white text-[13px] placeholder:text-[#6E8F7D] focus:border-[#F5C518] focus:shadow-[0_0_14px_rgba(245,197,24,0.25)] outline-none transition";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="dialog-withdraw"
    >
      <div
        className="w-full max-w-[440px] max-h-[92vh] overflow-y-auto rounded-3xl p-5 border"
        style={{
          background: "linear-gradient(180deg, #0B2A1B 0%, #071D12 100%)",
          borderColor: "rgba(245,197,24,0.45)",
          boxShadow: "0 0 40px rgba(34,197,94,0.25), 0 0 24px rgba(245,197,24,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="text-center py-6" data-testid="withdraw-success">
            <div
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 copy-pop"
              style={{ background: "rgba(34,197,94,0.15)", border: "2px solid #22C55E", boxShadow: "0 0 30px rgba(34,197,94,0.4)" }}
            >
              <CheckCircle2 size={42} className="text-[#22C55E]" />
            </div>
            <div className="text-white font-black text-lg">Withdrawal Request Submitted</div>
            <div className="text-[#8FB89F] text-[12px] mt-1">Successfully — pending admin approval</div>
            <div className="mt-4 rounded-2xl bg-[#0E2E1D] border border-[#F5C518]/25 p-3.5 text-left space-y-1.5 text-[12px]">
              <div className="flex justify-between"><span className="text-[#8FB89F]">Amount</span><span className="text-white font-bold">{success.amount.toFixed(2)} USDT</span></div>
              <div className="flex justify-between"><span className="text-[#8FB89F]">You receive</span><span className="text-[#22C55E] font-bold">{Number(success.net).toFixed(2)} USDT</span></div>
              <div className="flex justify-between"><span className="text-[#8FB89F]">Network</span><span className="text-white font-bold">{success.network}</span></div>
              <div className="flex justify-between"><span className="text-[#8FB89F]">Address</span><span className="text-white font-mono">{success.address.slice(0, 8)}…{success.address.slice(-6)}</span></div>
            </div>
            <button
              onClick={onClose}
              className="mt-5 w-full py-3 rounded-xl font-black text-sm text-black"
              style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", border: `1.5px solid ${GOLD}`, boxShadow: "0 0 20px rgba(34,197,94,0.4)" }}
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
                <div className="text-white font-black text-2xl">Withdraw</div>
                <div className="text-[#8FB89F] text-[11px]">Withdraw your funds to your wallet</div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#F5C518]/40 text-[#F5C518] hover:bg-[#F5C518]/10"
                data-testid="btn-close-withdraw"
              >
                <X size={16} />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-center mt-4 mb-4" data-testid="withdraw-stepper">
              {STEPS.map((s, i) => {
                const n = i + 1;
                const active = step >= n;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && (
                      <div
                        className="absolute top-[13px] right-1/2 w-full h-[2px]"
                        style={{ background: step >= n ? GOLD : "rgba(245,197,24,0.15)" }}
                      />
                    )}
                    <div
                      className="relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-300"
                      style={{
                        background: active ? "rgba(34,197,94,0.2)" : "#0E2E1D",
                        border: `1.5px solid ${active ? GOLD : "rgba(245,197,24,0.25)"}`,
                        color: active ? GOLD : "#6E8F7D",
                        boxShadow: step === n ? "0 0 12px rgba(245,197,24,0.5)" : "none",
                      }}
                    >
                      {n}
                    </div>
                    <div className={`text-[8px] mt-1 font-bold ${active ? "text-[#F5C518]" : "text-[#6E8F7D]"}`}>{s}</div>
                  </div>
                );
              })}
            </div>

            {/* Balance card */}
            <div
              className="rounded-2xl p-3.5 flex items-center justify-between border mb-4"
              style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(245,197,24,0.35)", boxShadow: "inset 0 0 24px rgba(34,197,94,0.08)" }}
              data-testid="withdraw-balance-card"
            >
              <div className="flex items-center gap-2.5">
                <TetherLogo size={34} />
                <div>
                  <div className="text-[#8FB89F] text-[10px] uppercase tracking-widest font-bold">Wallet Balance</div>
                  <div className="text-white font-black text-xl leading-tight">
                    {Number(balance).toFixed(2)} <span className="text-[12px] text-[#F5C518]">USDT</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end text-[#F5C518]">
                  <ShieldCheck size={13} />
                  <span className="text-[11px] font-bold">Secure &amp; Safe</span>
                </div>
                <div className="text-[9px] text-[#8FB89F]">
                  Funds <span className="text-[#22C55E] font-bold">100%</span> protected
                </div>
              </div>
            </div>

            {/* Network */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <Globe size={12} className="text-[#F5C518]" />
              <span className={label + " mb-0"}>Network</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-3.5">
              {NETWORKS.map((n) => {
                const active = network === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setNetwork(n.id)}
                    className="relative flex flex-col items-center gap-1 rounded-xl py-2 border transition-all duration-300 active:scale-95"
                    style={{
                      borderColor: active ? GOLD : "rgba(245,197,24,0.18)",
                      background: active ? "rgba(34,197,94,0.12)" : "#0E2E1D",
                      boxShadow: active ? "0 0 14px rgba(34,197,94,0.35)" : "none",
                    }}
                    data-testid={`withdraw-net-${n.id.toLowerCase()}`}
                  >
                    <n.Logo size={20} />
                    <span className={`text-[9px] font-bold ${active ? "text-[#F5C518]" : "text-[#8FB89F]"}`}>{n.name}</span>
                    {n.soon && (
                      <span className="absolute -top-1.5 right-1 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-[#EF0027] text-white">Soon</span>
                    )}
                  </button>
                );
              })}
            </div>

            {soon ? (
              <div className="rounded-2xl border border-[#EF0027]/50 bg-[#EF0027]/10 p-4 text-center mb-3.5" data-testid="withdraw-coming-soon">
                <div className="text-[#FF5C5C] font-black text-sm uppercase tracking-widest">Coming Soon</div>
                <div className="text-[11px] text-[#8FB89F] mt-1">TRON (TRC20) withdrawals are not available yet. Use BSC or Polygon.</div>
              </div>
            ) : (
              <>
                {/* Address */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <User size={12} className="text-[#F5C518]" />
                  <span className={label + " mb-0"}>Recipient Address</span>
                </div>
                <div className="flex gap-2 mb-3.5">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value.trim())}
                    placeholder="Paste USDT address or scan"
                    className={inputCls + " font-mono flex-1"}
                    data-testid="input-withdraw-address"
                  />
                  <button
                    onClick={startScan}
                    className="px-3.5 rounded-xl border border-[#F5C518]/40 text-[#F5C518] hover:bg-[#F5C518]/10 flex flex-col items-center justify-center gap-0.5"
                    data-testid="btn-scan-qr"
                    type="button"
                  >
                    <QrCode size={16} />
                    <span className="text-[8px] font-bold">Scan</span>
                  </button>
                </div>
                {address && !validAddress && (
                  <div className="text-[10px] text-[#FF5C5C] -mt-2.5 mb-3">Invalid address — must start with 0x (42 characters)</div>
                )}
                {scanning && (
                  <div className="mb-3.5 rounded-xl overflow-hidden border border-[#F5C518]/40 bg-black">
                    <div id="wd-qr-reader" className="w-full" />
                    <button onClick={stopScan} className="w-full py-1.5 text-[11px] font-semibold bg-[#0E2E1D] text-[#FF5C5C]" data-testid="btn-stop-scan">
                      Cancel scan
                    </button>
                  </div>
                )}

                {/* Amount */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Coins size={12} className="text-[#F5C518]" />
                  <span className={label + " mb-0"}>Amount (USDT)</span>
                </div>
                <div className="relative mb-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="How much to send"
                    className={inputCls + " text-lg font-bold pr-14"}
                    data-testid="input-withdraw-amount"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8FB89F] text-[12px] font-bold">USDT</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => setAmount((Math.floor(balance * p) / 100).toFixed(2))}
                      className="py-1.5 text-[11px] font-bold rounded-lg border transition active:scale-95"
                      style={{
                        borderColor: p === 100 ? GOLD : "rgba(245,197,24,0.25)",
                        color: p === 100 ? GOLD : "#8FB89F",
                        background: p === 100 ? "rgba(245,197,24,0.08)" : "transparent",
                      }}
                      data-testid={`btn-amount-${p}`}
                    >
                      {p === 100 ? "Max" : `${p}%`}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-[#8FB89F] mb-3.5">
                  Maximum Available: <span className="text-[#22C55E] font-bold">{Number(balance).toFixed(2)} USDT</span>
                  {amt >= 10 && (
                    <span> · You receive: <span className="text-[#F5C518] font-bold">{Math.max(0, amt - 2).toFixed(2)} USDT</span> (fee 2 USDT)</span>
                  )}
                </div>

                {/* Gmail OTP */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Mail size={12} className="text-[#F5C518]" />
                  <span className={label + " mb-0"}>Receive OTP on Gmail</span>
                </div>
                <div className="flex gap-2 mb-1.5">
                  <div className={inputCls + " flex-1 flex items-center text-[#CDE7D8]"} data-testid="withdraw-masked-email">
                    {mask}
                  </div>
                  <button
                    onClick={getOtp}
                    disabled={loading || resendIn > 0}
                    className="px-3.5 rounded-xl font-black text-[12px] text-black flex items-center gap-1.5 disabled:opacity-45 transition active:scale-95"
                    style={{ background: "linear-gradient(135deg, #F5C518, #E8B004)", boxShadow: "0 0 16px rgba(245,197,24,0.35)" }}
                    data-testid="btn-get-otp"
                  >
                    <GmailIcon size={14} />
                    {otpSent ? (resendIn > 0 ? `${resendIn}s` : "Resend") : "Get OTP"}
                  </button>
                </div>
                <div className="text-[9px] text-[#8FB89F] mb-3">ⓘ OTP will be sent to your Gmail address</div>
                {demoOtp && !otpVerified && (
                  <div className="mb-3 rounded-lg border border-[#F5C518]/40 bg-[#F5C518]/10 px-3 py-2 text-[11px] text-[#F5C518] font-bold" data-testid="demo-otp-note">
                    DEMO MODE — Your OTP: <span className="font-mono text-white tracking-[0.3em]">{demoOtp}</span>
                  </div>
                )}

                {otpSent && (
                  <div className="mb-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield size={12} className="text-[#F5C518]" />
                      <span className={label + " mb-0"}>Enter OTP</span>
                      {otpVerified && (
                        <span className="ml-auto flex items-center gap-1 text-[#22C55E] text-[10px] font-black" data-testid="otp-verified-badge">
                          <CheckCircle2 size={12} /> VERIFIED
                        </span>
                      )}
                    </div>
                    <OtpBoxes value={otp} onChange={setOtp} disabled={otpVerified} />
                  </div>
                )}

                {/* Password */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lock size={12} className="text-[#F5C518]" />
                  <span className={label + " mb-0"}>Login / Transaction Password</span>
                </div>
                <div className="relative mb-4">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Confirm with your password"
                    className={inputCls + " pr-11"}
                    data-testid="input-withdraw-password"
                  />
                  <button
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#F5C518]"
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
                  className="w-full py-3.5 rounded-2xl font-black text-[14px] uppercase tracking-wider text-white transition active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #1DB954, #0E8A3C)",
                    border: `1.5px solid ${GOLD}`,
                    boxShadow: "0 0 22px rgba(34,197,94,0.45), 0 0 10px rgba(245,197,24,0.25)",
                  }}
                  data-testid="btn-confirm-withdraw"
                >
                  <ShieldCheck size={17} className="text-[#F5C518]" />
                  {loading ? "Processing..." : "Submit Withdrawal Request"}
                </button>
                <div className="text-center text-[9px] text-[#8FB89F] mt-1.5">Review details and submit your request</div>

                {/* Security badges */}
                <div className="grid grid-cols-4 gap-1.5 mt-4 pt-3.5 border-t border-[#F5C518]/15" data-testid="withdraw-security-badges">
                  {[
                    { Icon: Lock, t: "Secure", s: "256-bit SSL" },
                    { Icon: Zap, t: "Fast", s: "1–5 Minutes" },
                    { Icon: Headphones, t: "Reliable", s: "24/7 Support" },
                    { Icon: Shield, t: "Protected", s: "Funds Safe" },
                  ].map(({ Icon, t, s }) => (
                    <div key={t} className="flex flex-col items-center text-center gap-0.5">
                      <Icon size={14} className="text-[#F5C518]" />
                      <div className="text-[9px] font-black text-white">{t}</div>
                      <div className="text-[8px] text-[#8FB89F] leading-tight">{s}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
