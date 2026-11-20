import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, LineChart, Info, CalendarClock } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { useCachedState } from "@/lib/useCachedState";

const USDT_LOGO = "https://coin-images.coingecko.com/coins/images/325/small/Tether.png";

const BLUE_HEADER = "linear-gradient(135deg,#2563EB 0%,#1D4ED8 52%,#1E3A8A 100%)";
const GREEN_BADGE = "linear-gradient(135deg,#22C55E 0%,#16A34A 58%,#15803D 100%)";
const LEVEL_HEADER = "linear-gradient(180deg,#3B74F2 0%,#1E40AF 100%)";

const fmt2 = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Usdt = ({ size = 12 }) => (
  <img
    src={USDT_LOGO}
    alt="USDT"
    className="inline-block rounded-full align-middle shrink-0"
    style={{ width: size, height: size }}
  />
);

export default function Rewards() {
  const [pool, setPool] = useCachedState("rewards_pool", null);
  const navigate = useNavigate();
  useEffect(() => {
    api.get("/pool/summary").then(({ data }) => setPool(data)).catch(() => {});
  }, []);

  const cards = [
    { key: "activation_pool", name: "Bot Activation Royalty Pool", total: pool?.activation_total, Icon: Gift },
    { key: "trading_pool", name: "Trading Royalty Pool", total: pool?.trading_total, Icon: LineChart },
  ];

  const infoBtn = (
    <button
      type="button"
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "#FFFFFF", border: "1.5px solid #2563EB", color: "#1D4ED8" }}
      data-testid="pool-info-btn"
    >
      <Info size={15} />
    </button>
  );

  return (
    <div className="pb-2" style={{ background: "#FFFFFF" }}>
      <PageHeader title="Pool" subtitle="Royalty Pools" right={infoBtn} />

      <div className="px-3 space-y-2.5">
        {cards.map((cat) => (
          <div
            key={cat.key}
            className="rounded-2xl overflow-hidden"
            style={{ background: "#FFFFFF", border: "1.5px solid #CBDDFA", boxShadow: "0 4px 12px rgba(37,99,235,0.07)" }}
            data-testid={`pool-card-${cat.key}`}
          >
            {/* Card header */}
            <div className="flex items-center gap-2 px-2.5 py-2" style={{ background: BLUE_HEADER }}>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                <cat.Icon size={15} className="text-white" strokeWidth={2.4} />
              </div>
              <span className="font-display font-black text-white leading-[1.1] text-[12px] flex-1">
                {cat.name}
              </span>
              <div className="w-px h-7 shrink-0" style={{ background: "rgba(255,255,255,0.28)" }} />
              <div
                className="rounded-lg px-2 py-1 flex flex-col items-center shrink-0"
                style={{ background: GREEN_BADGE, boxShadow: "0 2px 6px rgba(22,163,74,0.32)" }}
              >
                <span className="text-[7.5px] font-bold uppercase tracking-wide text-white/90 leading-none mb-0.5">
                  Total Pool
                </span>
                <span className="flex items-center gap-0.5 text-white font-display font-black text-[13px] tabular-nums leading-none">
                  <Usdt size={14} />
                  {fmt2(cat.total)}
                </span>
              </div>
            </div>

            {/* Levels grid */}
            <div className="grid grid-cols-3 gap-1.5 p-2">
              {(pool?.[cat.key] || []).map((l) => (
                <button
                  key={l.level}
                  type="button"
                  onClick={() => navigate(`/revenue?tab=global_${Math.min(l.level, 10)}`)}
                  className="rounded-lg overflow-hidden flex flex-col active:scale-[0.97] transition-transform"
                  style={{ border: "1.5px solid #BBD3F5", touchAction: "manipulation" }}
                  data-testid={`${cat.key}-level-${l.level}`}
                >
                  <span
                    className="text-white font-display font-black text-[11px] tracking-wide py-0.5 text-center"
                    style={{ background: LEVEL_HEADER }}
                  >
                    V{l.level}
                  </span>
                  <span
                    className="flex items-center justify-center gap-1 py-1 font-display font-black text-[13px] tabular-nums"
                    style={{ background: "#EAF8EF", color: "#0B1E3F" }}
                  >
                    <Usdt size={16} />
                    {fmt2(l.balance)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Cutoff note */}
        <div
          className="rounded-xl px-2.5 py-1.5 flex items-start gap-1.5"
          style={{ background: "#F4F8FF", border: "1.5px solid #CBDDFA" }}
          data-testid="pool-cutoff-note"
        >
          <CalendarClock size={14} className="shrink-0 mt-0.5" style={{ color: "#1D4ED8" }} strokeWidth={2.2} />
          <div className="text-[9px] font-semibold leading-snug" style={{ color: "#334155" }}>
            Daily cutoff is 00:00 UTC so everyone sees the same rule.
            {pool?.next_cutoff_at && (
              <>
                {" "}Your local time:{" "}
                <span
                  className="inline-flex items-center font-black px-1 py-0.5 rounded text-white text-[9px] tabular-nums"
                  style={{ background: "#1D4ED8" }}
                >
                  {new Date(pool.next_cutoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </>
            )}
            {" "}· Pools auto-distribute level-wise and reset to <Usdt size={12} /> 0 — no manual action.
          </div>
        </div>
      </div>
    </div>
  );
}
