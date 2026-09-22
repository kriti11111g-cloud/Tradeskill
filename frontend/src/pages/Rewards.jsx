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
      <div className="px-4">
        <div className="rounded-3xl border border-[color:var(--border)] overflow-hidden" data-testid="pool-main-card">
          {[
            { key: "activation_pool", name: "Bot Activation Royalty Pool", total: pool?.activation_total, Icon: Gift },
            { key: "trading_pool", name: "Trading Royalty Pool", total: pool?.trading_total, Icon: Sparkles },
          ].map((cat, ci) => (
            <div key={cat.key} className={ci === 1 ? "border-t border-[color:var(--border)]" : ""}>
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <div className="flex items-center gap-2">
                  <cat.Icon size={16} className="text-[color:var(--gold)]" />
                  <span className="font-display font-bold text-[13px]">{cat.name}</span>
                </div>
                <span className="font-display font-black tabular-nums text-[color:var(--good)]" data-testid={`${cat.key}-total`}>
                  {fmtUSD(cat.total || 0)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 px-4 pb-3.5">
                {(pool?.[cat.key] || []).map((l) => (
                  <div key={l.level} className="rounded-lg px-2 py-1.5 flex items-center justify-between"
                    style={{ background: "var(--surface-3)" }} data-testid={`${cat.key}-level-${l.level}`}>
                    <span className="text-[9.5px] font-black" style={{ color: "var(--text-mute)" }}>L{l.level}</span>
                    <span className="text-[10.5px] font-bold tabular-nums">{fmtUSD(l.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="px-4 py-2.5 border-t border-[color:var(--border)]" data-testid="pool-cutoff-note">
            <div className="text-[10px] font-semibold leading-snug" style={{ color: "var(--text-mute)" }}>
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
    </div>
  );
}
