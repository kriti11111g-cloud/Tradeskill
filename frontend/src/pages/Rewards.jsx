import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, LineChart, Info, CalendarClock } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { useCachedState } from "@/lib/useCachedState";

const USDT_LOGO = "https://coin-images.coingecko.com/coins/images/325/small/Tether.png";

const CARD_BORDER = "1px solid var(--border)";

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
      style={{ background: "var(--surface-2)", border: CARD_BORDER, color: "var(--good)" }}
      data-testid="pool-info-btn"
    >
      <Info size={15} />
    </button>
  );

  return (
    <div className="pb-2">
      <PageHeader title="Pool" subtitle="Royalty Pools" right={infoBtn} />

      <div className="px-3 space-y-2.5">
        {cards.map((cat) => (
          <div
            key={cat.key}
            className="rounded-2xl overflow-hidden app-card"
            style={{ background: "var(--surface)", border: CARD_BORDER }}
            data-testid={`pool-card-${cat.key}`}
          >
            {/* Card header */}
            <div
              className="flex items-center gap-2 px-2.5 py-2"
              style={{ background: "var(--surface-2)", borderBottom: CARD_BORDER }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--surface-3)", border: CARD_BORDER }}
              >
                <cat.Icon size={15} style={{ color: "var(--gold)" }} strokeWidth={2.4} />
              </div>
              <span className="font-display font-black leading-[1.1] text-[12px] flex-1" style={{ color: "var(--ink)" }}>
                {cat.name}
              </span>
              <div className="w-px h-7 shrink-0" style={{ background: "var(--border)" }} />
              <div className="flex flex-col items-center shrink-0 px-1">
                <span className="text-[7.5px] font-bold uppercase tracking-wide leading-none mb-0.5" style={{ color: "var(--text-mute)" }}>
                  Total Pool
                </span>
                <span className="flex items-center gap-0.5 font-display font-black text-[13px] tabular-nums leading-none" style={{ color: "var(--good)" }}>
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
                  style={{ border: CARD_BORDER, touchAction: "manipulation" }}
                  data-testid={`${cat.key}-level-${l.level}`}
                >
                  <span
                    className="font-display font-black text-[11px] tracking-wide py-0.5 text-center"
                    style={{ background: "var(--surface-3)", color: "var(--text-mute)" }}
                  >
                    V{l.level}
                  </span>
                  <span
                    className="flex items-center justify-center gap-1 py-1 font-display font-black text-[13px] tabular-nums"
                    style={{ background: "var(--surface)", color: "var(--ink)" }}
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
          style={{ background: "var(--surface-3)", border: CARD_BORDER }}
          data-testid="pool-cutoff-note"
        >
          <CalendarClock size={14} className="shrink-0 mt-0.5" style={{ color: "var(--gold)" }} strokeWidth={2.2} />
          <div className="text-[9px] font-semibold leading-snug" style={{ color: "var(--text-mute)" }}>
            Daily cutoff is 00:00 UTC so everyone sees the same rule.
            {pool?.next_cutoff_at && (
              <>
                {" "}Your local time:{" "}
                <span
                  className="inline-flex items-center font-black px-1 py-0.5 rounded text-white text-[9px] tabular-nums"
                  style={{ background: "var(--good)" }}
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
