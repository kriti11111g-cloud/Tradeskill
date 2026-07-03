import PageHeader from "@/components/PageHeader";

const HERO_IMAGE =
  "https://customer-assets.emergentagent.com/job_tgx-api-gateway/artifacts/v63grioq_file_000000003580720b84b6c5daae428f49.png";

/**
 * Traces START from the chip perimeter and flow OUTWARD in ALL 4 directions
 * (top, bottom, left, right + diagonals). Each has its own duration and
 * delay so they fire independently — sometimes one, sometimes several,
 * sometimes with a long pause between packets.
 * viewBox is 0..100 on both axes so coords are simple percentages.
 * Chip roughly occupies: left 34→66%, top 18→42%.
 */
const TRACES = [
  // === DOWNWARD from chip ===
  { d: "M 40,42 L 30,52 L 18,58", delay: "0s",   dur: "2.6s" },
  { d: "M 60,42 L 70,52 L 82,58", delay: "1.7s", dur: "3.4s" },
  { d: "M 50,42 L 50,55 L 50,65", delay: "3.1s", dur: "2.2s" },
  { d: "M 45,44 L 40,58 L 28,66", delay: "5.4s", dur: "4.0s" },
  { d: "M 55,44 L 62,58 L 74,66", delay: "0.9s", dur: "3.0s" },
  // === UPWARD from chip (into the candlestick chart area) ===
  { d: "M 42,20 L 30,14 L 20,8",  delay: "2.4s", dur: "3.6s" },
  { d: "M 58,20 L 70,14 L 82,8",  delay: "4.8s", dur: "2.8s" },
  { d: "M 50,18 L 50,10 L 50,4",  delay: "6.2s", dur: "3.2s" },
  // === LEFTWARD from chip ===
  { d: "M 34,26 L 22,26 L 8,26",  delay: "1.3s", dur: "2.4s" },
  { d: "M 34,34 L 20,34 L 6,34",  delay: "3.9s", dur: "3.8s" },
  // === RIGHTWARD from chip ===
  { d: "M 66,26 L 78,26 L 92,26", delay: "0.4s", dur: "3.0s" },
  { d: "M 66,34 L 80,34 L 94,34", delay: "5.7s", dur: "2.6s" },
];

export default function BotHub() {
  return (
    <div className="pb-24" data-testid="bothub-page">
      <PageHeader title="Welcome to TGX BOT" subtitle="AI Powered Exchange" showBack={false} />

      {/* Hero image with animated overlays */}
      <div className="px-4 mt-2">
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-[#39FF14]/25"
          style={{
            boxShadow: "0 0 30px rgba(57,255,20,0.15), inset 0 0 20px rgba(0,0,0,0.4)",
          }}
          data-testid="bothub-hero"
        >
          <img
            src={HERO_IMAGE}
            alt="TGX BOT — AI Powered Exchange"
            className="w-full h-auto block select-none"
            loading="eager"
            draggable={false}
          />

          {/* === ANIMATED OVERLAYS === */}

          {/* Electric traces (SVG lines with moving dash) */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="tgxTraceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF3B3B" stopOpacity="0" />
                <stop offset="45%" stopColor="#FF3B3B" stopOpacity="0.9" />
                <stop offset="55%" stopColor="#39FF14" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#39FF14" stopOpacity="0" />
              </linearGradient>
            </defs>
            {TRACES.map((tr, i) => (
              <path
                key={i}
                d={tr.d}
                stroke="url(#tgxTraceGrad)"
                strokeWidth="0.4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="8 92"
                className="tgx-trace"
                style={{ animationDelay: tr.delay, animationDuration: tr.dur }}
              />
            ))}
          </svg>

          {/* Fan glow (right side, roughly where the fan is) */}
          <span className="tgx-fan-glow" data-testid="fan-glow" />
        </div>
      </div>
    </div>
  );
}
