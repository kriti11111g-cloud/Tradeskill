import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Lock, KeyRound, ShieldCheck, Eye, EyeOff, Mail, ChevronRight, X, AlertTriangle } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

const OPTIONS = [
  {
    id: "login",
    label: "Login Password",
    desc: "Change the password you use to sign in",
    icon: Lock,
    endpoint: "/auth/password/update",
    minLen: 6,
    done: "Login password updated successfully",
  },
  {
    id: "txn",
    label: "Transaction Password",
    desc: "Change the password used for withdrawals & P2P",
    icon: KeyRound,
    endpoint: "/auth/txn-password/update",
    minLen: 4,
    done: "Transaction password updated successfully",
  },
];

export default function SecurityCentre() {
  const [flow, setFlow] = useState(null);       // option object or null
  const [step, setStep] = useState("confirm");  // confirm | otp | password
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [emailMasked, setEmailMasked] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const close = () => {
    setFlow(null); setStep("confirm");
    setCode(""); setNewPw(""); setConfirmPw(""); setShowPw(false);
    setEmailMasked(""); setResendIn(0); setLoading(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startResendTimer = (secs) => {
    setResendIn(secs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  // Step 1 → confirm "Yes" → send OTP
  const sendOtp = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/security-otp/send");
      setEmailMasked(data.email_masked || "");
      startResendTimer(data.resend_in || 60);
      setStep("otp");
      toast.success(`OTP sent to ${data.email_masked || "your email"}`);
      if (data.demo_otp) toast.info(`Demo OTP: ${data.demo_otp}`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → verify OTP → show password form
  const verifyOtp = async () => {
    if (code.trim().length < 4) return toast.error("Enter the OTP sent to your email");
    setLoading(true);
    try {
      await api.post("/auth/security-otp/verify", { code: code.trim() });
      setStep("password");
      toast.success("OTP verified");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 3 → submit new password
  const submit = async () => {
    if (newPw.length < flow.minLen) return toast.error(`Password must be at least ${flow.minLen} characters`);
    if (newPw !== confirmPw) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      await api.post(flow.endpoint, { new_password: newPw });
      toast.success(flow.done);
      close();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" };
  const primaryBtn = "w-full rounded-xl py-3 font-bold text-[13.5px] text-white flex items-center justify-center gap-2 disabled:opacity-60";

  return (
    <div className="pb-6" data-testid="security-centre-page">
      <PageHeader title="Security Centre" subtitle="Account Protection" />

      <div className="px-4 pt-1 pb-3 flex items-start gap-2.5">
        <ShieldCheck size={16} style={{ color: "#16A34A" }} className="shrink-0 mt-0.5" />
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
          Every password change is verified by a one-time code (OTP) sent to your registered email — nothing updates without it.
        </p>
      </div>

      {/* Equal-size option cards */}
      <div className="px-4 space-y-3">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              onClick={() => { close(); setFlow(o); setStep("confirm"); }}
              className="app-card rounded-2xl w-full flex items-center gap-3 p-4 text-left"
              data-testid={`security-open-${o.id}`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 26%, transparent)" }}
              >
                <Icon size={19} style={{ color: "var(--primary)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[14.5px]" style={{ color: "var(--text)" }}>{o.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-mute)" }}>{o.desc}</div>
              </div>
              <ChevronRight size={18} style={{ color: "var(--text-mute)" }} />
            </button>
          );
        })}
      </div>

      {/* Flow modal */}
      {flow && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }}
          onClick={close}
          data-testid="security-modal"
        >
          <div
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)", maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
              >
                <flow.icon size={19} style={{ color: "var(--primary)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[15px]" style={{ color: "var(--text)" }}>{flow.label}</div>
                <div className="text-[10.5px] uppercase tracking-[0.14em]" style={{ color: "var(--text-mute)" }}>
                  {step === "confirm" ? "Confirm" : step === "otp" ? "Verify OTP" : "Set New Password"}
                </div>
              </div>
              <button onClick={close} data-testid="security-modal-close"><X size={20} style={{ color: "var(--text-mute)" }} /></button>
            </div>

            {/* STEP 1: Are you sure? */}
            {step === "confirm" && (
              <>
                <div className="rounded-xl px-3.5 py-3 flex items-start gap-2.5" style={{ background: "color-mix(in srgb, #F59E0B 12%, transparent)", border: "1px solid color-mix(in srgb, #F59E0B 30%, transparent)" }}>
                  <AlertTriangle size={18} style={{ color: "#D97706" }} className="shrink-0 mt-0.5" />
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text)" }}>
                    Are you sure you want to change your <b>{flow.label.toLowerCase()}</b>? We'll send a one-time code (OTP) to your email to confirm it's you.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <button onClick={close} className="flex-1 rounded-xl py-3 font-bold text-[13.5px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} data-testid="security-confirm-cancel">
                    Cancel
                  </button>
                  <button onClick={sendOtp} disabled={loading} className={primaryBtn + " flex-1"} style={{ background: "var(--primary)" }} data-testid="security-confirm-yes">
                    {loading ? "Sending…" : "Yes, Continue"}
                  </button>
                </div>
              </>
            )}

            {/* STEP 2: Enter OTP */}
            {step === "otp" && (
              <>
                <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "color-mix(in srgb, #16A34A 10%, transparent)" }}>
                  <Mail size={14} style={{ color: "#16A34A" }} />
                  <span className="text-[11px]" style={{ color: "var(--text-soft)" }}>OTP sent to <b style={{ color: "var(--text)" }}>{emailMasked}</b></span>
                </div>
                <div>
                  <label className="text-[10.5px] uppercase tracking-[0.14em] font-semibold" style={{ color: "var(--text-mute)" }}>Enter OTP</label>
                  <input
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    className="w-full rounded-xl px-3.5 py-3 text-[18px] tracking-[0.3em] font-bold text-center outline-none mt-1.5"
                    style={inputStyle}
                    data-testid="security-otp-input"
                  />
                </div>
                <div className="flex items-center justify-end">
                  <button onClick={sendOtp} disabled={resendIn > 0 || loading} className="text-[11.5px] font-semibold disabled:opacity-50" style={{ color: "var(--primary)" }} data-testid="security-resend-otp">
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                  </button>
                </div>
                <button onClick={verifyOtp} disabled={loading} className={primaryBtn} style={{ background: "var(--primary)" }} data-testid="security-verify-otp">
                  {loading ? "Verifying…" : "Verify OTP"}
                </button>
              </>
            )}

            {/* STEP 3: New password */}
            {step === "password" && (
              <>
                <div>
                  <label className="text-[10.5px] uppercase tracking-[0.14em] font-semibold" style={{ color: "var(--text-mute)" }}>New {flow.label}</label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPw ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder={`At least ${flow.minLen} characters`}
                      className="w-full rounded-xl pl-3.5 pr-10 py-2.5 text-[13px] outline-none"
                      style={inputStyle}
                      data-testid="security-new-password"
                    />
                    <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      {showPw ? <EyeOff size={16} style={{ color: "var(--text-mute)" }} /> : <Eye size={16} style={{ color: "var(--text-mute)" }} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10.5px] uppercase tracking-[0.14em] font-semibold" style={{ color: "var(--text-mute)" }}>Confirm New {flow.label}</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Re-enter the new password"
                    className="w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none mt-1.5"
                    style={inputStyle}
                    data-testid="security-confirm-password"
                  />
                </div>
                <button onClick={submit} disabled={loading} className={primaryBtn} style={{ background: "#16A34A" }} data-testid="security-submit">
                  {loading ? "Updating…" : `Update ${flow.label}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
