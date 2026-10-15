import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import api from "@/lib/api";
import { fmtNum } from "@/lib/format";

const shownIds = new Set();
const BLUE_GRAD = "linear-gradient(135deg,#3B82F6 0%,#2563EB 55%,#0B2A5C 100%)";

export default function DepositCelebration() {
  const [alert, setAlert] = useState(null);
  const alertRef = useRef(null);
  const queueRef = useRef([]);
  const timerRef = useRef(null);

  const fireConfetti = () => {
    const fire = (opts) =>
      confetti({ particleCount: 90, spread: 75, zIndex: 9999, ...opts });
    fire({ origin: { x: 0.2, y: 0.7 }, colors: ["#2563EB", "#60A5FA", "#FFFFFF"] });
    fire({ origin: { x: 0.8, y: 0.7 }, colors: ["#2563EB", "#60A5FA", "#FFFFFF"] });
    setTimeout(() => fire({ origin: { x: 0.5, y: 0.5 }, particleCount: 140, spread: 100, colors: ["#3B82F6", "#93C5FD", "#16A34A"] }), 400);
  };

  const show = (a) => {
    alertRef.current = a;
    setAlert(a);
    clearTimeout(timerRef.current);
    if (a) {
      fireConfetti();
      timerRef.current = setTimeout(() => show(queueRef.current.shift() || null), 7000);
    }
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
          // Instant balance refresh across open pages (Asset / BotHub)
          window.dispatchEvent(new CustomEvent("tgx:deposit"));
        }
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { clearInterval(id); clearTimeout(timerRef.current); };
  }, []);

  if (!alert) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-8"
      style={{ background: "rgba(4,25,32,0.72)", backdropFilter: "blur(6px)" }}
      onClick={() => show(queueRef.current.shift() || null)}
      data-testid="deposit-celebration"
    >
      <div
        className="w-full max-w-xs rounded-3xl p-6 text-center text-white relative overflow-hidden"
        style={{ background: BLUE_GRAD, border: "1px solid rgba(96,165,250,0.5)", boxShadow: "0 0 60px rgba(37,99,235,0.35)" }}
      >
        <div className="text-5xl mb-2">🎉</div>
        <div className="text-[10px] uppercase tracking-[0.35em] font-bold" style={{ color: "#93C5FD" }}>
          Deposit Received
        </div>
        <div className="font-display font-black text-4xl mt-2 tabular-nums" data-testid="deposit-celebration-amount">
          +{fmtNum(alert.amount, 2)} USDT
        </div>
        <div className="text-[11px] text-white/70 mt-2">
          {alert.network} · Aapke wallet me credit ho gaya! 🥳
        </div>
        <button
          className="mt-4 px-6 py-2 rounded-full text-[12px] font-black uppercase tracking-widest"
          style={{ background: "rgba(10,10,10,0.85)", border: "1px solid rgba(96,165,250,0.65)", color: "#60A5FA" }}
          onClick={() => show(queueRef.current.shift() || null)}
          data-testid="deposit-celebration-close"
        >
          Awesome!
        </button>
      </div>
    </div>
  );
}
