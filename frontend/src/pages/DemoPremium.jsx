import { useState, useMemo } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Sun,
  Moon,
  TrendingUp,
  Wallet,
  Send,
  Download,
  Repeat,
  ChevronRight,
  Bell,
  Search,
  Home,
  BarChart3,
  Bot,
  User,
  ShieldCheck,
  Flame,
  Crown,
  Award,
  Gift,
} from "lucide-react";

/**
 * DEMO — HUBXBOT PREMIUM
 * Palette: Midnight Navy + Emerald Green + Royal Gold
 *   Navy      #0A1929  (dark bg base)
 *   Emerald   #10B981  (primary · profits)
 *   Gold      #F59E0B  (rank · rewards · premium)
 * Vibe: Rolex-tier premium. Bank-grade trust. MLM rank aspiration.
 */
export default function DemoPremium() {
  const [mode, setMode] = useState("dark");

  const t = useMemo(() => {
    if (mode === "light") {
      return {
        bg: "radial-gradient(1200px 800px at 100% -10%, rgba(16,185,129,0.08) 0%, transparent 55%), radial-gradient(900px 700px at 0% 100%, rgba(245,158,11,0.06) 0%, transparent 60%), #FAFCFB",
        surface: "#FFFFFF",
        surfaceGlass: "rgba(255,255,255,0.75)",
        surfaceSoft: "#F1F5F4",
        border: "rgba(10,25,41,0.10)",
        borderStrong: "rgba(10,25,41,0.20)",
        text: "#0A1929",
        textSoft: "#1E3A5F",
        textMute: "#647890",
        emerald: "#059669",
        emeraldDeep: "#047857",
        gold: "#D97706",
        goldDeep: "#B45309",
        navy: "#0A1929",
        heroGrad: "linear-gradient(135deg,#0A1929 0%,#0F3A2E 55%,#059669 100%)",
        primaryGrad: "linear-gradient(135deg,#10B981 0%,#059669 100%)",
        goldGrad: "linear-gradient(135deg,#F59E0B 0%,#D97706 100%)",
        premiumGrad: "linear-gradient(135deg,#059669 0%,#D97706 100%)",
        emeraldGlow: "0 0 24px rgba(16,185,129,0.35)",
        goldGlow: "0 0 24px rgba(245,158,11,0.45)",
        cardShadow: "0 8px 24px -8px rgba(10,25,41,0.15), 0 0 0 1px rgba(10,25,41,0.05)",
        heroShadow: "0 24px 48px -16px rgba(10,25,41,0.5), 0 0 0 1px rgba(245,158,11,0.15)",
        good: "#059669",
        bad: "#DC2626",
      };
    }
    return {
      bg: "radial-gradient(1200px 800px at 100% -10%, rgba(16,185,129,0.14) 0%, transparent 55%), radial-gradient(900px 700px at 0% 100%, rgba(245,158,11,0.10) 0%, transparent 60%), #0A1929",
      surface: "#0F2137",
      surfaceGlass: "rgba(15,33,55,0.6)",
      surfaceSoft: "#132B47",
      border: "rgba(148,180,205,0.14)",
      borderStrong: "rgba(148,180,205,0.24)",
      text: "#F8FAFC",
      textSoft: "#CBD5E1",
      textMute: "#7C93AD",
      emerald: "#10B981",
      emeraldDeep: "#059669",
      gold: "#FBBF24",
      goldDeep: "#F59E0B",
      navy: "#0A1929",
      heroGrad: "linear-gradient(135deg,#0F3A2E 0%,#0A1929 40%,#0F3A2E 100%)",
      primaryGrad: "linear-gradient(135deg,#10B981 0%,#059669 100%)",
      goldGrad: "linear-gradient(135deg,#FBBF24 0%,#F59E0B 100%)",
      premiumGrad: "linear-gradient(135deg,#10B981 0%,#F59E0B 100%)",
      emeraldGlow: "0 0 24px rgba(16,185,129,0.5)",
      goldGlow: "0 0 24px rgba(251,191,36,0.55)",
      cardShadow: "0 8px 24px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(148,180,205,0.08)",
      heroShadow: "0 24px 48px -16px rgba(0,0,0,0.7), 0 0 0 1px rgba(251,191,36,0.18)",
      good: "#10B981",
      bad: "#F87171",
    };
  }, [mode]);

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300"
      style={{ background: t.bg, color: t.text, fontFamily: "Outfit, sans-serif" }}
      data-testid="demo-premium"
    >
      <div className="max-w-[440px] mx-auto px-4 pt-4 pb-28">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center relative"
              style={{ background: t.primaryGrad, boxShadow: t.emeraldGlow }}
            >
              <Zap size={18} className="text-white" strokeWidth={2.5} />
              <div
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                style={{ background: t.gold, borderColor: t.surface, boxShadow: t.goldGlow }}
              >
                <Crown size={7} className="text-white" strokeWidth={3} />
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: t.textMute }}>
                Welcome back
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-black" style={{ color: t.text }}>
                  Rajesh Kumar
                </span>
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest text-white"
                  style={{ background: t.goldGrad, boxShadow: t.goldGlow }}
                >
                  PRO
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode(mode === "light" ? "dark" : "light")}
              data-testid="premium-mode-toggle"
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: t.surfaceGlass, border: `1px solid ${t.border}`, backdropFilter: "blur(12px)" }}
            >
              {mode === "light" ? <Moon size={16} color={t.emerald} /> : <Sun size={16} color={t.gold} />}
            </button>
            <button
              className="w-10 h-10 rounded-full flex items-center justify-center relative"
              style={{ background: t.surfaceGlass, border: `1px solid ${t.border}`, backdropFilter: "blur(12px)" }}
            >
              <Bell size={16} color={t.textSoft} />
              <span
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ background: t.gold, boxShadow: t.goldGlow }}
              />
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 mb-5"
          style={{ background: t.surfaceGlass, border: `1px solid ${t.border}`, backdropFilter: "blur(20px)" }}
        >
          <Search size={16} color={t.textMute} />
          <span className="text-sm" style={{ color: t.textMute }}>
            Search coins, pairs, wallets
          </span>
        </div>

        {/* Balance Hero — Navy with Emerald glow + Gold trim */}
        <div
          className="rounded-3xl p-5 text-white relative overflow-hidden mb-4"
          style={{ background: t.heroGrad, boxShadow: t.heroShadow }}
        >
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, #10B981 0%, transparent 65%)" }}
          />
          <div
            className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full opacity-25"
            style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 65%)" }}
          />

          {/* Gold ribbon top-right */}
          <div
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(251,191,36,0.18)",
              border: "1px solid rgba(251,191,36,0.4)",
            }}
          >
            <Award size={10} color="#FBBF24" strokeWidth={2.5} />
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#FBBF24" }}>
              PREMIUM
            </span>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck size={12} color="#6EE7B7" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-90">
                Total Balance · USDT
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-[13px] opacity-70 font-bold">$</span>
              <span className="text-4xl font-black font-mono tracking-tight">24,819</span>
              <span className="text-xl opacity-70 font-bold font-mono">.47</span>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(16,185,129,0.2)",
                  border: "1px solid rgba(16,185,129,0.4)",
                }}
              >
                <ArrowUpRight size={11} color="#6EE7B7" />
                <span className="text-[11px] font-black font-mono" style={{ color: "#6EE7B7" }}>
                  +$482.19
                </span>
              </div>
              <span className="text-[11px] font-bold opacity-90">+1.98% today</span>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { icon: Download, label: "Deposit" },
                { icon: Send, label: "Send" },
                { icon: Repeat, label: "Swap" },
                { icon: TrendingUp, label: "Trade" },
              ].map((a) => (
                <button
                  key={a.label}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
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

        {/* Rank Progress Card — GOLD accent showcase */}
        <div
          className="rounded-2xl p-3.5 mb-4 relative overflow-hidden"
          style={{
            background: t.surfaceGlass,
            border: `1px solid ${t.border}`,
            backdropFilter: "blur(20px)",
            boxShadow: t.cardShadow,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: t.goldGrad, boxShadow: t.goldGlow }}
              >
                <Crown size={14} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest font-black" style={{ color: t.gold }}>
                  Your Rank
                </div>
                <div className="text-sm font-black" style={{ color: t.text }}>
                  3 STAR · Advancing
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest font-bold" style={{ color: t.textMute }}>
                Next
              </div>
              <div className="text-xs font-black" style={{ color: t.gold }}>
                4 STAR
              </div>
            </div>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: t.surfaceSoft }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: "48%",
                background: t.goldGrad,
                boxShadow: t.goldGlow,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px]" style={{ color: t.textMute }}>
            <span>Directs: <span className="font-black" style={{ color: t.text }}>4</span>/8</span>
            <span>Team: <span className="font-black" style={{ color: t.text }}>80</span>/160</span>
            <span className="font-black" style={{ color: t.gold }}>48%</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: "24h P&L", value: "+$248", pct: "+1.98%", color: t.good },
            { label: "Total Trades", value: "142", pct: "This week", color: t.textMute },
            { label: "Bot Fuel", value: "$246", pct: "Active", color: t.good },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-3"
              style={{
                background: t.surfaceGlass,
                border: `1px solid ${t.border}`,
                backdropFilter: "blur(20px)",
                boxShadow: t.cardShadow,
              }}
            >
              <div className="text-[9px] uppercase tracking-widest font-black mb-1" style={{ color: t.textMute }}>
                {s.label}
              </div>
              <div className="text-base font-black font-mono" style={{ color: t.text }}>
                {s.value}
              </div>
              <div className="text-[10px] font-bold font-mono mt-0.5" style={{ color: s.color }}>
                {s.pct}
              </div>
            </div>
          ))}
        </div>

        {/* Feature Tiles */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { icon: Bot, label: "Auto Bot", tint: t.emerald, glow: t.emeraldGlow },
            { icon: Flame, label: "Hot Pairs", tint: t.gold, glow: t.goldGlow },
            { icon: Award, label: "Rank", tint: t.gold, glow: t.goldGlow },
            { icon: Wallet, label: "Wallet", tint: t.emerald, glow: t.emeraldGlow },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  boxShadow: t.cardShadow,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: `${f.tint}22`,
                    border: `1px solid ${f.tint}44`,
                  }}
                >
                  <f.icon size={18} color={f.tint} strokeWidth={2} />
                </div>
              </div>
              <span className="text-[10px] font-bold text-center" style={{ color: t.textSoft }}>
                {f.label}
              </span>
            </div>
          ))}
        </div>

        {/* Promo Banner — Emerald→Gold premium gradient */}
        <div
          className="rounded-2xl p-4 mb-5 relative overflow-hidden flex items-center justify-between"
          style={{
            background: t.premiumGrad,
            boxShadow: t.goldGlow,
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-1 mb-0.5">
              <Gift size={10} className="text-white/90" />
              <div className="text-[9px] uppercase tracking-[0.3em] font-black text-white/95">
                Premium Reward
              </div>
            </div>
            <div className="text-white font-black text-base">Win $100 Fuel Bonus</div>
            <div className="text-white/90 text-[10px] mt-0.5">Complete 10 trades this week</div>
          </div>
          <button
            className="text-[11px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full text-white relative z-10"
            style={{
              background: "rgba(255,255,255,0.22)",
              border: "1px solid rgba(255,255,255,0.4)",
            }}
          >
            Claim →
          </button>
          <div
            className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, #FBBF24 0%, transparent 65%)" }}
          />
        </div>

        {/* Market List */}
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <div className="text-base font-black" style={{ color: t.text }}>
              Market
            </div>
            <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: t.textMute }}>
              Real-time · Top movers
            </div>
          </div>
          <button
            className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
            style={{ color: t.emerald }}
          >
            See all <ChevronRight size={12} />
          </button>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: t.surfaceGlass,
            border: `1px solid ${t.border}`,
            backdropFilter: "blur(20px)",
            boxShadow: t.cardShadow,
          }}
        >
          {[
            { s: "BTC", n: "Bitcoin", p: "64,382.85", chg: "+2.14%", isUp: true, spark: [3, 5, 4, 6, 7, 6, 8, 9] },
            { s: "ETH", n: "Ethereum", p: "1,794.61", chg: "+3.65%", isUp: true, spark: [4, 3, 5, 6, 5, 7, 8, 9] },
            { s: "SOL", n: "Solana", p: "158.42", chg: "-0.42%", isUp: false, spark: [7, 8, 6, 5, 4, 3, 4, 3] },
            { s: "BNB", n: "Binance", p: "612.80", chg: "+1.08%", isUp: true, spark: [5, 6, 5, 7, 6, 8, 7, 9] },
          ].map((c, i) => (
            <div
              key={c.s}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: i < 3 ? `1px solid ${t.border}` : "none" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 text-white"
                style={{ background: t.primaryGrad, boxShadow: t.emeraldGlow }}
              >
                {c.s.substring(0, 2)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-black" style={{ color: t.text }}>
                  {c.s}/USDT
                </div>
                <div className="text-[10px]" style={{ color: t.textMute }}>
                  {c.n}
                </div>
              </div>

              <svg width="46" height="20" viewBox="0 0 46 20" className="shrink-0">
                <polyline
                  fill="none"
                  stroke={c.isUp ? t.good : t.bad}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={c.spark.map((v, i) => `${i * 6.5},${20 - v * 2}`).join(" ")}
                />
              </svg>

              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-black tabular-nums" style={{ color: t.text }}>
                  ${c.p}
                </div>
                <div
                  className="text-[10px] font-mono font-bold tabular-nums flex items-center justify-end gap-0.5"
                  style={{ color: c.isUp ? t.good : t.bad }}
                >
                  {c.isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {c.chg}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Start Bot CTA — Emerald primary with gold underline */}
        <div className="mt-5 relative">
          <button
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm tracking-widest text-white uppercase relative"
            style={{
              background: t.primaryGrad,
              boxShadow: t.emeraldGlow,
            }}
          >
            <Zap size={16} strokeWidth={2.5} />
            Start Auto Trading Bot
          </button>
          <div
            className="absolute -bottom-1 left-6 right-6 h-1 rounded-full opacity-70"
            style={{ background: t.goldGrad, boxShadow: t.goldGlow, filter: "blur(3px)" }}
          />
        </div>
      </div>

      {/* Bottom Nav */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 max-w-[440px] mx-auto"
        style={{
          background: t.surfaceGlass,
          borderTop: `1px solid ${t.border}`,
          backdropFilter: "blur(24px)",
          boxShadow: mode === "light"
            ? "0 -8px 24px rgba(10,25,41,0.08)"
            : "0 -8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-around py-2.5">
          {[
            { icon: Home, label: "Home", active: true },
            { icon: BarChart3, label: "Market" },
            { icon: TrendingUp, label: "Trade" },
            { icon: Wallet, label: "Asset" },
            { icon: User, label: "Profile" },
          ].map((n) => (
            <button key={n.label} className="flex flex-col items-center gap-0.5 relative">
              {n.active && (
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: t.goldGrad, boxShadow: t.goldGlow }}
                />
              )}
              <n.icon
                size={20}
                color={n.active ? t.emerald : t.textMute}
                strokeWidth={n.active ? 2.5 : 1.7}
              />
              <span
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: n.active ? t.emerald : t.textMute }}
              >
                {n.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
