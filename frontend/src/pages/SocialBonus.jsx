import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Gift, ShieldCheck, Wallet, UserPlus, BadgeCheck, DollarSign, ExternalLink, CheckCircle2, Info, Loader2, Lock } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const GOLD_BORDER = "rgba(37,99,235,0.40)";

const Logos = {
  telegram: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#29A9EB" /><path fill="#fff" d="M34.9 14.6 30.7 34c-.3 1.3-1.1 1.6-2.2 1l-6.1-4.5-3 2.9c-.3.3-.6.6-1.2.6l.4-6.2L30 17.6c.5-.4-.1-.7-.8-.3l-14 8.8-6-1.9c-1.3-.4-1.3-1.3.3-1.9l23.5-9c1.1-.4 2.1.3 1.9 1.3z" /></svg>
  ),
  whatsapp: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#25D366" /><path fill="#fff" d="M24 11.5c-6.9 0-12.5 5.6-12.5 12.5 0 2.2.6 4.3 1.7 6.2L11.5 36.5l6.5-1.7c1.8 1 3.9 1.6 6 1.6 6.9 0 12.5-5.6 12.5-12.5S30.9 11.5 24 11.5zm0 22.8c-1.9 0-3.7-.5-5.3-1.5l-.4-.2-3.9 1 1-3.8-.2-.4c-1-1.6-1.6-3.5-1.6-5.5 0-5.7 4.7-10.3 10.4-10.3s10.4 4.6 10.4 10.3-4.7 10.4-10.4 10.4zm5.7-7.7c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.6-.9-.8-1.6-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2.1-.4 0-.6-.1-.2-.7-1.7-1-2.4-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.8.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.2.2 2.2 3.4 5.4 4.8.8.3 1.3.5 1.8.7.8.2 1.5.2 2 .1.6-.1 1.8-.8 2.1-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.4z" /></svg>
  ),
  instagram: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497" /><stop offset="5%" stopColor="#fdf497" /><stop offset="45%" stopColor="#fd5949" /><stop offset="60%" stopColor="#d6249f" /><stop offset="90%" stopColor="#285AEB" /></radialGradient></defs><rect width="48" height="48" rx="12" fill="url(#ig)" /><rect x="12" y="12" width="24" height="24" rx="7" fill="none" stroke="#fff" strokeWidth="3" /><circle cx="24" cy="24" r="6" fill="none" stroke="#fff" strokeWidth="3" /><circle cx="31.5" cy="16.5" r="1.8" fill="#fff" /></svg>
  ),
  facebook: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#1877F2" /><path fill="#fff" d="M31 24h-5v14h-6V24h-3v-5h3v-3.5C20 11.6 21.8 9 26.2 9H31v5h-3c-1.3 0-2 .5-2 2v3h5l-1 5z" /></svg>
  ),
  youtube: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#FF0000" /><path fill="#fff" d="M20 17.5v13l11-6.5-11-6.5z" /></svg>
  ),
};

const GoldBtn = ({ children, testid, ...props }) => (
  <button
    {...props}
    className="px-3.5 py-2 rounded-xl text-[11px] font-black text-white flex items-center gap-1 transition active:scale-95 disabled:opacity-50"
    style={{ background: "linear-gradient(135deg, #2563EB, #10B981)", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}
    data-testid={testid}
  >
    {children}
  </button>
);

export default function SocialBonus() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [, setTick] = useState(0);
  const offsetRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/social-bonus/status");
      if (data.server_time) offsetRef.current = Date.now() - new Date(data.server_time).getTime();
      setData(data);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [load]);

  const remaining = (p) => {
    if (!p.follow_started_at) return null;
    const raw = p.follow_started_at;
    const started = new Date(raw + (raw.endsWith("Z") || raw.includes("+") ? "" : "Z")).getTime();
    const nowSrv = Date.now() - offsetRef.current;
    return Math.ceil((started + (data?.verify_delay ?? 15) * 1000 - nowSrv) / 1000);
  };

  const doFollow = async (p) => {
    setBusy(p.id);
    try {
      await api.post(`/social-bonus/follow/${p.id}`);
      window.open(p.url, "_blank", "noopener");
      await load();
      toast.info(`Follow ${p.name} and come back — verification in progress…`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const doTgConnect = async () => {
    try {
      const { data: r } = await api.get("/social-bonus/telegram/link");
      window.open(r.url, "_blank", "noopener");
      toast.info("Telegram me START dabayen, phir wapas aakar VERIFY karein");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const doVerify = async (p) => {
    setBusy(p.id);
    try {
      await api.post(`/social-bonus/verify/${p.id}`);
      await load();
      toast.success(`${p.name} follow verified ✅ — ab CLAIM dabayen`);
    } catch (e) {
      if (e?.response?.status === 428) doTgConnect();
      else toast.error(formatApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const doClaim = async (p) => {
    setBusy(p.id);
    try {
      const { data: r } = await api.post(`/social-bonus/claim/${p.id}`);
      toast.success(`+$${r.amount.toFixed(2)} USDT credited to your wallet! 🎉`);
      await load();
      await refresh?.();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const renderAction = (p) => {
    // Only Telegram has the real follow/verify/claim flow. All other
    // platforms are shown as enabled with a "Coming Soon" badge.
    if (p.id !== "telegram")
      return (
        <span
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase"
          style={{ background: "rgba(37,99,235,0.10)", border: "1px solid rgba(37,99,235,0.30)", color: "#2563EB" }}
          data-testid={`coming-soon-${p.id}`}
        >
          Soon 🚀
        </span>
      );
    if (p.claimed)
      return (
        <span className="flex items-center gap-1 text-[11px] font-black text-[color:var(--good)]" data-testid={`claimed-${p.id}`}>
          <CheckCircle2 size={14} /> CLAIMED
        </span>
      );
    if (p.coming_soon)
      return (
        <span
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase"
          style={{ background: "rgba(37,99,235,0.10)", border: "1px solid rgba(37,99,235,0.30)", color: "#2563EB" }}
          data-testid={`coming-soon-${p.id}`}
        >
          Coming Soon 🚀
        </span>
      );
    if (p.locked)
      return (
        <span
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase"
          style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-mute)" }}
          data-testid={`locked-${p.id}`}
        >
          <Lock size={12} /> Locked
        </span>
      );
    if (p.followed)
      return (
        <button
          onClick={() => doClaim(p)}
          disabled={busy === p.id}
          className="px-4 py-2 rounded-xl text-[11px] font-black text-white transition active:scale-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", border: `1px solid ${GOLD_BORDER}` }}
          data-testid={`btn-claim-${p.id}`}
        >
          {busy === p.id ? "..." : "CLAIM"}
        </button>
      );
    if (p.follow_started_at) {
      if (p.verify_mode === "real" && !data.telegram_linked)
        return (
          <GoldBtn onClick={doTgConnect} testid={`btn-connect-${p.id}`}>
            CONNECT <ExternalLink size={11} />
          </GoldBtn>
        );
      const rem = remaining(p);
      if (rem > 0)
        return (
          <button
            disabled
            className="px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-1.5 opacity-80"
            style={{ background: "rgba(37,99,235,0.12)", border: `1px solid ${GOLD_BORDER}`, color: "#2563EB" }}
            data-testid={`btn-verifying-${p.id}`}
          >
            <Loader2 size={12} className="animate-spin" /> VERIFYING {rem}s
          </button>
        );
      return (
        <GoldBtn onClick={() => doVerify(p)} disabled={busy === p.id} testid={`btn-verify-${p.id}`}>
          {busy === p.id ? "..." : "VERIFY"} <BadgeCheck size={12} />
        </GoldBtn>
      );
    }
    return (
      <GoldBtn onClick={() => doFollow(p)} disabled={busy === p.id} testid={`btn-follow-${p.id}`}>
        {busy === p.id ? "..." : "FOLLOW"} <ExternalLink size={11} />
      </GoldBtn>
    );
  };

  const earned = data?.total_earned ?? 0;

  return (
    <div className="pb-28" data-testid="social-bonus-page">
      <PageHeader title="Social Media Bonus" subtitle="Follow our official channels & earn rewards" />

      <div className="px-4 mt-2 space-y-3">
        {/* Total earned */}
        <div
          className="rounded-2xl border p-3.5 flex items-center justify-between bg-[color:var(--surface)]"
          style={{ borderColor: GOLD_BORDER }}
          data-testid="social-total-earned"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.12)", border: `1px solid ${GOLD_BORDER}` }}>
              <Wallet size={18} className="text-[color:#2563EB]" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--text-mute)]">Total Earned</div>
              <div className="text-xl font-black text-[color:var(--good)]">${earned.toFixed(2)}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--text-mute)]">Available</div>
            <div className="text-base font-black text-[color:#2563EB]">${(data?.total_available ?? 1).toFixed(2)}</div>
          </div>
        </div>

        {/* Hero */}
        <div
          className="rounded-2xl border p-4 relative overflow-hidden"
          style={{
            borderColor: GOLD_BORDER,
            background: "var(--surface)",
          }}
          data-testid="social-hero"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-black text-lg text-[color:var(--text)]">
                FOLLOW. <span className="text-[color:#2563EB]">VERIFY.</span> EARN.
              </div>
              <p className="text-[11px] text-[color:var(--text-soft)] mt-1 leading-relaxed max-w-[220px]">
                Ek-ek karke sabhi official channels follow karein aur{" "}
                <span className="font-black text-[color:#2563EB]">${(data?.total_available ?? 1).toFixed(2)}</span> tak seedha wallet me kamayein.
              </p>
            </div>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 qr-float"
              style={{ background: "rgba(37,99,235,0.15)", border: `1.5px solid ${GOLD_BORDER}`, boxShadow: "0 8px 22px rgba(37,99,235,0.25)" }}
            >
              <Gift size={30} className="text-[color:#2563EB]" />
            </div>
          </div>
        </div>

        {/* Bonus cards */}
        <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-[color:#2563EB] px-1 pt-1">
          Available Bonuses
        </div>
        <div className="space-y-2" data-testid="social-bonus-list">
          {!data ? (
            <div className="text-center text-[12px] text-[color:var(--text-mute)] py-6">Loading…</div>
          ) : (
            data.platforms.map((p, i) => (
              <div
                key={p.id}
                className="rounded-2xl border px-3 py-2 flex items-center gap-2.5 bg-[color:var(--surface)] transition-all duration-300"
                style={{ borderColor: GOLD_BORDER }}
                data-testid={`social-card-${p.id}`}
              >
                <div className="shrink-0">{Logos[p.id]?.(34)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-black text-[color:var(--text)] uppercase tracking-wide truncate">
                    {String(i + 1).padStart(2, "0")}. {p.name}
                  </div>
                  <div className="text-[10px] text-[color:var(--text-mute)] truncate">
                    {p.desc || "Follow our official channel"}
                  </div>
                </div>
                <span
                  className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black"
                  style={{ background: "rgba(37,99,235,0.1)", border: `1px solid ${GOLD_BORDER}`, color: "#2563EB" }}
                >
                  ${p.reward.toFixed(2)}
                </span>
                <div className="w-[86px] flex justify-end shrink-0">{renderAction(p)}</div>
              </div>
            ))
          )}
        </div>

        {/* How it works */}
        <div className="rounded-2xl border p-3.5 bg-[color:var(--surface)]" style={{ borderColor: GOLD_BORDER }} data-testid="social-how-it-works">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Info size={12} className="text-[color:#2563EB]" />
            <span className="text-[10px] tracking-[0.25em] uppercase font-bold text-[color:#2563EB]">How it works</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { Icon: UserPlus, t: "1. Follow", s: "Channel follow karein" },
              { Icon: BadgeCheck, t: "2. Verify", s: "System follow verify karega" },
              { Icon: DollarSign, t: "3. Claim", s: "$0.20 wallet me instantly" },
              { Icon: Lock, t: "4. Unlock", s: "Agla platform khulega" },
            ].map(({ Icon, t, s }) => (
              <div key={t} className="flex flex-col items-center text-center gap-1">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "transparent", border: `1px solid ${GOLD_BORDER}` }}>
                  <Icon size={15} className="text-[color:#2563EB]" />
                </div>
                <div className="text-[10px] font-black text-[color:var(--text)]">{t}</div>
                <div className="text-[8.5px] text-[color:var(--text-mute)] leading-tight">{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="rounded-xl border px-3 py-2.5 flex items-center justify-between" style={{ borderColor: "var(--border-soft)", background: "var(--surface-3)" }}>
          <div className="text-[9px] text-[color:var(--text-mute)] leading-snug pr-2">
            <span className="font-bold text-[color:#2563EB]">Important:</span> Order me claim karein — Telegram se shuru. Har platform sirf ek baar claim ho sakta hai.
          </div>
          <div className="flex items-center gap-1 shrink-0 text-[9px] font-black text-[color:var(--good)]">
            <ShieldCheck size={12} /> 100% SAFE
          </div>
        </div>
      </div>
    </div>
  );
}
