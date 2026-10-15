import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Crown, ChevronLeft, ChevronRight, ChevronDown, Users, Share2,
  TrendingUp, Rocket, Lightbulb, Target, CheckCircle2, Coins,
  HandCoins, Bot, Percent, BarChart3, Gift,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";

const vName = (lvl) => `V${lvl}`;

export default function Rank() {
  const [ranks, setRanks] = useState([]);
  const [me, setMe] = useState(null);
  const [viewLevel, setViewLevel] = useState(null);
  const [incomeOpen, setIncomeOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, m] = await Promise.all([
          api.get("/ranks/config"),
          api.get("/ranks/me"),
        ]);
        setRanks(c.data?.ranks || []);
        setMe(m.data);
        setViewLevel(m.data?.current_level ?? 1);
      } catch (e) {
        toast.error(formatApiError(e));
      }
    })();
  }, []);

  const currentLevel = me?.current_level ?? 1;
  const maxLevel = ranks.length || 10;
  const rank = useMemo(
    () => ranks.find((r) => r.level === viewLevel) || null,
    [ranks, viewLevel],
  );
  const prevRank = useMemo(
    () => ranks.find((r) => r.level === viewLevel - 1) || null,
    [ranks, viewLevel],
  );
  const nextRank = useMemo(
    () => ranks.find((r) => r.level === viewLevel + 1) || null,
    [ranks, viewLevel],
  );

  if (!rank) {
    return (
      <div className="flex items-center justify-center" style={{ height: "calc(100dvh - 64px)" }} data-testid="rank-page">
        <div className="text-[color:var(--text-mute)] text-sm">Loading rank details…</div>
      </div>
    );
  }

  const isAchieved = rank.level <= currentLevel;
  const stats = me?.stats;

  // progress toward THIS rank
  const prog = (() => {
    if (!stats) return 100;
    if (isAchieved) return 100;
    const parts = [];
    if (rank.direct_users > 0) parts.push(Math.min(1, (stats.direct_count || 0) / rank.direct_users));
    if (rank.team_size > 0) parts.push(Math.min(1, (stats.total_team || 0) / rank.team_size));
    const dr = rank.downline_requirement;
    if (dr) {
      const have = Object.entries(stats.downline_ranks || {}).reduce(
        (acc, [lvl, cnt]) => (Number(lvl) >= dr.min_level ? acc + cnt : acc), 0);
      parts.push(Math.min(1, have / dr.count));
    }
    return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 100;
  })();

  const incomeCards = [
    { icon: HandCoins, color: "#2563EB", title: "Direct", value: `$${rank.direct_income}`, sub: "Per activation" },
    { icon: Gift, color: "#16A34A", title: "Support", value: `${rank.support_pct}%`, sub: "Of direct income" },
    { icon: Bot, color: "#7C3AED", title: "Bot Difference", value: `$${rank.bot_difference_usd ?? 0}`, sub: "Activation override" },
    { icon: Percent, color: "#EA580C", title: "Trading Commission", value: `${rank.commission_pct}%`, sub: "Of team profit" },
    { icon: TrendingUp, color: "#DC2626", title: "Commission Difference", value: `${rank.commission_difference_pct ?? rank.commission_pct}%`, sub: "Differential override" },
    { icon: Coins, color: "#0891B2", title: "Daily Global Pool · Activation", value: `$${rank.activation_pool_usd ?? 0}`, sub: "Pool share / activation" },
    { icon: BarChart3, color: "#CA8A04", title: "Daily Global Pool · Trading", value: `${rank.trading_royalty_pct ?? 0}%`, sub: "Pool share / profit" },
  ];

  return (
    <div className="overflow-y-auto no-scrollbar pb-6" style={{ height: "calc(100dvh - 64px)" }} data-testid="rank-page">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-3 pb-2 flex items-center justify-between"
           style={{ background: "var(--bg)", borderBottom: "1px solid var(--border-soft)" }}>
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-black text-[color:var(--text)] tracking-tight">Rank</h1>
          <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-[color:var(--text-mute)]">Details</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
             style={{ background: "var(--gold-grad, linear-gradient(90deg,#F59E0B,#FBBF24))", color: "#1a1a1a" }}
             data-testid="rank-of-badge">
          <Crown size={13} />
          <span className="text-[11px] font-black">{vName(rank.level)} OF {maxLevel}</span>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-2">
        {/* HERO */}
        <div className="rounded-2xl overflow-hidden relative text-white px-4 py-5"
             style={{ background: "linear-gradient(115deg,#0F9D58 0%,#1565C0 55%,#1E40AF 100%)", boxShadow: "var(--shadow-lg)" }}
             data-testid={`rank-hero-${rank.level}`}>
          <div className="flex items-center gap-4">
            <StarMedallion level={rank.level} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: "#FDE68A" }}>
                <Crown size={13} /> Your Current Rank
              </div>
              <div className="font-display font-black leading-none mt-1"
                   style={{ fontSize: 46, textShadow: "0 2px 10px rgba(0,0,0,.35)" }}
                   data-testid={`rank-title-${rank.level}`}>
                {vName(rank.level)}
              </div>
              <div className="text-[13px] font-bold tracking-wide" style={{ color: "#FDE68A" }}>
                {isAchieved ? "RANK ACHIEVED" : "TARGET RANK"}
              </div>
              <div className="inline-flex mt-1.5 px-3 py-1 rounded-full text-[11px] font-black"
                   style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.25)" }}>
                {vName(rank.level)} OF {maxLevel}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[12px] font-semibold" style={{ color: "#E8F5E9" }}>
            <BarChart3 size={14} />
            {isAchieved && nextRank
              ? `Great progress! Keep growing for ${vName(nextRank.level)}`
              : isAchieved ? "Top rank reached 👑" : `Keep growing to unlock ${vName(rank.level)}`}
          </div>
        </div>

        {/* 7 TYPES OF INCOME — collapsible header */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid #1E40AF", boxShadow: "var(--shadow-sm)" }}>
          <button
            onClick={() => setIncomeOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-2.5 active:opacity-80"
            data-testid="income-toggle-btn"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: "rgba(245,158,11,.15)" }}>
              <Coins size={18} color="#CA8A04" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-[14px] font-black text-[color:var(--text)] leading-tight">
                7 Types of Income <span style={{ color: "var(--primary)" }}>at {vName(rank.level)}</span>
              </div>
              <div className="text-[11px] text-[color:var(--text-mute)]">Earn from multiple income sources</div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300"
                 style={{ background: "var(--primary)", color: "#fff", transform: incomeOpen ? "rotate(180deg)" : "none" }}>
              <ChevronDown size={18} />
            </div>
          </button>

          {incomeOpen && (
            <div className="px-3 pb-3 pt-1 space-y-1.5" data-testid="income-cards">
              {incomeCards.map((c) => (
                <div key={c.title}
                     className="flex items-center gap-2 rounded-lg px-2.5 py-0.5"
                     style={{ background: "var(--surface, var(--bg))", border: "1px solid #1E40AF", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                     data-testid={`income-card-${c.title.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${c.color}1A` }}>
                    <c.icon size={13} color={c.color} />
                  </div>
                  <span className="text-[12.5px] font-bold text-[color:var(--text)] truncate flex-1">{c.title}</span>
                  <span className="text-[12px] font-black text-white px-2 py-0.5 rounded-md shrink-0 tabular-nums inline-flex items-center justify-center min-w-[62px]"
                        style={{ background: c.color }}>{c.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RANK PROGRESS */}
        <div className="rounded-2xl px-4 py-2.5 flex flex-col justify-center" style={{ background: "var(--card)", border: "1px solid #1E40AF", boxShadow: "var(--shadow-sm)", minHeight: 72 }}
             data-testid="rank-progress-block">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,.12)" }}>
                <BarChart3 size={18} color="var(--primary)" />
              </div>
              <span className="text-[13px] font-black text-[color:var(--text)]">Rank Progress</span>
            </div>
            <span className="text-[15px] font-black tabular-nums" style={{ color: prog >= 100 ? "var(--good)" : "var(--primary)" }}>{prog}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
            <div className="h-full rounded-full transition-all duration-500"
                 style={{ width: `${prog}%`, background: prog >= 100 ? "linear-gradient(90deg,#16A34A,#0F9D58)" : "linear-gradient(90deg,#1565C0,#0F9D58)" }} />
          </div>
        </div>

        {/* Requirements */}
        <div className="grid grid-cols-2 gap-2">
          <ReqCard icon={Users} color="#2563EB" label="Required Team" value={rank.team_size} sub="Total team members" testid="req-team" />
          <ReqCard icon={Share2} color="#16A34A" label="Required Directs" value={rank.direct_users} sub="Direct members" testid="req-directs" />
        </div>

        {/* Previous / Next rank */}
        <div className="grid grid-cols-2 gap-2">
          {/* Previous */}
          <button
            disabled={!prevRank}
            onClick={() => prevRank && (setViewLevel(prevRank.level), setIncomeOpen(false))}
            className="rounded-2xl px-4 py-2.5 text-left text-white relative overflow-hidden disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#0B2E66,#123C85)", border: "1px solid rgba(255,255,255,.12)" }}
            data-testid="prev-rank-card"
          >
            <div className="flex items-center gap-2">
              <MiniStar level={prevRank?.level} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/70">Previous</span>
                  <ChevronLeft size={12} className="text-white/70" />
                </div>
                <div className="text-[14px] font-black leading-none mt-0.5">{prevRank ? vName(prevRank.level) : "—"}</div>
                {prevRank && (
                  <div className="flex items-center gap-1 text-[8px] font-bold mt-0.5" style={{ color: "#6EE7B7" }}>
                    <CheckCircle2 size={9} /> {prevRank.level <= currentLevel ? "Completed" : "Locked"}
                  </div>
                )}
              </div>
            </div>
          </button>

          {/* Next */}
          <button
            disabled={!nextRank}
            onClick={() => nextRank && (setViewLevel(nextRank.level), setIncomeOpen(false))}
            className="rounded-2xl px-4 py-2.5 text-left text-white relative overflow-hidden disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#0B6E3B,#128A4A)", border: "1px solid rgba(255,255,255,.12)" }}
            data-testid="next-rank-card"
          >
            <div className="flex items-center gap-2">
              <MiniStar level={nextRank?.level} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/80">Next</span>
                  <ChevronRight size={12} className="text-white/80" />
                </div>
                <div className="text-[14px] font-black leading-none mt-0.5">{nextRank ? vName(nextRank.level) : "MAX"}</div>
                {nextRank && (
                  <div className="flex items-center gap-1 text-[8px] font-bold mt-0.5" style={{ color: "#FDE68A" }}>
                    <Target size={9} /> Target Rank
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Footer tip */}
        <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2" style={{ background: "var(--card)", border: "1px solid #1E40AF", minHeight: 72 }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,.12)" }}>
            <Lightbulb size={18} color="#2563EB" />
          </div>
          <div>
            <div className="text-[12px] font-black text-[color:var(--text)]">Higher Rank = Higher Income</div>
            <div className="text-[10px] text-[color:var(--text-soft)]">
              {nextRank ? `Achieve ${vName(nextRank.level)} to unlock more income benefits and global rewards.`
                        : "You've reached the top rank — maximum income unlocked. 👑"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReqCard({ icon: Icon, color, label, value, sub, testid }) {
  return (
    <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2" style={{ background: "var(--card)", border: "1px solid #1E40AF", boxShadow: "var(--shadow-sm)" }} data-testid={testid}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}1A` }}>
        <Icon size={14} color={color} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[8px] font-black uppercase tracking-widest text-[color:var(--text-mute)] block leading-none truncate">{label}</span>
        <span className="text-[16px] font-black text-[color:var(--text)] leading-none tabular-nums block mt-0.5">{value}</span>
        <span className="text-[8px] font-semibold text-[color:var(--text-mute)] block leading-none mt-0.5 truncate">{sub}</span>
      </div>
    </div>
  );
}

function MiniStar({ level }) {
  if (!level) return <span className="w-7 h-7" />;
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
         style={{ background: "radial-gradient(circle at 35% 30%,#F59E0B,#B45309)", border: "1.5px solid #FDE68A" }}>
      <span className="font-display font-black text-[9px]" style={{ color: "#083344" }}>{`V${level}`}</span>
    </div>
  );
}

function StarMedallion({ level }) {
  return (
    <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center relative shrink-0"
         style={{ background: "conic-gradient(from 210deg,#B45309,#F59E0B,#FDE68A,#F59E0B,#B45309,#F59E0B,#FDE68A,#B45309)", padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}>
      <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
           style={{ background: "radial-gradient(circle at 32% 28%,#0F4C56,#083344 55%,#041F27)", border: "1px solid rgba(253,230,138,.35)" }}>
        <svg viewBox="0 0 100 100" className="w-12 h-12" style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,.45))" }}>
          <defs>
            <linearGradient id={`sg-${level}`} x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor="#FDE68A" /><stop offset="45%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <polygon points="50,6 61.8,36.8 94,36.8 68,56.4 78.2,88 50,69 21.8,88 32,56.4 6,36.8 38.2,36.8"
                   fill={`url(#sg-${level})`} stroke="#FDE68A" strokeWidth="1.6" strokeLinejoin="round" />
          <text x="50" y="58" textAnchor="middle" fontSize="24" fontWeight="900" fill="#083344" style={{ fontFamily: "Unbounded, sans-serif" }}>
            {`V${level}`}
          </text>
        </svg>
      </div>
    </div>
  );
}
