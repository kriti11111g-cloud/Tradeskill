import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

export const TS_LOGO = "https://static.prod-images.emergentagent.com/jobs/e3103ddd-0dc9-4cf2-8d94-ea48e4389b5b/images/2fc173585b6a7c8ae03589e9d69e196865e3322126777cf481e10020b4b21714.jpeg";
const GRAD = "linear-gradient(90deg, #22C55E 0%, #2563EB 100%)";
const FIELD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "14px" };

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
      nav("/");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full flex justify-center relative overflow-hidden" style={{ background: "#060D0B" }}>
      <div className="absolute -top-24 right-0 w-[420px] h-[420px] rounded-full opacity-25 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #14532D, transparent 70%)" }} />
      <div className="absolute bottom-0 inset-x-0 h-72 opacity-40 blur-2xl pointer-events-none" style={{ background: "radial-gradient(ellipse at 20% 100%, #14532D 0%, transparent 55%), radial-gradient(ellipse at 90% 100%, #064E3B 0%, transparent 50%)" }} />

      <div className="w-full max-w-md z-10 px-6 flex flex-col justify-center min-h-screen pb-16">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="w-44 h-44 rounded-full overflow-hidden" style={{ boxShadow: "0 0 40px rgba(34,197,94,0.25)" }}>
            <img src={TS_LOGO} alt="Trade Skill" className="w-full h-full object-cover" style={{ transform: "scale(1.55)" }} />
          </div>
          <div className="font-display font-black text-[38px] leading-tight mt-3 text-white">
            Trade{" "}
            <span style={{ background: "linear-gradient(90deg,#4ADE80,#22D3EE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Skill</span>
          </div>
          <div className="text-[13px] font-bold tracking-[0.35em] text-white/85 mt-1">LOGIN TO YOUR ACCOUNT</div>
        </div>

        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          <div className="flex items-center gap-3.5 px-4 py-4" style={FIELD}>
            <User size={24} className="text-white/80 shrink-0" />
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Username or Email" required
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-white placeholder:text-white/45"
              data-testid="login-email" />
          </div>

          <div className="flex items-center gap-3.5 px-4 py-4" style={FIELD}>
            <Lock size={24} className="text-white/80 shrink-0" />
            <input type={showPw ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" required
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-white placeholder:text-white/45"
              data-testid="login-password" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="shrink-0" data-testid="login-pw-eye" style={{ touchAction: "manipulation" }}>
              {showPw ? <EyeOff size={24} className="text-white/80" /> : <Eye size={24} className="text-white/80" />}
            </button>
          </div>

          <div className="flex justify-end">
            <button type="button" className="text-[15px] font-bold text-white"
              onClick={() => toast.info("Please contact support to reset your password")}
              data-testid="login-forgot" style={{ touchAction: "manipulation" }}>
              Forgot Password?
            </button>
          </div>

          <button type="submit" disabled={loading}
            className="w-full text-white font-display font-black text-lg tracking-[0.15em] rounded-2xl py-4 mt-2 disabled:opacity-60 select-none"
            style={{ background: GRAD, touchAction: "manipulation" }}
            data-testid="login-submit">
            {loading ? "LOGGING IN..." : "LOGIN"}
          </button>
        </form>

        <div className="mt-8 text-center text-[15px] text-white/60">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-bold" style={{ color: "#4ADE80" }} data-testid="link-register">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
