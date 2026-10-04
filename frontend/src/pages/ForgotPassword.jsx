import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, KeyRound, ChevronLeft } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { TS_LOGO } from "./Login";

const GRAD = "linear-gradient(90deg, #22C55E 0%, #2563EB 100%)";
const FIELD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "14px" };

export default function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState("email"); // email | reset
  const [email, setEmail] = useState("");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendIn > 0]); // eslint-disable-line

  const sendOtp = async () => {
    if (!email.trim()) return toast.error("Email daalo");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot/send", { email: email.trim() });
      setMasked(data.email_masked || email.trim());
      setResendIn(data.resend_in || 60);
      setStep("reset");
      toast.success(`OTP sent to ${data.email_masked}`);
      if (data.demo_otp) toast.info(`Demo OTP: ${data.demo_otp}`);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  const resetPw = async (e) => {
    e.preventDefault();
    if (code.trim().length !== 6) return toast.error("6-digit OTP daalo");
    if (pw.length < 6) return toast.error("Password kam se kam 6 characters ka ho");
    if (pw !== pw2) return toast.error("Dono passwords match nahi kar rahe");
    setLoading(true);
    try {
      await api.post("/auth/forgot/reset", { email: email.trim(), code: code.trim(), new_password: pw });
      toast.success("Password reset successful! Ab naye password se login karo");
      nav("/login");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full flex justify-center relative overflow-hidden" style={{ background: "#060D0B" }}>
      <div className="absolute -top-24 right-0 w-[420px] h-[420px] rounded-full opacity-25 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #14532D, transparent 70%)" }} />
      <div className="w-full max-w-md z-10 px-6 flex flex-col justify-center min-h-screen pb-16">
        <button onClick={() => (step === "reset" ? setStep("email") : nav("/login"))}
          className="absolute top-5 left-4 w-10 h-10 flex items-center justify-center text-white/80"
          data-testid="forgot-back" style={{ touchAction: "manipulation" }}>
          <ChevronLeft size={28} />
        </button>

        <div className="flex flex-col items-center">
          <div className="w-28 h-28 rounded-full overflow-hidden" style={{ boxShadow: "0 0 40px rgba(34,197,94,0.25)" }}>
            <img src={TS_LOGO} alt="Trade Skill" className="w-full h-full object-cover" style={{ transform: "scale(1.55)" }} />
          </div>
          <div className="font-display font-black text-[28px] mt-4 text-white">Forgot Password</div>
          <div className="text-[13px] font-semibold text-white/60 mt-1 text-center">
            {step === "email"
              ? "Apna registered email daalo — hum OTP bhejenge"
              : `OTP bheja gaya: ${masked}`}
          </div>
        </div>

        {step === "email" ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3.5 px-4 py-4" style={FIELD}>
              <Mail size={22} className="text-white/80 shrink-0" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Registered Email" required
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-white placeholder:text-white/45"
                data-testid="forgot-email" />
            </div>
            <button onClick={sendOtp} disabled={loading}
              className="w-full text-white font-display font-black text-lg tracking-[0.1em] rounded-2xl py-4 disabled:opacity-60 select-none"
              style={{ background: GRAD, touchAction: "manipulation" }} data-testid="forgot-send-otp">
              {loading ? "SENDING..." : "SEND OTP"}
            </button>
          </div>
        ) : (
          <form onSubmit={resetPw} className="mt-8 space-y-4">
            <div className="flex items-center gap-3.5 px-4 py-4" style={FIELD}>
              <KeyRound size={22} className="text-white/80 shrink-0" />
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric" placeholder="6-digit OTP" required
                className="flex-1 min-w-0 bg-transparent outline-none text-[18px] tracking-[6px] font-black text-white placeholder:text-white/45 placeholder:tracking-normal placeholder:font-normal"
                data-testid="forgot-otp" />
            </div>
            <div className="flex items-center gap-3.5 px-4 py-4" style={FIELD}>
              <Lock size={22} className="text-white/80 shrink-0" />
              <input type={showPw ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)}
                placeholder="New Password" required
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-white placeholder:text-white/45"
                data-testid="forgot-new-pw" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="shrink-0" style={{ touchAction: "manipulation" }} data-testid="forgot-pw-eye">
                {showPw ? <EyeOff size={22} className="text-white/80" /> : <Eye size={22} className="text-white/80" />}
              </button>
            </div>
            <div className="flex items-center gap-3.5 px-4 py-4" style={FIELD}>
              <Lock size={22} className="text-white/80 shrink-0" />
              <input type={showPw ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)}
                placeholder="Confirm New Password" required
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-white placeholder:text-white/45"
                data-testid="forgot-confirm-pw" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full text-white font-display font-black text-lg tracking-[0.1em] rounded-2xl py-4 disabled:opacity-60 select-none"
              style={{ background: GRAD, touchAction: "manipulation" }} data-testid="forgot-reset-btn">
              {loading ? "RESETTING..." : "RESET PASSWORD"}
            </button>
            <div className="text-center">
              <button type="button" onClick={sendOtp} disabled={resendIn > 0 || loading}
                className="text-[14px] font-bold disabled:opacity-50" style={{ color: "#4ADE80", touchAction: "manipulation" }}
                data-testid="forgot-resend">
                {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-[15px] text-white/60">
          Password yaad aa gaya?{" "}
          <Link to="/login" className="font-bold" style={{ color: "#4ADE80" }} data-testid="forgot-login-link">Login</Link>
        </div>
      </div>
    </div>
  );
}
