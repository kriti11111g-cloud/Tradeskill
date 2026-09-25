import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronDown, User, Mail, Phone, Lock, ShieldCheck,
  UserPlus, Share2, Eye, EyeOff, ArrowRight, QrCode, CheckCircle2, X,
} from "lucide-react";
import jsQR from "jsqr";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";

const LOGO = "https://static.prod-images.emergentagent.com/jobs/e3103ddd-0dc9-4cf2-8d94-ea48e4389b5b/images/2fc173585b6a7c8ae03589e9d69e196865e3322126777cf481e10020b4b21714.jpeg";
const GRAD = "linear-gradient(90deg, #16A34A 0%, #2563EB 100%)";
const COUNTRIES = [
  { code: "+91", flag: "🇮🇳" }, { code: "+1", flag: "🇺🇸" }, { code: "+44", flag: "🇬🇧" },
  { code: "+971", flag: "🇦🇪" }, { code: "+61", flag: "🇦🇺" }, { code: "+65", flag: "🇸🇬" },
  { code: "+977", flag: "🇳🇵" }, { code: "+880", flag: "🇧🇩" },
];

const FIELD = { background: "#fff", border: "1px solid var(--border)", borderRadius: "16px" };

function QRScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  useEffect(() => {
    let stream, raf, stop = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (stop) return;
      const v = videoRef.current;
      if (v && v.readyState === 4) {
        canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(img.data, img.width, img.height);
        if (qr && qr.data) {
          let code = qr.data.trim();
          try {
            const u = new URL(code);
            code = u.searchParams.get("ref") || code;
          } catch { /* raw code */ }
          onResult(code.toUpperCase());
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
          raf = requestAnimationFrame(tick);
        }
      })
      .catch(() => { toast.error("Camera access denied"); onClose(); });
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onResult, onClose]);
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center px-6" data-testid="qr-scanner-modal">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden bg-black relative">
        <video ref={videoRef} className="w-full aspect-square object-cover" muted playsInline />
        <div className="absolute inset-8 border-2 border-white/70 rounded-2xl pointer-events-none" />
        <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-white" data-testid="qr-close">
          <X size={18} />
        </button>
        <div className="absolute bottom-3 inset-x-0 text-center text-white text-xs font-bold">Scan referral QR code</div>
      </div>
    </div>
  );
}

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: "", email: "", mobile: "", password: "", transaction_password: "",
    referral_code: (params.get("ref") || "").toUpperCase(),
  });
  const [cc, setCc] = useState("+91");
  const [leg, setLeg] = useState("");
  const [legOpen, setLegOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showTxn, setShowTxn] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verified, setVerified] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async () => {
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { toast.error("Enter a valid email first"); return; }
    try {
      const { data } = await api.post("/auth/signup-otp/send", { email: form.email.trim().toLowerCase() });
      setOtpOpen(true); setVerified(false); setOtp(["", "", "", "", "", ""]);
      setResendIn(data.resend_in || 60);
      if (data.demo_otp) toast.info(`Demo OTP: ${data.demo_otp}`);
      else toast.success(`OTP sent to ${data.email_masked}`);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const onOtpChange = async (i, val) => {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[i] = d;
    setOtp(next);
    if (d && i < 5) otpRefs.current[i + 1]?.focus();
    const code = next.join("");
    if (code.length === 6) {
      try {
        await api.post("/auth/signup-otp/verify", { email: form.email.trim().toLowerCase(), code });
        setVerified(true);
        toast.success("Email verified");
      } catch (err) {
        toast.error(formatApiError(err));
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      }
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!verified) { toast.error("Please verify your email with OTP"); return; }
    if (!form.mobile.trim()) { toast.error("Enter your mobile number"); return; }
    if (!form.transaction_password) { toast.error("Set a transaction password"); return; }
    if (!leg) { toast.error("Please select your leg (Left / Right)"); return; }
    if (!agree) { toast.error("Please agree to Terms & Conditions"); return; }
    setLoading(true);
    try {
      await register({
        ...form,
        email: form.email.trim().toLowerCase(),
        country_code: cc,
        leg,
      });
      toast.success("Account created!");
      nav("/");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  const iconCls = "shrink-0 text-[#0F172A]";

  return (
    <div className="min-h-screen w-full flex justify-center relative overflow-hidden" style={{ background: "#F7FAFC" }}>
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle, #22C55E, transparent 70%)" }} />
      <div className="absolute top-40 -left-24 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #3B82F6, transparent 70%)" }} />

      <div className="w-full max-w-md z-10 px-5 pb-10">
        <button onClick={() => nav("/login")} className="mt-4 w-9 h-9 flex items-center justify-center" data-testid="signup-back" style={{ touchAction: "manipulation" }}>
          <ChevronLeft size={30} strokeWidth={2.6} className="text-[#0F172A]" />
        </button>

        {/* Logo */}
        <div className="flex flex-col items-center -mt-2">
          <div className="w-28 h-28 rounded-full overflow-hidden" style={{ boxShadow: "0 0 24px rgba(34,197,94,0.35)" }}>
            <img src={LOGO} alt="Trade Skill" className="w-full h-full object-cover" style={{ transform: "scale(1.55)" }} />
          </div>
          <div className="font-display font-black text-[32px] leading-tight mt-2 text-[#0F172A]">
            Trade <span style={{ color: "#14B8A6" }}>Skill</span>
          </div>
          <div className="text-[12px] font-bold tracking-[0.35em] text-[#334155] mt-0.5">CREATE YOUR ACCOUNT</div>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          {/* Name */}
          <div className="flex items-center gap-3 px-4 py-3.5" style={FIELD}>
            <User size={22} className={iconCls} />
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your Name" required
              className="flex-1 bg-transparent outline-none text-[15px] text-[#0F172A] placeholder:text-[#94A3B8]"
              data-testid="signup-name" />
          </div>

          {/* Email + OTP */}
          <div style={{ ...FIELD, background: otpOpen ? "linear-gradient(180deg,#fff, #F0FDF4)" : "#fff" }}>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <Mail size={22} className={iconCls} />
              <input type="email" value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); setVerified(false); setOtpOpen(false); }}
                placeholder="Email" required disabled={verified}
                className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#0F172A] placeholder:text-[#94A3B8]"
                data-testid="signup-email" />
              {!verified && (
                <button type="button" onClick={sendOtp} disabled={resendIn > 0}
                  className="shrink-0 text-white text-[13px] font-black px-4 py-2 rounded-full select-none"
                  style={{ background: GRAD, opacity: resendIn > 0 ? 0.6 : 1, touchAction: "manipulation" }}
                  data-testid="signup-send-otp">
                  {resendIn > 0 ? `${resendIn}s` : "Send OTP"}
                </button>
              )}
              {verified && <CheckCircle2 size={24} className="text-[#16A34A] shrink-0" />}
            </div>
            {otpOpen && !verified && (
              <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
                {otp.map((d, i) => (
                  <input key={i} ref={(el) => (otpRefs.current[i] = el)} value={d} inputMode="numeric"
                    onChange={(e) => onOtpChange(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                    className="w-9 h-11 text-center text-lg font-black rounded-lg outline-none text-[#0F172A]"
                    style={{ background: "#fff", border: "1px solid var(--border)" }}
                    data-testid={`signup-otp-${i}`} />
                ))}
              </div>
            )}
            {otpOpen && verified && (
              <div className="flex items-center gap-2 px-4 pb-3" data-testid="signup-verified">
                <CheckCircle2 size={20} className="text-[#16A34A]" />
                <span className="text-[15px] font-black text-[#16A34A]">Verified</span>
              </div>
            )}
          </div>

          {/* Country code + Mobile */}
          <div className="flex items-center px-3 py-3" style={FIELD}>
            <select value={cc} onChange={(e) => setCc(e.target.value)}
              className="bg-transparent outline-none text-[15px] font-bold text-[#0F172A] pr-1"
              data-testid="signup-cc">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <div className="w-px h-7 mx-2.5" style={{ background: "var(--border)" }} />
            <Phone size={20} className={iconCls} />
            <input value={form.mobile} inputMode="tel"
              onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/[^\d]/g, "") })}
              placeholder="Mobile Number" required
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] ml-3 text-[#0F172A] placeholder:text-[#94A3B8]"
              data-testid="signup-mobile" />
          </div>

          {/* Password */}
          <div className="flex items-center gap-3 px-4 py-3.5" style={FIELD}>
            <Lock size={22} className={iconCls} />
            <input type={showPw ? "text" : "password"} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password" required minLength={6}
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#0F172A] placeholder:text-[#94A3B8]"
              data-testid="signup-password" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="shrink-0" data-testid="signup-pw-eye" style={{ touchAction: "manipulation" }}>
              {showPw ? <EyeOff size={22} className={iconCls} /> : <Eye size={22} className={iconCls} />}
            </button>
          </div>

          {/* Transaction Password */}
          <div className="flex items-center gap-3 px-4 py-3.5" style={FIELD}>
            <ShieldCheck size={22} className={iconCls} />
            <input type={showTxn ? "text" : "password"} value={form.transaction_password}
              onChange={(e) => setForm({ ...form, transaction_password: e.target.value })}
              placeholder="Transaction Password" required minLength={4}
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#0F172A] placeholder:text-[#94A3B8]"
              data-testid="signup-txn-password" />
            <button type="button" onClick={() => setShowTxn(!showTxn)} className="shrink-0" data-testid="signup-txn-eye" style={{ touchAction: "manipulation" }}>
              {showTxn ? <EyeOff size={22} className={iconCls} /> : <Eye size={22} className={iconCls} />}
            </button>
          </div>

          {/* Referral + QR */}
          <div className="flex items-center gap-3 px-4 py-3.5" style={FIELD}>
            <UserPlus size={22} className={iconCls} />
            <input value={form.referral_code}
              onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })}
              placeholder="Referral Code (Optional)"
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#0F172A] placeholder:text-[#94A3B8]"
              data-testid="signup-referral" />
            <button type="button" onClick={() => setQrOpen(true)} className="shrink-0" data-testid="signup-qr-btn" style={{ touchAction: "manipulation" }}>
              <QrCode size={24} className={iconCls} />
            </button>
          </div>

          {/* Select Your Leg */}
          <div className="relative">
            <button type="button" onClick={() => setLegOpen(!legOpen)}
              className="w-full flex items-center gap-3 px-4 py-3.5" style={{ ...FIELD, touchAction: "manipulation" }}
              data-testid="signup-leg">
              <Share2 size={22} className={iconCls} />
              <span className={`flex-1 text-left text-[15px] ${leg ? "text-[#0F172A] font-bold" : "text-[#94A3B8]"}`}>
                {leg ? (leg === "left" ? "Left" : "Right") : "Select Your Leg"}
              </span>
              <ChevronDown size={22} className={iconCls} style={{ transform: legOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {legOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid var(--border)", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
                {["left", "right"].map((v) => (
                  <button key={v} type="button"
                    onClick={() => { setLeg(v); setLegOpen(false); }}
                    className="w-full text-left px-5 py-3 text-[15px] font-bold text-[#0F172A] hover:bg-[#F0FDF4]"
                    style={{ touchAction: "manipulation" }}
                    data-testid={`signup-leg-${v}`}>
                    {v === "left" ? "Left" : "Right"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Terms */}
          <label className="flex items-center gap-3 px-1 pt-1 cursor-pointer select-none" style={{ touchAction: "manipulation" }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
              className="w-5 h-5 rounded-md accent-[#16A34A]" data-testid="signup-agree" />
            <span className="text-[15px] text-[#0F172A]">
              I agree to <span className="font-bold" style={{ color: "#2563EB" }}>Terms &amp; Conditions</span>
            </span>
          </label>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full text-white font-display font-black text-lg rounded-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-60 select-none"
            style={{ background: GRAD, touchAction: "manipulation" }}
            data-testid="signup-submit">
            {loading ? "Creating..." : "Create Account"} <ArrowRight size={20} strokeWidth={2.6} />
          </button>
        </form>
      </div>

      {qrOpen && (
        <QRScanner
          onResult={(code) => { setForm((f) => ({ ...f, referral_code: code })); setQrOpen(false); toast.success("Referral code filled from QR"); }}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  );
}
