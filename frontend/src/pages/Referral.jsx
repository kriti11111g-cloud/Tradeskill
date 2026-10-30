import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, User, Link2, Users, BarChart3, HandCoins, Infinity as InfinityIcon, ScanLine, Network, Gift } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import api from "@/lib/api";
import { fmtUSD, rankName } from "@/lib/format";
import { useCachedState } from "@/lib/useCachedState";

const maskEmail = (email = "") => {
  const [u, d] = email.split("@");
  if (!d) return email;
  return `${u.slice(0, 3)}***@${d}`;
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const LOGO = "https://static.prod-images.emergentagent.com/jobs/e3103ddd-0dc9-4cf2-8d94-ea48e4389b5b/images/2fc173585b6a7c8ae03589e9d69e196865e3322126777cf481e10020b4b21714.jpeg";

const CARD = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.05)" };

export default function Referral() {
  const nav = useNavigate();
  const [data, setData] = useCachedState("referral_data", null);
  const [tab, setTab] = useState("direct");
  const [teamData, setTeamData] = useCachedState("referral_team_by_rank", null);
  const [viewRank, setViewRank] = useState(null);
  const [rankPage, setRankPage] = useState(0);
  const PAGE = 20;

  useEffect(() => {
    api.get("/referral").then(({ data }) => setData(data));
  }, []);

  const openTeam = () => {
    setTab("team");
    setViewRank(null);
    api.get("/referral/team-by-rank").then(({ data }) => setTeamData(data)).catch(() => {});
  };

  const code = data?.referral_code || "";
  const link = code ? `${window.location.origin}/register?ref=${code}` : "";

  const copyCode = () => { navigator.clipboard.writeText(code); toast.success("Referral code copied!"); };
  const copyLink = () => { navigator.clipboard.writeText(link); toast.success("Referral link copied!"); };

  return (
    <div className="min-h-screen pb-8" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div className="flex items-center px-3 py-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 flex items-center justify-center" data-testid="invite-back" style={{ touchAction: "manipulation" }}>
          <ChevronLeft size={26} strokeWidth={2.6} style={{ color: "var(--ink)" }} />
        </button>
        <div className="flex-1 text-center font-display font-black text-[22px] pr-9" style={{ color: "var(--ink)" }}>Invite Friends</div>
      </div>

      <div className="px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <img src={LOGO} alt="TradeSkill" className="w-11 h-11 rounded-xl object-cover" style={{ transform: "scale(1.0)" }} />
          <span className="font-display font-black text-[30px] leading-none">
            <span style={{ color: "#2563EB" }}>Trade</span><span style={{ color: "#16A34A" }}>Skill</span>
          </span>
        </div>
        <div className="text-center text-[11px] font-bold tracking-[0.35em] mt-1.5" style={{ color: "var(--text-mute)" }}>
          TRADE · EARN · GROW TOGETHER
        </div>
        <div className="text-center text-[13px] font-semibold mt-2" style={{ color: "var(--ink)" }}>
          Invite your friends and be a part of our growing community
        </div>

        {/* QR */}
        <div className="flex flex-col items-center mt-4">
          <div className="relative rounded-3xl p-3" style={{ border: "6px solid #0A0A0A", background: "#FFFFFF" }} data-testid="invite-qr">
            {link ? (
              <QRCodeCanvas value={link} size={200} level="H" bgColor="#FFFFFF" fgColor="#0A0A0A" />
            ) : (
              <div className="w-[200px] h-[200px]" />
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center" style={{ boxShadow: "0 0 0 4px #FFFFFF" }}>
                <img src={LOGO} alt="" className="w-11 h-11 rounded-xl object-cover" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-full -mt-5 relative z-10 text-white font-display font-black text-[15px]" style={{ background: "#0A0A0A" }}>
            <ScanLine size={17} /> Scan &amp; Join Now
          </div>
          <div className="text-[12px] font-semibold mt-2.5" style={{ color: "var(--text-mute)" }}>
            Share your QR code with friends
          </div>
        </div>

        {/* Referral Code card */}
        <div className="flex items-center gap-3 px-3.5 py-3 mt-4" style={CARD} data-testid="invite-code-card">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--surface-3)" }}>
            <User size={20} style={{ color: "var(--ink)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: "var(--text-mute)" }}>Your Referral Code</div>
            <div className="font-display font-black text-[20px] tracking-wide" style={{ color: "var(--ink)" }} data-testid="invite-code">{code || "----"}</div>
          </div>
          <div className="self-stretch w-px" style={{ background: "var(--border)" }} />
          <button onClick={copyCode} className="flex items-center gap-1.5 font-display font-black text-[15px] px-1" style={{ color: "#2563EB", touchAction: "manipulation" }} data-testid="invite-copy-code">
            <Copy size={18} /> Copy
          </button>
        </div>

        {/* Referral Link card */}
        <div className="flex items-center gap-3 px-3.5 py-3 mt-2.5" style={CARD} data-testid="invite-link-card">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--surface-3)" }}>
            <Link2 size={20} style={{ color: "var(--ink)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: "var(--text-mute)" }}>Your Referral Link</div>
            <div className="font-semibold text-[12px] truncate" style={{ color: "var(--ink)" }} data-testid="invite-link">{link || "—"}</div>
          </div>
          <div className="self-stretch w-px" style={{ background: "var(--border)" }} />
          <button onClick={copyLink} className="flex items-center gap-1.5 font-display font-black text-[15px] px-1" style={{ color: "#2563EB", touchAction: "manipulation" }} data-testid="invite-copy-link">
            <Copy size={18} /> Copy
          </button>
        </div>

        {/* Big gradient button */}
        <button onClick={copyLink} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 mt-3.5 text-white font-display font-black text-[17px]"
          style={{ background: "linear-gradient(90deg,#2563EB 0%,#16A34A 100%)", touchAction: "manipulation" }} data-testid="invite-copy-link-btn">
          <Copy size={19} /> Copy Referral Link
        </button>

        {/* Info row */}
        <div className="grid grid-cols-4 mt-4" style={CARD} data-testid="invite-info-row">
          {[
            { Icon: Users, color: "#2563EB", title: "Invite Friends", sub: "Share your link" },
            { Icon: BarChart3, color: "#16A34A", title: "They Trade", sub: "Grow together" },
            { Icon: HandCoins, color: "#16A34A", title: "You Earn", sub: "Get rewards" },
            { Icon: InfinityIcon, color: "#16A34A", title: "Unlimited Potential", sub: "Build your network" },
          ].map((it, i) => (
            <div key={it.title} className="flex flex-col items-center text-center px-1.5 py-3" style={{ borderLeft: i > 0 ? "1px solid var(--border)" : "none" }}>
              <it.Icon size={26} style={{ color: it.color }} strokeWidth={2.2} />
              <div className="font-display font-black text-[11px] mt-1.5 leading-tight" style={{ color: "var(--ink)" }}>{it.title}</div>
              <div className="text-[9px] font-semibold mt-0.5 leading-tight" style={{ color: "var(--text-mute)" }}>{it.sub}</div>
            </div>
          ))}
        </div>
        {/* ==== Team ==== */}
        {(() => {
          const ds = data?.direct_stats || { activated: 0, not_activated: 0 };
          const ts = data?.team_stats || { total: 0, activated: 0, not_activated: 0 };
          return (
            <>
              <div className="mt-4">
                <SectionCard icon={Network} title="Team" testid="ref-team-card">
                  <div className="grid grid-cols-3 gap-2">
                    <BarStat color="var(--primary-deep)" label="Total Team" value={ts.total} testid="team-total" />
                    <BarStat color="var(--primary)" label="Activated" value={ts.activated} testid="team-active" />
                    <BarStat color="var(--gold)" label="Not Activated" value={ts.not_activated} testid="team-inactive" />
                  </div>
                </SectionCard>
              </div>

              <div className="mt-3">
                <SectionCard icon={Users} title="Direct Referrals" testid="ref-direct-card">
                  <div className="grid grid-cols-3 gap-2">
                    <BarStat color="var(--primary-deep)" label="Total Direct" value={ds.not_activated + ds.activated} testid="direct-total" />
                    <BarStat color="var(--primary)" label="Activated" value={ds.activated} testid="direct-active" />
                    <BarStat color="var(--gold)" label="Not Activated" value={ds.not_activated} testid="direct-inactive" />
                  </div>
                </SectionCard>
              </div>
            </>
          );
        })()}

        {/* ==== Direct / Team tabs (same-size cards) ==== */}
        <div className="grid grid-cols-2 gap-3 mt-5" data-testid="ref-tabs">
          <button onClick={() => { setTab("direct"); setViewRank(null); }} data-testid="ref-tab-direct"
            className="rounded-2xl px-3 py-3 flex items-center justify-center gap-2 font-display font-black text-[15px]"
            style={{ touchAction: "manipulation", ...(tab === "direct"
              ? { background: "linear-gradient(90deg,#2563EB 0%,#16A34A 100%)", color: "#fff", boxShadow: "0 4px 16px rgba(22,163,74,0.30)" }
              : { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }) }}>
            <Users size={18} /> Direct
          </button>
          <button onClick={openTeam} data-testid="ref-tab-team"
            className="rounded-2xl px-3 py-3 flex items-center justify-center gap-2 font-display font-black text-[15px]"
            style={{ touchAction: "manipulation", ...(tab === "team"
              ? { background: "linear-gradient(90deg,#2563EB 0%,#16A34A 100%)", color: "#fff", boxShadow: "0 4px 16px rgba(22,163,74,0.30)" }
              : { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }) }}>
            <Network size={18} /> Team
          </button>
        </div>

        {/* ==== DIRECT panel ==== */}
        {tab === "direct" && (
          <div className="mt-4" data-testid="direct-panel">
            <div className="font-display font-bold text-lg mb-3" style={{ color: "var(--ink)" }}>Direct Referrals</div>
            {(!data?.team || data.team.length === 0) && (
              <div className="text-center text-sm py-6" style={{ color: "var(--text-mute)" }} data-testid="empty-team">
                Share your code to grow your team.
              </div>
            )}
            {data?.team?.length > 0 && (
              <div className="space-y-2.5" data-testid="direct-list">
                {data.team.map((t, i) => <MemberRow key={t.email} t={t} i={i} prefix="direct" />)}
              </div>
            )}
          </div>
        )}

        {/* ==== TEAM panel ==== */}
        {tab === "team" && (
          <div className="mt-4" data-testid="team-panel">
            {viewRank === null ? (
              <>
                <div className="font-display font-bold text-lg mb-3" style={{ color: "var(--ink)" }}>Team by Rank</div>
                {!teamData && (
                  <div className="text-center text-sm py-6" style={{ color: "var(--text-mute)" }} data-testid="team-loading">Loading team…</div>
                )}
                {teamData && (
                  <div className="space-y-2.5" data-testid="rank-list">
                    {teamData.ranks.map((r) => (
                      <button key={r.level} onClick={() => { setViewRank(r.level); setRankPage(0); }} data-testid={`rank-row-${r.level}`}
                        className="w-full rounded-2xl px-3.5 py-3 flex items-center justify-between"
                        style={{ touchAction: "manipulation", background: "var(--surface-2)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full"
                            style={{ color: "#FBBF24", background: "rgba(10,10,10,0.88)", border: "1px solid rgba(245,158,11,0.65)", boxShadow: "0 0 8px rgba(245,158,11,0.3)" }}>
                            ★ V{r.level}
                          </span>
                          <span className="font-display font-bold text-[14px]" style={{ color: "var(--ink)" }}>Rank V{r.level}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-black text-[16px] tabular-nums" style={{ color: "var(--primary)" }} data-testid={`rank-count-${r.level}`}>{r.count}</span>
                          <span className="text-[10px] font-semibold" style={{ color: "var(--text-mute)" }}>members</span>
                          <ChevronRight size={18} style={{ color: "var(--text-mute)" }} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => setViewRank(null)} data-testid="rank-back"
                    className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--surface-3)", touchAction: "manipulation" }}>
                    <ChevronLeft size={20} style={{ color: "var(--ink)" }} />
                  </button>
                  <div className="font-display font-bold text-lg" style={{ color: "var(--ink)" }}>Rank V{viewRank} Members</div>
                </div>
                {(() => {
                  const list = teamData?.members_by_level?.[String(viewRank)] || [];
                  if (list.length === 0) {
                    return <div className="text-center text-sm py-6" style={{ color: "var(--text-mute)" }} data-testid="empty-rank">No members at this rank yet.</div>;
                  }
                  const total = list.length;
                  const totalPages = Math.ceil(total / PAGE);
                  const start = rankPage * PAGE;
                  const slice = list.slice(start, start + PAGE);
                  return (
                    <>
                      <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--text-mute)" }} data-testid="rank-range">
                        Showing {start + 1}–{Math.min(start + PAGE, total)} of {total}
                      </div>
                      <div className="space-y-2.5" data-testid="rank-members-list">
                        {slice.map((t, i) => <MemberRow key={t.email + (start + i)} t={t} i={start + i} prefix="rank" />)}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between gap-3 mt-4" data-testid="rank-pager">
                          <button onClick={() => setRankPage((p) => Math.max(0, p - 1))} disabled={rankPage === 0} data-testid="rank-prev"
                            className="flex-1 rounded-xl py-2.5 font-display font-black text-[14px] flex items-center justify-center gap-1"
                            style={{ touchAction: "manipulation", opacity: rankPage === 0 ? 0.4 : 1,
                              background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}>
                            <ChevronLeft size={16} /> Prev
                          </button>
                          <span className="text-[12px] font-black tabular-nums" style={{ color: "var(--text-mute)" }}>{rankPage + 1}/{totalPages}</span>
                          <button onClick={() => setRankPage((p) => Math.min(totalPages - 1, p + 1))} disabled={rankPage >= totalPages - 1} data-testid="rank-next"
                            className="flex-1 rounded-xl py-2.5 font-display font-black text-[14px] flex items-center justify-center gap-1 text-white"
                            style={{ touchAction: "manipulation", opacity: rankPage >= totalPages - 1 ? 0.4 : 1,
                              background: "linear-gradient(90deg,#2563EB 0%,#16A34A 100%)" }}>
                            Next <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* ==== Commission Log removed per user request ==== */}

        {(data?.pending || 0) > 0 && (
          <div className="mt-3">
            <div className="app-card rounded-2xl p-3 flex items-center gap-2 text-[11px] font-bold" data-testid="ref-pending">
              <Gift size={14} className="text-[color:var(--gold-deep)]" />
              +{fmtUSD(data.pending)} pending · claim in Rewards
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MemberRow = ({ t, i, prefix }) => (
  <div className="rounded-2xl px-3 py-2.5 flex items-center justify-between"
    style={{
      background: "var(--surface-2)",
      border: t.activated ? "1.5px solid #16A34A" : "1.5px solid color-mix(in srgb, var(--gold) 55%, transparent)",
      boxShadow: t.activated ? "0 2px 14px rgba(22,163,74,0.30)" : "0 2px 12px rgba(245,158,11,0.12)",
    }}
    data-testid={`${prefix}-row-${i}`}>
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-display font-black text-[12px] text-white"
        style={{ background: "var(--primary-grad)" }}>
        {(t.name || t.email || "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="font-display font-bold text-[13px] truncate" style={{ color: "var(--ink)" }}>
          {t.name || t.email.split("@")[0]}
        </div>
        <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-mute)" }}>{maskEmail(t.email)}</div>
      </div>
    </div>
    <div className="text-right pl-2 shrink-0">
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-[8px] uppercase tracking-widest font-black"
          style={{ color: t.activated ? "var(--primary)" : "#DC2626" }} data-testid={`${prefix}-status-${i}`}>
          ● {t.activated ? "Active" : "Inactive"}
        </span>
        <span className="text-[8px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full inline-block"
          style={{ color: "#FBBF24", background: "rgba(10,10,10,0.88)", border: "1px solid rgba(245,158,11,0.65)", boxShadow: "0 0 8px rgba(245,158,11,0.3)" }}>
          ★ {rankName(t.rank)}
        </span>
      </div>
      <div className="text-[9px] font-mono mt-0.5" style={{ color: "var(--text-mute)" }}>
        Joined {fmtDate(t.created_at)}
      </div>
      <div className="text-[9px] font-black mt-0.5" style={{ color: "var(--primary)" }} data-testid={`${prefix}-team-${i}`}>
        Total Team: {t.team_size ?? 0}
      </div>
    </div>
  </div>
);


const SectionCard = ({ icon: Icon, title, children, testid }) => (
  <div className="app-card rounded-2xl p-3" data-testid={testid}>
    <div className="flex items-center gap-1.5 mb-2">
      <Icon size={12} className="text-[color:var(--gold-deep)]" />
      <span className="text-[9px] uppercase tracking-[0.25em] font-black text-[color:var(--text-mute)]">{title}</span>
    </div>
    {children}
  </div>
);

const BarStat = ({ color, label, value, testid }) => (
  <div className="rounded-lg px-2 py-1.5 flex items-stretch gap-1.5 min-w-0"
    style={{
      background: `color-mix(in srgb, ${color} 6%, var(--surface))`,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      boxShadow: "var(--shadow-sm)",
    }}
    data-testid={testid}>
    <span className="w-1 rounded-full shrink-0" style={{ background: color }} />
    <div className="min-w-0">
      <div className="text-[8px] uppercase tracking-wider font-bold leading-tight" style={{ color: "var(--text-mute)" }}>{label}</div>
      <div className="font-display font-black text-base tabular-nums" style={{ color: "var(--ink)" }}>{value}</div>
    </div>
  </div>
);
