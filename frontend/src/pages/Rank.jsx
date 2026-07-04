import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Users, UserPlus, Award, TrendingUp, HeartHandshake } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";

const IMAGE_BASE = "/ranks";

export default function Rank() {
  const [ranks, setRanks] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, m] = await Promise.all([
          api.get("/ranks/config"),
          api.get("/ranks/me"),
        ]);
        setRanks(c.data?.ranks || []);
        setMe(m.data);
      } catch (e) {
        toast.error(formatApiError(e));
      }
    })();
  }, []);

  const currentLevel = me?.current_level ?? 1;

  return (
    <div className="pb-28" data-testid="rank-page">
      <PageHeader title="Rank Levels" subtitle="1 STAR to 10 STAR" showBack={false} />

      {/* Current rank hero */}
      {me && (
        <div className="px-4 mt-2" data-testid="rank-current-banner">
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: `${ranks[currentLevel - 1]?.color}40`,
              background: `linear-gradient(135deg, ${ranks[currentLevel - 1]?.color}10, transparent)`,
              boxShadow: `0 0 24px ${ranks[currentLevel - 1]?.color}22`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black"
                style={{
                  background: `${ranks[currentLevel - 1]?.color}20`,
                  color: ranks[currentLevel - 1]?.color,
                  boxShadow: `inset 0 0 12px ${ranks[currentLevel - 1]?.color}40`,
                }}
              >
                {currentLevel}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#8B9BB4]">Your Rank</div>
                <div
                  className="text-lg font-bold tracking-wide"
                  style={{ color: ranks[currentLevel - 1]?.color }}
                >
                  {me.current_title}
                </div>
                <div className="text-[10px] text-[#8B9BB4]">
                  Directs: <span className="text-white">{me.stats?.direct_count || 0}</span>{" "}
                  · Team: <span className="text-white">{me.stats?.total_team || 0}</span>
                </div>
              </div>
              {currentLevel === 10 && (
                <Crown size={32} className="text-[#FFD700]" style={{ filter: "drop-shadow(0 0 8px #FFD700)" }} />
              )}
            </div>

            {me.progress && me.next_rank && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-[10px] text-[#8B9BB4] mb-2">
                  Next: <span className="text-white font-semibold">{me.next_rank.title}</span>
                </div>
                <ProgressBar
                  label="Direct Users"
                  have={me.progress.direct_have}
                  need={me.progress.direct_needed}
                  color={me.next_rank.color}
                />
                <ProgressBar
                  label="Team Size"
                  have={me.progress.team_have}
                  need={me.progress.team_needed}
                  color={me.next_rank.color}
                />
                {me.progress.downline_requirement && (
                  <ProgressBar
                    label={me.progress.downline_requirement.label}
                    have={me.progress.downline_have}
                    need={me.progress.downline_requirement.count}
                    color={me.next_rank.color}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rank cards grid */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3" data-testid="rank-grid">
        {ranks.map((r) => (
          <RankCard
            key={r.level}
            rank={r}
            isCurrent={r.level === currentLevel}
            isUnlocked={r.level <= currentLevel}
          />
        ))}
      </div>

      <div className="px-4 mt-4 text-center text-[10px] text-[#8B9BB4]">
        <TrendingUp size={12} className="inline mr-1" />
        Higher rank = higher direct income + commission % + bigger team rewards
      </div>
    </div>
  );
}

function ProgressBar({ label, have, need, color }) {
  const pct = need > 0 ? Math.min(100, (have / need) * 100) : 0;
  const done = have >= need;
  return (
    <div className="mb-2" data-testid={`progress-${label.toLowerCase().replace(/ /g, "-")}`}>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-[#B8C4D8]">{label}</span>
        <span className={`font-mono ${done ? "text-[#39FF14]" : "text-white"}`}>
          {have} / {need}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: done ? "#39FF14" : color,
            boxShadow: `0 0 8px ${done ? "#39FF14" : color}`,
          }}
        />
      </div>
    </div>
  );
}

function RankCard({ rank, isCurrent, isUnlocked }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = `${IMAGE_BASE}/rank_${rank.level}.png`;

  return (
    <div
      className={`relative rounded-xl overflow-hidden border transition ${
        isCurrent ? "ring-2" : ""
      }`}
      style={{
        borderColor: `${rank.color}${isUnlocked ? "60" : "20"}`,
        background: `linear-gradient(180deg, ${rank.color}${isUnlocked ? "10" : "05"}, #0A0E1A)`,
        boxShadow: isCurrent ? `0 0 24px ${rank.color}66` : `0 0 8px ${rank.color}22`,
        ...(isCurrent && { "--tw-ring-color": rank.color }),
      }}
      data-testid={`rank-card-${rank.level}`}
    >
      {/* Image slot (or generated placeholder) */}
      <div className="relative aspect-square w-full bg-black/40">
        {!imgError ? (
          <img
            src={imgSrc}
            alt={rank.title}
            className={`w-full h-full object-cover ${isUnlocked ? "" : "grayscale opacity-50"}`}
            onError={() => setImgError(true)}
          />
        ) : (
          <PlaceholderStar rank={rank} isUnlocked={isUnlocked} />
        )}

        {/* Star number badge (top-left) */}
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest"
          style={{
            background: `${rank.color}30`,
            color: rank.color,
            border: `1px solid ${rank.color}80`,
          }}
        >
          {rank.level} STAR
        </div>

        {isCurrent && (
          <div
            className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-[#39FF14] text-black"
            data-testid="current-rank-badge"
          >
            ★ You
          </div>
        )}

        {rank.crown && (
          <Crown
            size={20}
            className="absolute bottom-2 right-2 text-[#FFD700]"
            style={{ filter: "drop-shadow(0 0 6px #FFD700)" }}
          />
        )}
      </div>

      {/* Info footer */}
      <div className="p-2.5 space-y-1.5">
        <div
          className="text-center text-[11px] font-bold tracking-wide uppercase"
          style={{ color: isUnlocked ? rank.color : "#556" }}
        >
          {rank.title}
        </div>

        <div className="grid grid-cols-2 gap-1 text-[9px] text-[#B8C4D8]">
          <div className="flex items-center gap-1">
            <Award size={9} style={{ color: rank.color }} />
            <span>Direct</span>
            <span className="ml-auto font-mono font-bold text-white">${rank.direct_income}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp size={9} style={{ color: rank.color }} />
            <span>Comm</span>
            <span className="ml-auto font-mono font-bold text-white">{rank.commission_pct}%</span>
          </div>
          <div className="flex items-center gap-1">
            <UserPlus size={9} style={{ color: rank.color }} />
            <span>Directs</span>
            <span className="ml-auto font-mono font-bold text-white">{rank.direct_users || "—"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users size={9} style={{ color: rank.color }} />
            <span>Team</span>
            <span className="ml-auto font-mono font-bold text-white">{rank.team_size || "—"}</span>
          </div>
        </div>

        {rank.downline_requirement && (
          <div className="text-[9px] text-[#8B9BB4] pt-1 border-t border-white/5 flex items-center gap-1">
            <HeartHandshake size={9} style={{ color: rank.color }} />
            <span className="truncate">{rank.downline_requirement.label}</span>
          </div>
        )}
        {rank.team_note && !rank.downline_requirement && (
          <div className="text-[9px] text-[#8B9BB4] pt-1 border-t border-white/5 truncate">
            {rank.team_note}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderStar({ rank, isUnlocked }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative"
      style={{
        background: `radial-gradient(circle at center, ${rank.color}20 0%, #0A0E1A 70%)`,
      }}
    >
      <svg viewBox="0 0 100 100" className="w-3/5 h-3/5" style={{ filter: `drop-shadow(0 0 10px ${rank.color})` }}>
        <polygon
          points="50,8 62,38 94,38 68,58 78,90 50,72 22,90 32,58 6,38 38,38"
          fill={isUnlocked ? rank.color : "#334"}
          stroke={rank.glow || rank.color}
          strokeWidth="1.5"
        />
        <text
          x="50"
          y="60"
          textAnchor="middle"
          className="font-black"
          fontSize="30"
          fill="white"
          style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.8))" }}
        >
          {rank.level}
        </text>
      </svg>
      <div className="text-[8px] text-[#8B9BB4] mt-1 italic">Image coming soon</div>
    </div>
  );
}
