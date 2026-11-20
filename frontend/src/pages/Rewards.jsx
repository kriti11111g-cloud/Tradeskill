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

const Usdt = ({ size = 15 }) => (
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
      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "#FFFFFF", border: "1.5px solid #2563EB", color: "#1D4ED8" }}
      data-testid="pool-info-btn"
    >
      <Info size={17} />
    </button>
  );

  return (
    <div className="pb-4" style={{ background: "#FFFFFF" }}>
      <PageHeader title="Pool" subtitle="Royalty Pools" right={infoBtn} />

      <div className="px-4 space-y-4">
        {cards.map((cat) => (
          <div
            key={cat.key}
            className="rounded-[22px] overflow-hidden"
            style={{ background: "#FFFFFF", border: "1.5px solid #CBDDFA", boxShadow: "0 6px 18px rgba(37,99,235,0.08)" }}
            data-testid={`pool-card-${cat.key}`}
          >
            {/* Card header */}
            <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ background: BLUE_HEADER }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                <cat.Icon size={19} className="text-white" strokeWidth={2.4} />
              </div>
              <span className="font-display font-black text-white leading-[1.12] text-[15.5px] flex-1">
                {cat.name}
              </span>
              <div className="w-px h-10 shrink-0" style={{ background: "rgba(255,255,255,0.28)" }} />
              <div
                className="rounded-xl px-3 py-1.5 flex flex-col items-center shrink-0"
                style={{ background: GREEN_BADGE, boxShadow: "0 2px 8px rgba(22,163,74,0.35)" }}
              >
                <span className="text-[9px] font-bold uppercase tracking-wide text-white/90 leading-none mb-1">
                  Total Pool
                </span>
                <span className="flex items-center gap-1 text-white font-display font-black text-[18px] tabular-nums leading-none">
                  <Usdt size={16} />
                  {fmt2(cat.total)}
                </span>
              </div>
            </div>

            {/* Levels grid */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5">
              {(pool?.[cat.key] || []).map((l) => (
                <button
                  key={l.level}
                  type="button"
                  onClick={() => navigate(`/revenue?tab=global_${Math.min(l.level, 10)}`)}
                  className="rounded-xl overflow-hidden flex flex-col active:scale-[0.97] transition-transform"
                  style={{ border: "1.5px solid #BBD3F5", touchAction: "manipulation" }}
                  data-testid={`${cat.key}-level-${l.level}`}
                >
                  <span
                    className="text-white font-display font-black text-[14px] tracking-wide py-2 text-center"
                    style={{ background: LEVEL_HEADER }}
                  >
                    V{l.level}
                  </span>
                  <span
                    className="flex items-center justify-center gap-1.5 py-3.5 font-display font-black text-[19px] tabular-nums"
                    style={{ background: "#EAF8EF", color: "#0B1E3F" }}
                  >
                    <Usdt size={17} />
                    {fmt2(l.balance)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Cutoff note */}
        <div
          className="rounded-2xl px-3.5 py-3 flex items-start gap-2.5"
          style={{ background: "#F4F8FF", border: "1.5px solid #CBDDFA" }}
          data-testid="pool-cutoff-note"
        >
          <CalendarClock size={20} className="shrink-0 mt-0.5" style={{ color: "#1D4ED8" }} strokeWidth={2.2} />
          <div className="text-[11px] font-semibold leading-snug" style={{ color: "#334155" }}>
            Daily cutoff is 00:00 UTC so everyone sees the same rule.
            {pool?.next_cutoff_at && (
              <>
                {" "}Your local time:{" "}
                <span
                  className="inline-flex items-center font-black px-1.5 py-0.5 rounded-md text-white text-[10.5px] tabular-nums"
                  style={{ background: "#1D4ED8" }}
                >
                  {new Date(pool.next_cutoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </>
            )}
            {" "}· Pools auto-distribute level-wise and reset to{" "}
            <Usdt size={12} /> 0 — no manual action.
          </div>
        </div>
      </div>
    </div>
  );
}
