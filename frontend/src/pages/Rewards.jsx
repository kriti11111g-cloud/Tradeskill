import { useEffect, useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD } from "@/lib/format";

export default function Rewards() {
  const [pool, setPool] = useState(null);
  useEffect(() => {
    api.get("/pool/summary").then(({ data }) => setPool(data)).catch(() => {});
  }, []);

  return (
    <div className="pb-4">
      <PageHeader title="Pool" subtitle="Royalty Pools" />

      {/* ==== Main Pool Card ==== */}
      <div className="px-4 space-y-2">
        {[
          { key: "activation_pool", name: "Bot Activation Royalty Pool", total: pool?.activation_total, Icon: Gift },
          { key: "trading_pool", name: "Trading Royalty Pool", total: pool?.trading_total, Icon: Sparkles },
        ].map((cat) => (
          <div key={cat.key} className="rounded-2xl border border-[color:var(--border)] overflow-hidden app-card" data-testid={`pool-card-${cat.key}`}>
            <div className="flex items-center justify-between px-3.5 pt-2.5 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[color:var(--gold)]/12 flex items-center justify-center">
                  <cat.Icon size={15} className="text-[color:var(--gold)]" />
                </div>
                <span className="font-display font-black text-[13px]">{cat.name}</span>
              </div>
              <span className="font-display font-black text-[15px] tabular-nums text-[color:var(--good)]" data-testid={`${cat.key}-total`}>
                {fmtUSD(cat.total || 0)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 px-3.5 pb-3">
              {(pool?.[cat.key] || []).map((l) => (
                <div key={l.level} className="rounded-lg px-1.5 py-1.5 flex flex-col items-center justify-center gap-0.5"
                  style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }} data-testid={`${cat.key}-level-${l.level}`}>
                  <span className="text-[9px] font-black tracking-wide" style={{ color: "var(--text-mute)" }}>LEVEL {l.level}</span>
                  <span className="text-[12.5px] font-black tabular-nums" style={{ color: "var(--ink)" }}>{fmtUSD(l.balance)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="rounded-xl border border-[color:var(--border)] px-3.5 py-2 app-card" data-testid="pool-cutoff-note">
          <div className="text-[9.5px] font-semibold leading-snug" style={{ color: "var(--text-mute)" }}>
            Daily cutoff is 00:00 UTC so everyone sees the same rule.
            {pool?.next_cutoff_at && (
              <> Your local time: <span className="font-black" style={{ color: "var(--ink)" }}>
                {new Date(pool.next_cutoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span></>
            )}
            {" "}· Pools auto-distribute level-wise and reset to $0 — no manual action.
          </div>
        </div>
      </div>
    </div>
  );
}
