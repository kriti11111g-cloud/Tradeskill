import PageHeader from "@/components/PageHeader";

const HERO_IMAGE =
  "https://customer-assets.emergentagent.com/job_tgx-api-gateway/artifacts/v63grioq_file_000000003580720b84b6c5daae428f49.png";

/**
 * Each dot sits on a real small chip component visible on the PCB. Positions
 * are picked in the strip BETWEEN the main AI chip (top < 42%) and the
 * "HUB X BOT" wordmark (top > 54%) so text is never covered.
 */
const TWINKLES = [
  // Left-edge PCB — two small chips visible near the left border
  { top: "47%", left: "7%", delay: "0s" },
  { top: "51%", left: "14%", delay: "1.2s" },
  // Right-edge PCB — two small chips visible near the right border
  { top: "47%", left: "93%", delay: "0.6s" },
  { top: "51%", left: "86%", delay: "1.8s" },
];

/**
 * Traces START from just below the chip perimeter and flow OUTWARD along
 * the visible PCB tracks — down-left, down-right and straight down. They
 * never go into or across the chip.
 * viewBox is 0..100 on both axes so coords are simple percentages.
 */
const TRACES = [
  { d: "M 40,42 L 30,52 L 18,58", delay: "0s" },     // chip → down-left
  { d: "M 60,42 L 70,52 L 82,58", delay: "0.5s" },   // chip → down-right
  { d: "M 45,44 L 42,58 L 30,66", delay: "1.0s" },   // chip → mid-left
  { d: "M 55,44 L 58,58 L 70,66", delay: "1.5s" },   // chip → mid-right
  { d: "M 50,44 L 50,60 L 50,68", delay: "0.7s" },   // chip → straight down
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

          {/* Twinkling circuit lights (red→green pulse) */}
          {TWINKLES.map((t, i) => (
            <span
              key={i}
              className="tgx-twinkle"
              style={{ top: t.top, left: t.left, animationDelay: t.delay }}
            />
          ))}

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
                style={{ animationDelay: tr.delay }}
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
