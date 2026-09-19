import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Zap, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", referral_code: "" });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ ...form, email: form.email.trim().toLowerCase() });
      toast.success("Account created. Claim your welcome bonus in Rewards!");
      nav("/");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[color:var(--bg-base)] text-[color:var(--text)] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="grain-overlay" />
      <div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #0F766E, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #16A34A, transparent 70%)" }}
      />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--primary-deep)] flex items-center justify-center glow-gold">
              <Zap size={22} className="text-[color:var(--text)]" strokeWidth={2.5} />
            </div>
            <div className="font-display font-black text-3xl tracking-tight">Trade Skill</div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--text-mute)]">Join the new era of crypto</div>
        </div>

        <div className="app-card rounded-3xl p-8 shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
          <h1 className="font-display font-bold text-2xl mb-1">Create account</h1>
          <p className="text-sm text-[color:var(--text-mute)] mb-6">Get a $1,000 demo balance instantly</p>

          <form onSubmit={onSubmit} className="space-y-4">
            {[
              { key: "name", label: "Name", type: "text", placeholder: "Satoshi", testid: "reg-name" },
              { key: "email", label: "Email", type: "email", placeholder: "you@email.com", testid: "reg-email", required: true },
              { key: "password", label: "Password", type: "password", placeholder: "Min 6 chars", testid: "reg-password", required: true },
              { key: "referral_code", label: "Referral code (optional)", type: "text", placeholder: "TS...", testid: "reg-referral" },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-bold">{f.label}</label>
                <input
                  type={f.type}
                  required={f.required}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full mt-1.5 bg-[color:var(--bg-base)] border border-[color:var(--border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[color:var(--primary)] focus:ring-1 focus:ring-[color:var(--primary)] transition-all placeholder:text-[color:var(--text-mute)]"
                  placeholder={f.placeholder}
                  data-testid={f.testid}
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[color:var(--primary)] text-white font-display font-bold rounded-xl px-6 py-3.5 hover:brightness-110 transition-all hover:glow-primary flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="reg-submit"
            >
              {loading ? "Creating..." : "Create Account"} <ArrowRight size={18} />
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[color:var(--text-mute)]">
            Already have an account?{" "}
            <Link to="/login" className="text-[color:var(--primary)] font-semibold hover:underline" data-testid="link-login">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
