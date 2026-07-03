import PageHeader from "@/components/PageHeader";

const HERO_IMAGE =
  "https://customer-assets.emergentagent.com/job_tgx-api-gateway/artifacts/v63grioq_file_000000003580720b84b6c5daae428f49.png";

/**
 * Coordinates are in percentages so they scale with the image at every size.
 * These points are hand-tuned to fall on the circuit traces / fan / chip.
 */
const TWINKLES = [
  { top: "38%", left: "18%", delay: "0s" },
  { top: "42%", left: "28%", delay: "0.6s" },
  { top: "35%", left: "45%", delay: "1.1s" },
  { top: "36%", left: "62%", delay: "0.3s" },
  { top: "44%", left: "78%", delay: "1.7s" },
  { top: "48%", left: "88%", delay: "0.9s" },
  { top: "52%", left: "12%", delay: "2.1s" },
  { top: "56%", left: "30%", delay: "1.4s" },
  { top: "58%", left: "48%", delay: "0.5s" },
  { top: "54%", left: "68%", delay: "2.4s" },
  { top: "60%", left: "82%", delay: "1.9s" },
  { top: "46%", left: "50%", delay: "3.0s" }, // near chip
  { top: "50%", left: "52%", delay: "0.8s" }, // near chip
];

// Traces that run from edges toward the chip (center-top area).
// Each trace is an SVG line with a moving dash to look like a light packet.
const TRACES = [
  { d: "M 5,55 L 40,50 L 45,42", delay: "0s" },
  { d: "M 95,55 L 60,50 L 55,42", delay: "0.4s" },
  { d: "M 15,72 L 45,60 L 50,45", delay: "0.9s" },
  { d: "M 85,72 L 55,60 L 50,45", delay: "1.3s" },
  { d: "M 8,40 L 30,42 L 45,42", delay: "1.8s" },
  { d: "M 92,40 L 70,42 L 55,42", delay: "0.6s" },
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

          {/* Central chip pulse (behind the AI chip) */}
          <span className="tgx-chip-pulse" data-testid="chip-pulse" />

          {/* Fan glow (right side, roughly where the fan is) */}
          <span className="tgx-fan-glow" data-testid="fan-glow" />

          {/* Diagonal scan line sweeping the whole card */}
          <span className="tgx-scan-sweep" aria-hidden />
        </div>
      </div>
    </div>
  );
}
