import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Lock, KeyRound, ShieldCheck, Eye, EyeOff, Mail, ChevronRight } from "lucide-react";
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
  const [open, setOpen] = useState(null); // "login" | "txn" | null
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [emailMasked, setEmailMasked] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef(null);

  const cfg = OPTIONS.find((o) => o.id === open);

  const resetForm = () => {
    setNewPw(""); setConfirmPw(""); setShowPw(false);
    setOtpSent(false); setCode(""); setEmailMasked("");
    setSending(false); setSubmitting(false); setResendIn(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const selectOption = (id) => {
    resetForm();
    setOpen((prev) => (prev === id ? null : id));
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

  const sendOtp = async () => {
    if (newPw.length < cfg.minLen) return toast.error(`Password must be at least ${cfg.minLen} characters`);
    if (newPw !== confirmPw) return toast.error("Passwords do not match");
    setSending(true);
    try {
      const { data } = await api.post("/auth/security-otp/send");
      setEmailMasked(data.email_masked || "");
      setOtpSent(true);
      startResendTimer(data.resend_in || 60);
      toast.success(`OTP sent to ${data.email_masked || "your email"}`);
      if (data.demo_otp) toast.info(`Demo OTP: ${data.demo_otp}`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    if (code.trim().length < 4) return toast.error("Enter the OTP sent to your email");
    setSubmitting(true);
    try {
      await api.post(cfg.endpoint, { code: code.trim(), new_password: newPw });
      toast.success(cfg.done);
      setOpen(null);
      resetForm();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  return (
    <div className="pb-6" data-testid="security-centre-page">
      <PageHeader title="Security Centre" subtitle="Account Protection" />

      <div className="px-4 pt-1 pb-3 flex items-start gap-2.5">
        <ShieldCheck size={16} style={{ color: "#16A34A" }} className="shrink-0 mt-0.5" />
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
          Every password change is verified by a one-time code (OTP) sent to your registered email — nothing updates without it.
        </p>
      </div>

      <div className="px-4 space-y-3">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          const active = open === o.id;
          return (
            <div key={o.id} className="app-card rounded-2xl overflow-hidden" data-testid={`security-card-${o.id}`}>
              <button
                onClick={() => selectOption(o.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
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
                <ChevronRight
                  size={18}
                  style={{ color: "var(--text-mute)", transform: active ? "rotate(90deg)" : "none", transition: "transform .2s" }}
                />
              </button>

              {active && (
                <div className="px-4 pb-4 pt-1 space-y-3" data-testid={`security-form-${o.id}`}>
                  {/* New password */}
                  <div>
                    <label className="text-[10.5px] uppercase tracking-[0.14em] font-semibold" style={{ color: "var(--text-mute)" }}>New {o.label}</label>
                    <div className="relative mt-1.5">
                      <input
                        type={showPw ? "text" : "password"}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder={`At least ${o.minLen} characters`}
                        className="w-full rounded-xl pl-3.5 pr-10 py-2.5 text-[13px] outline-none"
                        style={inputStyle}
                        data-testid="security-new-password"
                      />
                      <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showPw ? <EyeOff size={16} style={{ color: "var(--text-mute)" }} /> : <Eye size={16} style={{ color: "var(--text-mute)" }} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="text-[10.5px] uppercase tracking-[0.14em] font-semibold" style={{ color: "var(--text-mute)" }}>Confirm New {o.label}</label>
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

                  {!otpSent ? (
                    <button
                      onClick={sendOtp}
                      disabled={sending}
                      className="w-full rounded-xl py-3 font-bold text-[13.5px] text-white flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: "var(--primary)" }}
                      data-testid="security-send-otp"
                    >
                      <Mail size={16} /> {sending ? "Sending OTP…" : "Send OTP to Email"}
                    </button>
                  ) : (
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
                          className="w-full rounded-xl px-3.5 py-2.5 text-[16px] tracking-[0.3em] font-bold outline-none mt-1.5"
                          style={inputStyle}
                          data-testid="security-otp-input"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={sendOtp}
                          disabled={resendIn > 0 || sending}
                          className="text-[11.5px] font-semibold disabled:opacity-50"
                          style={{ color: "var(--primary)" }}
                          data-testid="security-resend-otp"
                        >
                          {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                        </button>
                      </div>
                      <button
                        onClick={submit}
                        disabled={submitting}
                        className="w-full rounded-xl py-3 font-bold text-[13.5px] text-white flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ background: "#16A34A" }}
                        data-testid="security-submit"
                      >
                        {submitting ? "Updating…" : `Update ${o.label}`}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
