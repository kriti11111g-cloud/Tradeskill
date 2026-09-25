import { useEffect, useRef, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import api from "@/lib/api";
import { fmtNum } from "@/lib/format";

const CONFETTI_COLORS = ["#16A34A", "#22C55E", "#2563EB", "#3B82F6", "#F59E0B", "#F5C518"];
const PIECES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 137) % 100,
  delay: (i % 12) * 0.12,
  dur: 2.2 + ((i * 53) % 10) / 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + (i % 3) * 3,
  rot: (i * 97) % 360,
}));

const shownIds = new Set();

export default function DepositCelebration() {
  const [alert, setAlert] = useState(null);
  const alertRef = useRef(null);
  const queueRef = useRef([]);
  const timerRef = useRef(null);

  const show = (a) => {
    alertRef.current = a;
    setAlert(a);
    clearTimeout(timerRef.current);
    if (a) timerRef.current = setTimeout(() => show(queueRef.current.shift() || null), 7000);
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get("/bot-wallet/deposit-alerts");
        const fresh = data.filter((a) => !shownIds.has(a.id));
        if (fresh.length) {
          fresh.forEach((a) => shownIds.add(a.id));
          api.post("/bot-wallet/deposit-alerts/ack", { ids: fresh.map((a) => a.id) }).catch(() => {});
          queueRef.current.push(...fresh);
          if (!alertRef.current) show(queueRef.current.shift());
        }
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { clearInterval(id); clearTimeout(timerRef.current); };
  }, []);

  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 pointer-events-none" data-testid="deposit-celebration">
      <style>{`
        @keyframes dc-fall { 0% { transform: translateY(-12vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(105vh) rotate(720deg); opacity: 0.15; } }
        @keyframes dc-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes dc-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.45); } 50% { box-shadow: 0 0 0 18px rgba(22,163,74,0); } }
      `}</style>
      {PIECES.map((p, i) => (
        <span key={i} className="absolute top-0 rounded-sm" style={{
          left: `${p.left}%`, width: p.size, height: p.size * 1.6, background: p.color,
          transform: `rotate(${p.rot}deg)`,
          animation: `dc-fall ${p.dur}s linear ${p.delay}s infinite`,
        }} />
      ))}
      <div className="relative w-full max-w-[320px] rounded-3xl p-6 text-center pointer-events-auto"
        style={{ background: "var(--surface)", border: "1.5px solid rgba(34,197,94,0.5)", animation: "dc-pop 0.45s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}>
        <button onClick={() => show(queueRef.current.shift() || null)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "var(--surface-3)", touchAction: "manipulation" }} data-testid="deposit-celebration-close">
          <X size={16} style={{ color: "var(--ink)" }} />
        </button>
        <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-white mb-3"
          style={{ background: "linear-gradient(135deg,#22C55E,#16A34A)", animation: "dc-pulse 1.6s ease-out infinite" }}>
          <PartyPopper size={30} />
        </div>
        <div className="font-display font-black text-[20px]" style={{ color: "var(--ink)" }}>Deposit Received!</div>
        <div className="font-display font-black text-[32px] tabular-nums mt-1" style={{ color: "#16A34A" }} data-testid="deposit-celebration-amount">
          +{fmtNum(alert.amount, 2)} USDT
        </div>
        <div className="text-[12px] font-bold mt-1 uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>
          {alert.network} · credited to your wallet
        </div>
      </div>
    </div>
  );
}
