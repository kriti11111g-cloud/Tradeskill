import { useEffect, useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Crown, ChevronLeft, ChevronRight, Star } from "lucide-react";
import api, { formatApiError } from "@/lib/api";

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
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-black text-[color:var(--text)] tracking-tight">Rank</h1>
          {activeRank && (
            <span
              className="text-[10px] tracking-[0.28em] uppercase font-bold"
              style={{ color: "var(--gold-deep)" }}
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
        <span className="text-[10px] text-[color:var(--text-mute)] font-mono">
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
        {ordered.map((r) => (
          <RankPage
            key={r.level}
            rank={r}
            isCurrent={r.level === currentLevel}
            isAchieved={r.level <= currentLevel}
            stats={me?.stats}
          />
        ))}
      </div>

      {/* Prev / Next arrows */}
      {ordered.length > 1 && (
        <div className="shrink-0 px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => scrollTo(Math.max(0, activeIdx - 1))}
            disabled={activeIdx === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[color:var(--text)]/5 border border-[color:var(--border-soft)] text-[color:var(--text-soft)] text-xs disabled:opacity-30"
            data-testid="btn-rank-prev"
          >
            <ChevronLeft size={14} /> Prev
          </button>

          <div className="flex items-center gap-1.5" data-testid="rank-dots">
            {ordered.map((r, i) => (
              <button
                key={r.level}
                onClick={() => scrollTo(i)}
                className="transition-all rounded-full"
                style={{
                  width: i === activeIdx ? 20 : 6,
                  height: 6,
                  background: i === activeIdx ? "var(--primary)" : "var(--border)",
                }}
                aria-label={`Go to rank ${r.level}`}
              />
            ))}
          </div>

          <button
            onClick={() => scrollTo(Math.min(ordered.length - 1, activeIdx + 1))}
            disabled={activeIdx === ordered.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[color:var(--text)]/5 border border-[color:var(--border-soft)] text-[color:var(--text-soft)] text-xs disabled:opacity-30"
            data-testid="btn-rank-next"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function RankPage({ rank, isCurrent, isAchieved, stats }) {
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
        className="w-full rounded-2xl overflow-hidden relative flex flex-col text-white"
        style={{
          background: "var(--hero-grad)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Top row — crown + badges */}
        <div className="flex items-center justify-between px-4 pt-4">
          {rank.crown ? (
            <Crown
              size={22}
              color="#FBBF24"
              style={{ filter: "drop-shadow(0 0 8px var(--gold-glow))" }}
            />
          ) : (
            <span />
          )}
          {isCurrent ? (
            <div
              className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
              style={{
                background: "rgba(10,10,10,0.88)",
                border: "1px solid rgba(245,158,11,0.65)",
                color: "#FBBF24",
              }}
              data-testid="current-rank-badge"
            >
              ★ YOU
            </div>
          ) : isAchieved ? (
            <div
              className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-black/50 border border-white/25 text-white"
              data-testid={`achieved-badge-${rank.level}`}
            >
              ✓ UNLOCKED
            </div>
          ) : (
            <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/10 border border-white/20 text-white/70">
              LOCKED
            </div>
          )}
        </div>

        {/* Star + Name */}
        <div className="flex flex-col items-center pt-5 pb-4">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center relative"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 0 30px rgba(245,158,11,0.30)",
            }}
          >
            <Star size={44} color="#FBBF24" fill="#FBBF24" strokeWidth={1.5} />
            <span
              className="absolute font-display font-black text-[15px]"
              style={{ color: "#083344", marginTop: 2 }}
            >
              {rank.level - 1 > 0 ? rank.level - 1 : "S"}
            </span>
          </div>
          <div
            className="font-display font-black text-3xl tracking-wide mt-3"
            data-testid={`rank-title-${rank.level}`}
          >
            {rank.title}
          </div>
          <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/60 mt-1">
            Level {rank.level} of 10
          </div>
        </div>

        {/* Income stats */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          <IncomeStat label="Direct Income" value={`$${rank.direct_income}`} />
          <IncomeStat label="Commission" value={`${rank.commission_pct}%`} />
          <IncomeStat label="Support" value={`${rank.support_pct}%`} />
        </div>

        {/* Processing bar */}
        {localProgress && (
          <div
            className="px-4 py-3 space-y-1.5"
            style={{
              background: "rgba(0,0,0,0.35)",
              borderTop: "1px solid rgba(255,255,255,0.12)",
            }}
            data-testid={`rank-processing-${rank.level}`}
          >
            <div className="flex items-center justify-between">
              <div
                className="text-[9px] tracking-[0.28em] uppercase font-bold"
                style={{ color: "#FBBF24" }}
              >
                {isAchieved ? "Achieved" : "Processing"}
              </div>
              <div className="text-[11px] font-mono font-black tabular-nums text-white">
                {localProgress.overall_pct}%
              </div>
            </div>

            <div className="h-1.5 rounded-full bg-white/15 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${localProgress.overall_pct}%`,
                  background: isAchieved
                    ? "linear-gradient(90deg,#16A34A,#0F766E)"
                    : "var(--gold-grad)",
                  boxShadow: "0 0 8px rgba(245,158,11,0.5)",
                }}
              />
              {!isAchieved && localProgress.overall_pct > 0 && localProgress.overall_pct < 100 && (
                <div
                  className="absolute inset-0 opacity-40 animate-pulse"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(245,158,11,0.55), transparent)",
                  }}
                />
              )}
            </div>

            {!isAchieved && (localProgress.direct_needed > 0 || localProgress.team_needed > 0) ? (
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                {localProgress.direct_needed > 0 && (
                  <MiniStat label="Direct" have={localProgress.direct_have} need={localProgress.direct_needed} />
                )}
                {localProgress.team_needed > 0 && (
                  <MiniStat label="Team" have={localProgress.team_have} need={localProgress.team_needed} />
                )}
                {localProgress.downline_requirement && (
                  <MiniStat
                    label={localProgress.downline_requirement.label.replace("2× ", "")}
                    have={localProgress.downline_have}
                    need={localProgress.downline_requirement.count}
                  />
                )}
              </div>
            ) : (
              isCurrent &&
              stats && (
                <div className="flex items-center justify-center gap-3 text-[10px]">
                  <span className="text-white/60">
                    Directs: <span className="text-white font-bold">{stats.direct_count}</span>
                  </span>
                  <span className="text-white/60">
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

function IncomeStat({ label, value }) {
  return (
    <div
      className="rounded-xl px-2 py-2.5 text-center"
      style={{
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.20)",
      }}
    >
      <div className="text-[8px] uppercase tracking-widest font-bold text-white/60">{label}</div>
      <div className="font-display font-black text-base mt-0.5" style={{ color: "#FBBF24" }}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, have, need }) {
  const done = have >= need;
  return (
    <div className="flex-1 min-w-0 flex items-center justify-between gap-1 px-2 py-1 rounded-md bg-white/10 border border-white/15">
      <span className="text-white/60 truncate text-[9px] uppercase tracking-wider">{label}</span>
      <span
        className="font-mono font-bold tabular-nums shrink-0 text-[10px]"
        style={{ color: done ? "#6EE7B7" : "#FBBF24" }}
      >
        {have}/{need}
      </span>
    </div>
  );
}
