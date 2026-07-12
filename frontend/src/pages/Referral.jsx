import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Share2, Users, Gift, Network } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD, fmtTime } from "@/lib/format";

const maskEmail = (email = "") => {
  const [u, d] = email.split("@");
  if (!d) return email;
  const head = u.slice(0, 3);
  return `${head}***@${d}`;
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export default function Referral() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/referral").then(({ data }) => setData(data));
  }, []);

  const copy = () => {
    if (!data?.referral_code) return;
    navigator.clipboard.writeText(data.referral_code);
    toast.success("Code copied!");
  };
  const share = () => {
    const url = `${window.location.origin}/register?ref=${data.referral_code}`;
    if (navigator.share) navigator.share({ title: "Join TGX BOT", url });
    else {
      navigator.clipboard.writeText(url);
      toast.success("Referral link copied!");
    }
  };

  const ds = data?.direct_stats || { activated: 0, not_activated: 0 };
  const ts = data?.team_stats || { total: 0, activated: 0, not_activated: 0 };

  return (
    <div className="pb-4">
      <PageHeader title="Referral" subtitle="Invite · Earn · Grow" showBack={false} />

      <div className="px-4">
        <div
          className="rounded-3xl border border-[color:var(--border)] p-6 relative overflow-hidden text-white"
          style={{ background: "var(--hero-grad)" }}
        >
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--warn)] font-bold">Your Code</div>
            <div className="font-display font-black text-3xl tabular-nums mt-2 tracking-wider" data-testid="ref-code">
              {data?.referral_code || "----"}
            </div>
            <div className="text-xs text-white/70 mt-2">Earn 10% of your team&apos;s trading revenue.</div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={copy}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white text-[color:var(--primary-deep)] rounded-xl py-2.5 font-bold text-sm"
                data-testid="ref-copy"
              >
                <Copy size={14} /> Copy
              </button>
              <button
                onClick={share}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 border border-[color:var(--border)] rounded-xl py-2.5 font-bold text-sm"
                data-testid="ref-share"
              >
                <Share2 size={14} /> Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==== Direct Quantification ==== */}
      <div className="px-4 mt-4">
        <SectionCard icon={Users} title="Direct Referrals" testid="ref-direct-card">
          <div className="grid grid-cols-2 gap-3">
            <BarStat color="var(--gold)" label="Not Yet Activated" value={ds.not_activated} testid="direct-inactive" />
            <BarStat color="var(--primary)" label="Activated" value={ds.activated} testid="direct-active" />
          </div>
        </SectionCard>
      </div>

      {/* ==== Team Quantification ==== */}
      <div className="px-4 mt-3">
        <SectionCard icon={Network} title="Team" testid="ref-team-card">
          <div className="grid grid-cols-3 gap-3">
            <BarStat color="var(--gold)" label="Not Activated" value={ts.not_activated} testid="team-inactive" />
            <BarStat color="var(--primary)" label="Activated" value={ts.activated} testid="team-active" />
            <BarStat color="var(--primary-deep)" label="Total Team" value={ts.total} testid="team-total" />
          </div>
        </SectionCard>
      </div>

      {/* ==== Direct Referrals table ==== */}
      <div className="px-4 mt-5">
        <div className="font-display font-bold text-lg mb-3">Direct Referrals</div>
        {(!data?.team || data.team.length === 0) && (
          <div className="text-center text-sm text-[color:var(--text-mute)] py-8" data-testid="empty-team">
            Share your code to grow your team.
          </div>
        )}
        {data?.team?.length > 0 && (
          <div className="space-y-2.5" data-testid="direct-list">
            {data.team.map((t, i) => (
              <div
                key={t.email}
                className="rounded-2xl px-3 py-2.5 flex items-center justify-between"
                style={{
                  background: "var(--surface-2)",
                  border: `1.5px solid color-mix(in srgb, ${t.activated ? "var(--primary)" : "var(--gold)"} 55%, transparent)`,
                  boxShadow: t.activated
                    ? "0 2px 12px rgba(22,163,74,0.15)"
                    : "0 2px 12px rgba(245,158,11,0.12)",
                  backdropFilter: "blur(20px)",
                }}
                data-testid={`direct-row-${i}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-display font-black text-[12px] text-white"
                    style={{ background: "var(--primary-grad)" }}
                  >
                    {(t.name || t.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-[13px] truncate flex items-center gap-1.5">
                      {t.name || t.email.split("@")[0]}
                    </div>
                    <div className="text-[10px] text-[color:var(--text-mute)] truncate mt-0.5">{maskEmail(t.email)}</div>
                  </div>
                </div>
                <div className="text-right pl-2 shrink-0">
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className="text-[8px] uppercase tracking-widest font-black"
                      style={{ color: t.activated ? "var(--primary)" : "#DC2626" }}
                      data-testid={`direct-status-${i}`}
                    >
                      ● {t.activated ? "Active" : "Inactive"}
                    </span>
                    <span
                      className="text-[8px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-md inline-block"
                    style={{
                      color: "var(--gold-deep)",
                      background: "color-mix(in srgb, var(--gold) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--gold) 35%, transparent)",
                    }}
                    >
                      ★ {(t.rank || "Starter").toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-[color:var(--text-mute)] mt-0.5">
                    Joined {fmtDate(t.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==== Commission Log ==== */}
      {data?.earnings?.length > 0 && (
        <div className="px-4 mt-5">
          <div className="font-display font-bold text-lg mb-3">Commission Log</div>
          <div className="space-y-2" data-testid="commission-log">
            {data.earnings.slice(0, 10).map((e) => (
              <div key={e.id} className="app-card rounded-2xl p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm truncate">
                    {e.symbol ? e.symbol.replace("USDT", "/USDT") : "Referral"}
                  </div>
                  <div className="text-[10px] text-[color:var(--text-mute)] mt-0.5 truncate">
                    {e.note || fmtTime(e.created_at)}
                  </div>
                </div>
                <div className="text-right pl-3">
                  <div className="font-display font-bold tabular-nums text-[color:var(--good)] text-sm">
                    +{fmtUSD(e.amount)}
                  </div>
                  <div className={`text-[9px] uppercase tracking-widest font-bold mt-0.5 ${
                    e.status === "claimed" ? "text-[color:var(--text-mute)]" : "text-[color:var(--primary)]"
                  }`}>
                    {e.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data?.pending || 0) > 0 && (
        <div className="px-4 mt-3">
          <div className="app-card rounded-2xl p-3 flex items-center gap-2 text-[11px] font-bold" data-testid="ref-pending">
            <Gift size={14} className="text-[color:var(--gold-deep)]" />
            +{fmtUSD(data.pending)} pending · claim in Rewards
          </div>
        </div>
      )}
    </div>
  );
}

const SectionCard = ({ icon: Icon, title, children, testid }) => (
  <div className="app-card rounded-2xl p-4" data-testid={testid}>
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className="text-[color:var(--gold-deep)]" />
      <span className="text-[10px] uppercase tracking-[0.25em] font-black text-[color:var(--text-mute)]">{title}</span>
    </div>
    {children}
  </div>
);

const BarStat = ({ color, label, value, testid }) => (
  <div className="flex items-stretch gap-2" data-testid={testid}>
    <span className="w-1 rounded-full shrink-0" style={{ background: color }} />
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider font-bold text-[color:var(--text-mute)] leading-tight">{label}</div>
      <div className="font-display font-black text-lg tabular-nums mt-0.5">{value}</div>
    </div>
  </div>
);
