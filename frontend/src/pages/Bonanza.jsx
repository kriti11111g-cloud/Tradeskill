import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Gift, Users, Clock, CheckCircle2, Lock, Sparkles, PartyPopper, Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const TIER_META = {
  5: { color: "#E8A804", glow: "rgba(232,168,4,.35)", icon: Gift },
  10: { color: "#DC2626", glow: "rgba(220,38,38,.35)", icon: Trophy },
};

function pad(n) {
  return String(n).padStart(2, "0");
}

export default function Bonanza() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
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

  // Auto-refresh once the deadline crosses so Claim unlocks live.
  const deadlineMs = data ? new Date(data.deadline).getTime() : 0;
  const endedByClock = deadlineMs && now >= deadlineMs;
  useEffect(() => {
    if (data && endedByClock && !data.ended) load();
  }, [endedByClock, data, load]);

  const claim = async () => {
    setClaiming(true);
    try {
      const { data: res } = await api.post("/bonanza/claim");
      confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 } });
      toast.success(`🎉 Bonanza credited! $${res.amount} added to your wallet`);
      await load();
      await refresh?.();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setClaiming(false);
    }
  };

  const remaining = Math.max(0, deadlineMs - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const ended = (data?.ended || endedByClock) && deadlineMs > 0;

  return (
    <div className="pb-8">
      <PageHeader title="Durga Puja Special" subtitle="Bonanza · Festive Rewards" showBack />

      <div className="px-4 pt-3 space-y-4">
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
            <div className="rounded-2xl px-4 py-3.5 text-white relative overflow-hidden"
                 style={{ background: "linear-gradient(135deg,#C2185B 0%,#E8A804 55%,#FF6F00 100%)", boxShadow: "var(--shadow-sm)" }}
                 data-testid="bonanza-countdown">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "#FFF3C4" }}>
                <Clock size={12} /> {ended ? "Offer Ended — Reward Window Open 🎁" : "Offer Ends In"}
              </div>
              {ended ? (
                <div className="text-[18px] font-black">Reward credited to qualifying wallets 🎁</div>
              ) : (
                <div className="flex items-center gap-2">
                  {[["Days", days], ["Hrs", hours], ["Min", mins], ["Sec", secs]].map(([lbl, val]) => (
                    <div key={lbl} className="flex-1 rounded-xl py-2 text-center" style={{ background: "rgba(0,0,0,.22)" }}>
                      <div className="text-[22px] font-black tabular-nums leading-none">{pad(val)}</div>
                      <div className="text-[8px] font-bold uppercase tracking-wider mt-1 opacity-85">{lbl}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Direct progress summary */}
            <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
                 data-testid="bonanza-directs">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,.12)" }}>
                <Users size={20} color="#2563EB" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-bold text-[color:var(--text-mute)]">Your Direct IDs</div>
                <div className="text-[20px] font-black text-[color:var(--text)] leading-none">{data.directs}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-[color:var(--text-mute)]">Qualified Reward</div>
                <div className="text-[18px] font-black" style={{ color: data.qualified_reward > 0 ? "var(--good)" : "var(--text-mute)" }}>
                  ${data.qualified_reward}
                </div>
              </div>
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
                     className="rounded-2xl px-4 py-3.5 relative overflow-hidden"
                     style={{ background: "var(--card)", border: `1px solid ${reached ? meta.color : "var(--border)"}`, boxShadow: "var(--shadow-sm)" }}
                     data-testid={`bonanza-tier-${t.directs}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: meta.glow }}>
                      <Icon size={22} color={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-black text-[color:var(--text)]">{t.directs} Direct IDs</span>
                        {reached && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: meta.color }}>
                            <CheckCircle2 size={9} /> Achieved
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-semibold text-[color:var(--text-mute)]">Refer {t.directs} active IDs to unlock</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[22px] font-black leading-none" style={{ color: meta.color }}>${t.reward}</div>
                      <div className="text-[9px] font-bold text-[color:var(--text-mute)]">reward</div>
                    </div>
                  </div>
                  {/* Processing bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[9px] font-bold text-[color:var(--text-mute)] mb-1">
                      <span>Progress</span>
                      <span>{Math.min(data.directs, t.directs)}/{t.directs}</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                           style={{ width: `${prog}%`, background: `linear-gradient(90deg, ${meta.color}, ${meta.color}cc)` }} />
                    </div>
                  </div>
                  {isHighest && (
                    <div className="mt-2 text-[10px] font-black" style={{ color: meta.color }}>★ This is your highest achieved tier</div>
                  )}
                </div>
              );
            })}

            {/* Claim action */}
            {data.claimed ? (
              <div className="rounded-2xl px-4 py-4 text-center" style={{ background: "rgba(22,163,74,.1)", border: "1px solid var(--good)" }}
                   data-testid="bonanza-claimed">
                <CheckCircle2 size={28} className="mx-auto mb-1.5" style={{ color: "var(--good)" }} />
                <div className="text-[15px] font-black text-[color:var(--text)]">Reward Claimed</div>
                <div className="text-[12px] font-semibold text-[color:var(--text-mute)] mt-0.5">
                  ${data.claimed_amount} credited to your wallet
                </div>
              </div>
            ) : (
              <button
                onClick={claim}
                disabled={!data.claimable || claiming}
                className="w-full rounded-2xl py-4 text-[15px] font-black text-white flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50"
                style={{ background: data.claimable ? "linear-gradient(135deg,#E8A804,#FF6F00)" : "var(--text-mute)", boxShadow: data.claimable ? "0 6px 20px rgba(232,168,4,.4)" : "none" }}
                data-testid="bonanza-claim-btn"
              >
                {!ended ? (
                  <><Lock size={16} /> Claim unlocks when timer ends</>
                ) : data.qualified_reward <= 0 ? (
                  <><Lock size={16} /> Need {data.tiers[0].directs} direct IDs to claim</>
                ) : claiming ? (
                  <>Processing…</>
                ) : (
                  <><Gift size={18} /> Claim ${data.qualified_reward} Reward</>
                )}
              </button>
            )}

            <p className="text-center text-[10px] text-[color:var(--text-mute)] px-4 leading-relaxed">
              Rewards are based on your <b>highest achieved tier only</b>. 10 direct IDs pays <b>$25</b> (not $10 + $25).
              The reward credits to your wallet after the countdown ends.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
