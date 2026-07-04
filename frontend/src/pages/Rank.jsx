import { useEffect, useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Crown, ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
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
    <div className="pb-28" data-testid="rank-page">
      <PageHeader title="Rank Levels" subtitle="1 STAR → 10 STAR" showBack={false} />

      {/* Section label */}
      {activeRank && (
        <div className="px-4 mt-1 flex items-center justify-between">
          <span
            className="text-[10px] tracking-[0.28em] uppercase font-bold"
            style={{ color: activeRank.color }}
            data-testid="rank-section-label"
          >
            {isCurrent ? "★ Your Current Rank" : isNext ? "→ Next Rank" : `Level ${activeRank.level} of 10`}
          </span>
          <span className="text-[10px] text-[#8B9BB4]">
            {activeIdx + 1} / {ordered.length}
          </span>
        </div>
      )}

      {/* Horizontal snap scroller — one full-width card per page */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="mt-2 flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
        style={{ scrollBehavior: "smooth" }}
        data-testid="rank-pager"
      >
        {ordered.map((r, i) => (
          <RankPage
            key={r.level}
            rank={r}
            isCurrent={r.level === currentLevel}
            progress={r.level === currentLevel + 1 ? me?.progress : null}
            stats={me?.stats}
            index={i}
          />
        ))}
      </div>

      {/* Prev / Next arrows */}
      {ordered.length > 1 && (
        <div className="px-4 mt-3 flex items-center justify-between">
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

function RankPage({ rank, isCurrent, progress, stats, index }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = `${IMAGE_BASE}/rank_${rank.level}.png`;

  return (
    <div
      className="snap-start shrink-0 w-full px-4"
      data-testid={`rank-page-${rank.level}`}
    >
      <div
        className="rounded-2xl overflow-hidden border relative"
        style={{
          borderColor: `${rank.color}60`,
          background: `linear-gradient(180deg, ${rank.color}12, #050810 60%)`,
          boxShadow: `0 0 32px ${rank.color}33`,
        }}
      >
        {/* Card image */}
        <div className="relative w-full aspect-square bg-black/50">
          {!imgError ? (
            <img
              src={imgSrc}
              alt={`${rank.level} STAR ${rank.title}`}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
              loading={index < 3 ? "eager" : "lazy"}
            />
          ) : (
            <PlaceholderStar rank={rank} />
          )}

          {isCurrent && (
            <div
              className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#39FF14] text-black"
              style={{ boxShadow: "0 0 12px #39FF14" }}
              data-testid="current-rank-badge"
            >
              ★ YOU
            </div>
          )}

          {rank.crown && (
            <Crown
              size={28}
              className="absolute top-3 left-3 text-[#FFD700]"
              style={{ filter: "drop-shadow(0 0 8px #FFD700)" }}
            />
          )}
        </div>

        {/* Below-image info strip */}
        <div className="p-4 space-y-3">
          <div className="text-center">
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#8B9BB4]">
              {rank.level} STAR
            </div>
            <div
              className="text-xl font-black tracking-wider uppercase mt-0.5"
              style={{ color: rank.color, textShadow: `0 0 10px ${rank.color}80` }}
            >
              {rank.title}
            </div>
          </div>

          {/* Income triple */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatMini label="Direct" value={`$${rank.direct_income}`} color={rank.color} />
            <StatMini label="Commission" value={`${rank.commission_pct}%`} color={rank.color} />
            <StatMini label="Support" value={`${rank.support_pct}%`} color={rank.color} />
          </div>

          {/* Team requirements — only from rank 2 */}
          {rank.level > 1 && (
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: `${rank.color}40`, background: `${rank.color}08` }}
            >
              <div
                className="text-[9px] tracking-[0.3em] uppercase font-bold mb-2"
                style={{ color: rank.color }}
              >
                Team Requirement
              </div>
              <ReqRow label="Direct Users" value={`${rank.direct_users}`} />
              <ReqRow
                label="Total Team"
                value={rank.team_note ? `${rank.team_size} (${rank.team_note})` : String(rank.team_size)}
              />
              {rank.downline_requirement && (
                <ReqRow label="Downline Rank" value={rank.downline_requirement.label} />
              )}
            </div>
          )}

          {/* Progress bars — only when this is user's next rank */}
          {progress && (
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: `${rank.color}40`, background: `${rank.color}08` }}
              data-testid="rank-progress-box"
            >
              <div
                className="text-[9px] tracking-[0.3em] uppercase font-bold mb-2"
                style={{ color: rank.color }}
              >
                Your Progress
              </div>
              <ProgressBar
                label="Direct Users"
                have={progress.direct_have}
                need={progress.direct_needed}
                color={rank.color}
              />
              <ProgressBar
                label="Team Size"
                have={progress.team_have}
                need={progress.team_needed}
                color={rank.color}
              />
              {progress.downline_requirement && (
                <ProgressBar
                  label={progress.downline_requirement.label}
                  have={progress.downline_have}
                  need={progress.downline_requirement.count}
                  color={rank.color}
                />
              )}
            </div>
          )}

          {/* Current stats display */}
          {isCurrent && stats && (
            <div className="text-[10px] text-[#8B9BB4] text-center">
              Your Team — Directs:{" "}
              <span className="text-white font-semibold">{stats.direct_count}</span> · Team:{" "}
              <span className="text-white font-semibold">{stats.total_team}</span>
            </div>
          )}
        </div>
      </div>
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
