import { useEffect, useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Crown, ChevronLeft, ChevronRight } from "lucide-react";
import api, { formatApiError } from "@/lib/api";

const IMAGE_BASE = "/ranks";

export default function Rank() {
  const [ranks, setRanks] = useState([]);
  const [me, setMe] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollerRef = useRef(null);

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

  // Reorder: [current, next, ...rest by level]
  const ordered = useMemo(() => {
    if (!ranks.length) return [];
    const cur = me?.current_level ?? 1;
    const nxt = cur < ranks.length ? cur + 1 : null;
    const first = ranks.find((r) => r.level === cur);
    const second = nxt ? ranks.find((r) => r.level === nxt) : null;
    const rest = ranks
      .filter((r) => r.level !== cur && r.level !== nxt)
      .sort((a, b) => a.level - b.level);
    return [first, second, ...rest].filter(Boolean);
  }, [ranks, me]);

  const scrollTo = (idx) => {
    const el = scrollerRef.current;
    if (!el) return;
    const child = el.children[idx];
    if (child) child.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIdx) setActiveIdx(idx);
  };

  const activeRank = ordered[activeIdx];
  const currentLevel = me?.current_level ?? 1;
  const isCurrent = activeRank && activeRank.level === currentLevel;
  const isNext = activeRank && activeRank.level === currentLevel + 1;

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100dvh - 64px)" }}
      data-testid="rank-page"
    >
      {/* Compact header row — replaces PageHeader to save vertical space */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-black text-white tracking-tight">Rank</h1>
          {activeRank && (
            <span
              className="text-[10px] tracking-[0.28em] uppercase font-bold"
              style={{ color: activeRank.color, textShadow: `0 0 6px ${activeRank.color}80` }}
              data-testid="rank-section-label"
            >
              {isCurrent
                ? "★ Your Current"
                : isNext
                ? "→ Next Rank"
                : `Level ${activeRank.level}`}
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#8B9BB4] font-mono">
          {activeIdx + 1} / {ordered.length}
        </span>
      </div>

      {/* Horizontal snap scroller — one full-viewport card per page */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
        style={{ scrollBehavior: "smooth" }}
        data-testid="rank-pager"
      >
        {ordered.map((r, i) => (
          <RankPage
            key={r.level}
            rank={r}
            isCurrent={r.level === currentLevel}
            isAchieved={r.level <= currentLevel}
            progress={r.level === currentLevel + 1 ? me?.progress : null}
            stats={me?.stats}
            index={i}
          />
        ))}
      </div>

      {/* Prev / Next arrows */}
      {ordered.length > 1 && (
        <div className="shrink-0 px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => scrollTo(Math.max(0, activeIdx - 1))}
            disabled={activeIdx === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#B8C4D8] text-xs disabled:opacity-30"
            data-testid="btn-rank-prev"
          >
            <ChevronLeft size={14} /> Prev
          </button>

          {/* Dots indicator */}
          <div className="flex items-center gap-1.5" data-testid="rank-dots">
            {ordered.map((r, i) => (
              <button
                key={r.level}
                onClick={() => scrollTo(i)}
                className="transition-all rounded-full"
                style={{
                  width: i === activeIdx ? 20 : 6,
                  height: 6,
                  background: i === activeIdx ? r.color : "rgba(255,255,255,0.2)",
                  boxShadow: i === activeIdx ? `0 0 6px ${r.color}` : "none",
                }}
                aria-label={`Go to rank ${r.level}`}
              />
            ))}
          </div>

          <button
            onClick={() => scrollTo(Math.min(ordered.length - 1, activeIdx + 1))}
            disabled={activeIdx === ordered.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#B8C4D8] text-xs disabled:opacity-30"
            data-testid="btn-rank-next"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function RankPage({ rank, isCurrent, isAchieved, progress, stats, index }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = `${IMAGE_BASE}/rank_${rank.level}.png`;

  // Compute per-rank processing progress (for every card, not just next rank)
  const localProgress = useMemo(() => {
    if (!stats) return null;
    const directHave = stats.direct_count || 0;
    const directNeed = rank.direct_users || 0;
    const teamHave = stats.total_team || 0;
    const teamNeed = rank.team_size || 0;
    const dr = rank.downline_requirement;
    const downlineHave = dr
      ? Object.entries(stats.downline_ranks || {}).reduce(
          (acc, [lvl, cnt]) => (Number(lvl) >= dr.min_level ? acc + cnt : acc),
          0,
        )
      : 0;
    const parts = [];
    if (directNeed > 0) parts.push(Math.min(1, directHave / directNeed));
    if (teamNeed > 0) parts.push(Math.min(1, teamHave / teamNeed));
    if (dr) parts.push(Math.min(1, downlineHave / dr.count));
    const overall = parts.length
      ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
      : 100;
    return {
      direct_have: directHave,
      direct_needed: directNeed,
      team_have: teamHave,
      team_needed: teamNeed,
      downline_have: downlineHave,
      downline_requirement: dr,
      overall_pct: isAchieved ? 100 : overall,
    };
  }, [rank, stats, isAchieved]);

  return (
    <div
      className="snap-start shrink-0 w-full h-full px-4 pb-2 flex items-center justify-center"
      data-testid={`rank-page-${rank.level}`}
    >
      <div
        className="w-full max-h-full rounded-2xl overflow-hidden border relative flex flex-col"
        style={{
          borderColor: `${rank.color}60`,
          background: "#000",
          boxShadow: `0 0 32px ${rank.color}33`,
        }}
      >
        {/* Image — natural aspect, hugs container width */}
        <div className="relative w-full min-h-0 flex-1">
          {!imgError ? (
            <img
              src={imgSrc}
              alt={`${rank.level} STAR ${rank.title}`}
              className="w-full h-full object-contain object-center select-none block"
              onError={() => setImgError(true)}
              loading={index < 3 ? "eager" : "lazy"}
              draggable={false}
            />
          ) : (
            <div className="aspect-[948/1659]">
              <PlaceholderStar rank={rank} />
            </div>
          )}
        </div>

        {/* Top badges */}
        {isCurrent && (
          <div
            className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#39FF14] text-black"
            style={{ boxShadow: "0 0 12px #39FF14" }}
            data-testid="current-rank-badge"
          >
            ★ YOU
          </div>
        )}

        {isAchieved && !isCurrent && (
          <div
            className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-black/70 text-[#39FF14] border border-[#39FF14]/40"
            data-testid={`achieved-badge-${rank.level}`}
          >
            ✓ UNLOCKED
          </div>
        )}

        {rank.crown && (
          <Crown
            size={24}
            className="absolute top-3 left-3 z-10 text-[#FFD700]"
            style={{ filter: "drop-shadow(0 0 8px #FFD700)" }}
          />
        )}

        {/* Bottom PROCESSING BAR — OVERLAY glass panel at card bottom */}
        {localProgress && (
          <div
            className="absolute inset-x-0 bottom-0 z-10 px-3 py-2 space-y-1.5"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            data-testid={`rank-processing-${rank.level}`}
          >
            {/* Overall progress */}
            <div className="flex items-center justify-between">
              <div
                className="text-[9px] tracking-[0.28em] uppercase font-bold"
                style={{ color: rank.color, textShadow: `0 0 6px ${rank.color}` }}
              >
                {isAchieved ? "Achieved" : "Processing"}
              </div>
              <div
                className={`text-[11px] font-mono font-black tabular-nums ${
                  isAchieved ? "text-[#39FF14]" : "text-white"
                }`}
              >
                {localProgress.overall_pct}%
              </div>
            </div>

            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${localProgress.overall_pct}%`,
                  background: isAchieved
                    ? "linear-gradient(90deg,#39FF14,#7FFF00)"
                    : `linear-gradient(90deg, ${rank.color}, ${rank.glow || rank.color})`,
                  boxShadow: `0 0 8px ${isAchieved ? "#39FF14" : rank.color}`,
                }}
              />
              {!isAchieved && localProgress.overall_pct > 0 && localProgress.overall_pct < 100 && (
                <div
                  className="absolute inset-0 opacity-40 animate-pulse"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${rank.color}88, transparent)`,
                  }}
                />
              )}
            </div>

            {/* Compact inline stats row */}
            {!isAchieved && (localProgress.direct_needed > 0 || localProgress.team_needed > 0) ? (
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                {localProgress.direct_needed > 0 && (
                  <MiniStat
                    label="Direct"
                    have={localProgress.direct_have}
                    need={localProgress.direct_needed}
                    color={rank.color}
                  />
                )}
                {localProgress.team_needed > 0 && (
                  <MiniStat
                    label="Team"
                    have={localProgress.team_have}
                    need={localProgress.team_needed}
                    color={rank.color}
                  />
                )}
                {localProgress.downline_requirement && (
                  <MiniStat
                    label={localProgress.downline_requirement.label.replace("2× ", "")}
                    have={localProgress.downline_have}
                    need={localProgress.downline_requirement.count}
                    color={rank.color}
                  />
                )}
              </div>
            ) : (
              isCurrent && stats && (
                <div className="flex items-center justify-center gap-3 text-[10px]">
                  <span className="text-[#8B9BB4]">
                    Directs: <span className="text-white font-bold">{stats.direct_count}</span>
                  </span>
                  <span className="text-[#8B9BB4]">
                    Team: <span className="text-white font-bold">{stats.total_team}</span>
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, have, need, color }) {
  const done = have >= need;
  return (
    <div className="flex-1 min-w-0 flex items-center justify-between gap-1 px-2 py-1 rounded-md bg-white/[0.03] border border-white/5">
      <span className="text-[#8B9BB4] truncate text-[9px] uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`font-mono font-bold tabular-nums shrink-0 text-[10px] ${
          done ? "text-[#39FF14]" : "text-white"
        }`}
        style={done ? {} : { color }}
      >
        {have}/{need}
      </span>
    </div>
  );
}

function StatMini({ label, value, color }) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-black/40 p-2"
      style={{ boxShadow: `inset 0 0 10px ${color}18` }}
    >
      <div className="text-[9px] uppercase text-[#8B9BB4] tracking-wider">{label}</div>
      <div className="text-lg font-black tabular-nums mt-0.5" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ReqRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-[#B8C4D8]">{label}</span>
      <span className="text-white font-semibold text-right ml-2">{value}</span>
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
        <span className={`font-mono font-semibold ${done ? "text-[#39FF14]" : "text-white"}`}>
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

function PlaceholderStar({ rank }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ background: `radial-gradient(circle at center, ${rank.color}20 0%, #0A0E1A 70%)` }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-2/3 h-2/3"
        style={{ filter: `drop-shadow(0 0 16px ${rank.color})` }}
      >
        <polygon
          points="50,8 62,38 94,38 68,58 78,90 50,72 22,90 32,58 6,38 38,38"
          fill={rank.color}
          stroke={rank.glow || rank.color}
          strokeWidth="1.5"
        />
        <text x="50" y="62" textAnchor="middle" fontSize="34" fill="white" fontWeight="900"
          style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.8))" }}>
          {rank.level}
        </text>
      </svg>
      <div className="text-[10px] text-[#8B9BB4] mt-2 italic">Image coming soon</div>
    </div>
  );
}
