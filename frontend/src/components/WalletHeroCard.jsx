import { Crown, ShieldCheck, ArrowUpRight, ArrowDownRight, Download, Send, ArrowRightLeft, Repeat } from "lucide-react";
import { fmtNum, fmtPct } from "@/lib/format";

export default function WalletHeroCard({ balance = 0, changePct = 0, rankTitle = "STARTER", onAction, children }) {
  const isUp = changePct >= 0;
  const actions = [
    { icon: Download, label: "Deposit", type: "deposit", testid: "hero-deposit" },
    { icon: Send, label: "Send", type: "send", testid: "hero-send" },
    { icon: ArrowRightLeft, label: "P2P", type: "p2p", testid: "hero-p2p" },
    { icon: Repeat, label: "Swap", type: "swap", testid: "hero-swap" },
  ];
  return (
    <div
      className="rounded-xl p-5 text-white relative overflow-hidden mb-4"
      style={{ background: "var(--premium-grad)", boxShadow: "var(--shadow-lg)" }}
      data-testid="hero-balance"
    >
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 65%)" }}
      />
      <div
        className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full opacity-25"
        style={{ background: "radial-gradient(circle, var(--gold) 0%, transparent 65%)" }}
      />

      <div
        className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full"
        style={{
          background: "rgba(10,10,10,0.88)",
          border: "1px solid rgba(245,158,11,0.65)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.35), 0 0 10px rgba(245,158,11,0.35)",
        }}
      >
        <Crown size={11} color="#FBBF24" strokeWidth={2.5} />
        <span
          className="text-[9px] font-black uppercase tracking-widest"
          style={{ color: "#FBBF24" }}
          data-testid="hero-rank-badge"
        >
          ★ {rankTitle}
        </span>
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-1.5 mb-1">
          <ShieldCheck size={12} color="#FFFFFF" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-90">
            Total Balance · USDT
          </span>
        </div>

        <div className="flex items-baseline gap-1 mt-2" data-testid="total-assets">
          <span className="text-3xl opacity-90 font-black">$</span>
          <span className="text-4xl font-black font-mono tracking-tight">
            {fmtNum(Math.floor(balance), 0)}
          </span>
          <span className="text-xl opacity-70 font-bold font-mono">
            .{((balance % 1) * 100).toFixed(0).padStart(2, "0")}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{ background: "#FFFFFF", boxShadow: "0 2px 10px rgba(0,0,0,0.25)" }}
            data-testid="hero-change-pill"
          >
            {isUp ? (
              <ArrowUpRight size={13} color="#16A34A" strokeWidth={3} />
            ) : (
              <ArrowDownRight size={13} color="#DC2626" strokeWidth={3} />
            )}
            <span
              className="text-[12px] font-black font-mono"
              style={{ color: isUp ? "#16A34A" : "#DC2626" }}
            >
              {fmtPct(changePct)}
            </span>
          </div>
          <span className="text-[11px] font-bold text-white/95">Market avg · 24h</span>
        </div>

        {children}

        <div className="grid grid-cols-4 gap-2 mt-4">
          {actions.map((a) => (
            <button
              key={a.type}
              type="button"
              onClick={() => onAction?.(a.type)}
              data-testid={a.testid}
              className="flex flex-col items-center gap-1 py-2 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.28)",
                backdropFilter: "blur(12px)",
              }}
            >
              <a.icon size={16} className="text-white" />
              <span className="text-[10px] font-bold text-white/95">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
