import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Gift, Clock, CheckCircle2, Trophy } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";

const TIER_META = {
  5: { color: "#16A34A", glow: "rgba(22,163,74,.18)", bg: "linear-gradient(135deg,#E9F9EF,#D7F3E1)", icon: Gift },
  10: { color: "#2563EB", glow: "rgba(37,99,235,.18)", bg: "linear-gradient(135deg,#EAF1FE,#D9E6FD)", icon: Trophy },
};

function pad(n) {
  return String(n).padStart(2, "0");
}

export default function Bonanza() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const tick = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/bonanza");
      setData(data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    tick.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick.current);
  }, []);

  // Auto-refresh once the deadline crosses so the status updates live.
  const deadlineMs = data ? new Date(data.deadline).getTime() : 0;
  const endedByClock = deadlineMs && now >= deadlineMs;
  useEffect(() => {
    if (data && endedByClock && !data.ended) load();
  }, [endedByClock, data, load]);

  const remaining = Math.max(0, deadlineMs - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const ended = (data?.ended || endedByClock) && deadlineMs > 0;

  return (
    <div className="pb-8">
      <PageHeader title="Durga Puja Special" subtitle="Bonanza · Festive Rewards" showBack />

      <div className="px-4 pt-3 space-y-2.5">
        {loading ? (
          <div className="py-24 text-center text-[color:var(--text-mute)]" data-testid="bonanza-loading">Loading offer…</div>
        ) : !data ? null : (
          <>
            {/* HERO IMAGE (top) */}
            <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-lg)", border: "1px solid rgba(232,168,4,0.5)" }} data-testid="bonanza-hero">
              <img src="/durga-puja-slide.png" alt={data.title}
                   className="w-full object-cover" style={{ aspectRatio: "1952 / 806" }} />
            </div>

            {/* Countdown (below image) */}
            <div className="rounded-2xl px-3 py-2.5 text-white relative overflow-hidden"
                 style={{ background: "linear-gradient(135deg,#C2185B 0%,#E8A804 55%,#FF6F00 100%)", boxShadow: "var(--shadow-sm)" }}
                 data-testid="bonanza-countdown">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#FFF3C4" }}>
                <Clock size={11} /> {ended ? "Offer Ended — Reward Window Open 🎁" : "Offer Ends In"}
              </div>
              {ended ? (
                <div className="text-[15px] font-black">Reward credited to qualifying wallets 🎁</div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {[["Days", days], ["Hrs", hours], ["Min", mins], ["Sec", secs]].map(([lbl, val]) => (
                    <div key={lbl} className="flex-1 rounded-lg py-1.5 text-center" style={{ background: "rgba(0,0,0,.22)" }}>
                      <div className="text-[18px] font-black tabular-nums leading-none">{pad(val)}</div>
                      <div className="text-[7px] font-bold uppercase tracking-wider mt-0.5 opacity-85">{lbl}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Offer tiers */}
            {data.tiers.map((t) => {
              const meta = TIER_META[t.directs] || { color: "#2563EB", glow: "rgba(37,99,235,.3)", icon: Gift };
              const Icon = meta.icon;
              const prog = Math.min(100, Math.round((data.directs / t.directs) * 100));
              const reached = data.directs >= t.directs;
              const isHighest = data.qualified_tier_directs === t.directs;
              return (
                <div key={t.directs}
                     className="rounded-xl px-3 py-1.5 relative overflow-hidden"
                     style={{ background: meta.bg, border: `1px solid ${meta.color}`, boxShadow: "var(--shadow-sm)" }}
                     data-testid={`bonanza-tier-${t.directs}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.7)" }}>
                      <Icon size={14} color={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-black" style={{ color: "#0F172A" }}>{t.directs} Direct IDs</span>
                        {reached && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: meta.color }}>
                            <CheckCircle2 size={8} /> Achieved
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-semibold" style={{ color: "#64748B" }}>Refer {t.directs} active IDs to unlock</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[15px] font-black leading-none" style={{ color: meta.color }}>${t.reward}</div>
                      <div className="text-[8px] font-bold" style={{ color: "#64748B" }}>reward</div>
                    </div>
                  </div>
                  {/* Processing bar */}
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-[8px] font-bold mb-0.5" style={{ color: "#64748B" }}>
                      <span>Progress</span>
                      <span>{Math.min(data.directs, t.directs)}/{t.directs}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.65)" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                           style={{ width: `${prog}%`, background: meta.color }} />
                    </div>
                  </div>
                  {isHighest && (
                    <div className="mt-1 text-[9px] font-black" style={{ color: meta.color }}>★ Your highest achieved tier</div>
                  )}
                </div>
              );
            })}

            {/* Status (auto-credit — no claim button) */}
            {data.claimed ? (
              <div className="rounded-2xl px-4 py-3 text-center" style={{ background: "rgba(22,163,74,.1)", border: "1px solid var(--good)" }}
                   data-testid="bonanza-claimed">
                <CheckCircle2 size={22} className="mx-auto mb-1" style={{ color: "var(--good)" }} />
                <div className="text-[13px] font-black text-[color:var(--text)]">Reward Credited</div>
                <div className="text-[11px] font-semibold text-[color:var(--text-mute)] mt-0.5">
                  ${data.claimed_amount} added to your wallet
                </div>
              </div>
            ) : (
              <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ background: "rgba(232,168,4,.1)", border: "1px solid rgba(232,168,4,.5)" }}
                   data-testid="bonanza-auto-note">
                <Gift size={18} color="#E8A804" className="shrink-0" />
                <div className="text-[11px] font-bold text-[color:var(--text)] leading-snug">
                  Reward <span style={{ color: "#E8A804" }}>auto-credits</span> to your wallet when the timer ends — no claim needed.
                </div>
              </div>
            )}

            <p className="text-center text-[9px] text-[color:var(--text-mute)] px-4 leading-relaxed">
              Rewards are based on your <b>highest achieved tier only</b>. 10 direct IDs pays <b>$25</b> (not $10 + $25).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
