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
  Sparkles,
  Bell,
  Search,
  Home,
  BarChart3,
  Bot,
  User,
  ShieldCheck,
  Flame,
} from "lucide-react";

/**
 * DEMO — FINTECH PREMIUM (Home Page Only)
 * Palette:
 *   Emerald  #16A34A   |  Deep Teal  #0F766E
 *   Midnight #083344   |  Aqua Cyan  #2DD4BF
 *   White    #FFFFFF
 * Glassmorphism cards · Aqua glow · Binance/Coinbase-level clean.
 */
export default function DemoFintech() {
  const [mode, setMode] = useState("light");

  const t = useMemo(() => {
    if (mode === "light") {
      return {
        // Backgrounds
        bg: "radial-gradient(1200px 800px at 90% -10%, rgba(45,212,191,0.10) 0%, transparent 55%), radial-gradient(900px 700px at -10% 100%, rgba(22,163,74,0.08) 0%, transparent 60%), #FFFFFF",
        surface: "#FFFFFF",
        surfaceGlass: "rgba(255,255,255,0.72)",
        surfaceSoft: "#F0FDFA",
        // Borders
        border: "rgba(15,118,110,0.14)",
        borderStrong: "rgba(15,118,110,0.22)",
        // Text
        text: "#083344",
        textSoft: "#0F766E",
        textMute: "#64809C",
        // Brand
        emerald: "#16A34A",
        deepTeal: "#0F766E",
        aqua: "#2DD4BF",
        // Gradients
        heroGrad:
          "linear-gradient(135deg,#083344 0%,#0F766E 55%,#16A34A 100%)",
        primaryGrad:
          "linear-gradient(135deg,#16A34A 0%,#0F766E 100%)",
        aquaGrad:
          "linear-gradient(135deg,#2DD4BF 0%,#0F766E 100%)",
        // Glow
        aquaGlow: "0 0 24px rgba(45,212,191,0.35)",
        emeraldGlow: "0 0 24px rgba(22,163,74,0.35)",
        // Shadow
        cardShadow:
          "0 8px 24px -8px rgba(15,118,110,0.15), 0 0 0 1px rgba(15,118,110,0.06)",
        heroShadow:
          "0 24px 48px -16px rgba(8,51,68,0.45), 0 0 0 1px rgba(45,212,191,0.2)",
        // Semantic
        good: "#16A34A",
        bad: "#DC2626",
      };
    }
    return {
      bg: "radial-gradient(1200px 800px at 90% -10%, rgba(45,212,191,0.18) 0%, transparent 55%), radial-gradient(900px 700px at -10% 100%, rgba(22,163,74,0.12) 0%, transparent 60%), #051F28",
      surface: "#0A2F3B",
      surfaceGlass: "rgba(10,47,59,0.6)",
      surfaceSoft: "#083344",
      border: "rgba(45,212,191,0.16)",
      borderStrong: "rgba(45,212,191,0.28)",
      text: "#F0FDFA",
      textSoft: "#5EEAD4",
      textMute: "#7C9CAE",
      emerald: "#22C55E",
      deepTeal: "#14B8A6",
      aqua: "#2DD4BF",
      heroGrad:
        "linear-gradient(135deg,#0F766E 0%,#0A5D57 50%,#083344 100%)",
      primaryGrad:
        "linear-gradient(135deg,#22C55E 0%,#0F766E 100%)",
      aquaGrad:
        "linear-gradient(135deg,#2DD4BF 0%,#0F766E 100%)",
      aquaGlow: "0 0 32px rgba(45,212,191,0.5)",
      emeraldGlow: "0 0 24px rgba(34,197,94,0.45)",
      cardShadow:
        "0 8px 24px -8px rgba(0,0,0,0.4), 0 0 0 1px rgba(45,212,191,0.1)",
      heroShadow:
        "0 24px 48px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(45,212,191,0.25)",
      good: "#22C55E",
      bad: "#F87171",
    };
  }, [mode]);

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300"
      style={{
        background: t.bg,
        color: t.text,
        fontFamily: "Outfit, sans-serif",
      }}
      data-testid="demo-fintech"
    >
      <div className="max-w-[440px] mx-auto px-4 pt-4 pb-28">
        {/* ============ HEADER ============ */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center relative"
              style={{
                background: t.primaryGrad,
                boxShadow: t.emeraldGlow,
              }}
            >
              <Zap size={18} className="text-white" strokeWidth={2.5} />
              <div
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2"
                style={{
                  background: t.aqua,
                  borderColor: t.surface,
                  boxShadow: t.aquaGlow,
                }}
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: t.textMute }}>
                Welcome back
              </div>
              <div className="text-[15px] font-black" style={{ color: t.text }}>
                Rajesh Kumar
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode(mode === "light" ? "dark" : "light")}
              data-testid="fintech-mode-toggle"
              className="w-10 h-10 rounded-full flex items-center justify-center transition"
              style={{
                background: t.surfaceGlass,
                border: `1px solid ${t.border}`,
                backdropFilter: "blur(12px)",
              }}
            >
              {mode === "light" ? (
                <Moon size={16} color={t.deepTeal} />
              ) : (
                <Sun size={16} color={t.aqua} />
              )}
            </button>
            <button
              className="w-10 h-10 rounded-full flex items-center justify-center relative"
              style={{
                background: t.surfaceGlass,
                border: `1px solid ${t.border}`,
                backdropFilter: "blur(12px)",
              }}
            >
              <Bell size={16} color={t.textSoft} />
              <span
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ background: t.aqua, boxShadow: t.aquaGlow }}
              />
            </button>
          </div>
        </div>

        {/* ============ SEARCH BAR ============ */}
        <div
          className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 mb-5"
          style={{
            background: t.surfaceGlass,
            border: `1px solid ${t.border}`,
            backdropFilter: "blur(20px)",
          }}
        >
          <Search size={16} color={t.textMute} />
          <span className="text-sm" style={{ color: t.textMute }}>
            Search coins, pairs, wallets
          </span>
        </div>

        {/* ============ BALANCE HERO ============ */}
        <div
          className="rounded-3xl p-5 text-white relative overflow-hidden mb-4"
          style={{ background: t.heroGrad, boxShadow: t.heroShadow }}
        >
          {/* Decorative aqua orbs */}
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30"
            style={{
              background:
                "radial-gradient(circle, #2DD4BF 0%, transparent 65%)",
            }}
          />
          <div
            className="absolute -bottom-20 -left-8 w-40 h-40 rounded-full opacity-20"
            style={{
              background:
                "radial-gradient(circle, #22C55E 0%, transparent 65%)",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={12} color="#5EEAD4" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-90">
                  Total Balance · USDT
                </span>
              </div>
              <div
                className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                style={{
                  background: "rgba(45,212,191,0.2)",
                  color: "#5EEAD4",
                  border: "1px solid rgba(45,212,191,0.3)",
                }}
              >
                LIVE
              </div>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-[13px] opacity-70 font-bold">$</span>
              <span className="text-4xl font-black font-mono tracking-tight">
                24,819
              </span>
              <span className="text-xl opacity-70 font-bold font-mono">
                .47
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(45,212,191,0.2)",
                  border: "1px solid rgba(45,212,191,0.3)",
                }}
              >
                <ArrowUpRight size={11} color="#5EEAD4" />
                <span className="text-[11px] font-black font-mono" style={{ color: "#5EEAD4" }}>
                  +$482.19
                </span>
              </div>
              <span className="text-[11px] font-bold opacity-90">+1.98% today</span>
            </div>

            {/* Quick send/receive buttons */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { icon: Download, label: "Deposit" },
                { icon: Send, label: "Send" },
                { icon: Repeat, label: "Swap" },
                { icon: TrendingUp, label: "Trade" },
              ].map((a) => (
                <button
                  key={a.label}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl transition"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <a.icon size={16} className="text-white" />
                  <span className="text-[10px] font-bold text-white/90">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ============ QUICK STATS ============ */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: "24h P&L", value: "+$248", pct: "+1.98%", isUp: true },
            { label: "Total Trades", value: "142", pct: "This week", isUp: null },
            { label: "Bot Fuel", value: "$246", pct: "Active", isUp: true },
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
              <div
                className="text-[9px] uppercase tracking-widest font-black mb-1"
                style={{ color: t.textMute }}
              >
                {s.label}
              </div>
              <div className="text-base font-black font-mono" style={{ color: t.text }}>
                {s.value}
              </div>
              <div
                className="text-[10px] font-bold font-mono mt-0.5"
                style={{
                  color: s.isUp === null ? t.textMute : s.isUp ? t.good : t.bad,
                }}
              >
                {s.pct}
              </div>
            </div>
          ))}
        </div>

        {/* ============ FEATURE TILES ============ */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { icon: Bot, label: "Auto Bot", tint: t.emerald, glow: t.emeraldGlow },
            { icon: Flame, label: "Hot Pairs", tint: t.aqua, glow: t.aquaGlow },
            { icon: Sparkles, label: "Rewards", tint: t.deepTeal, glow: "0 0 20px rgba(15,118,110,0.5)" },
            { icon: Wallet, label: "Wallet", tint: t.emerald, glow: t.emeraldGlow },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  boxShadow: t.cardShadow,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: `${f.tint}20`,
                    border: `1px solid ${f.tint}40`,
                  }}
                >
                  <f.icon size={18} color={f.tint} strokeWidth={2} />
                </div>
              </div>
              <span
                className="text-[10px] font-bold text-center"
                style={{ color: t.textSoft }}
              >
                {f.label}
              </span>
            </div>
          ))}
        </div>

        {/* ============ MARKET LIST ============ */}
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <div className="text-base font-black" style={{ color: t.text }}>
              Market
            </div>
            <div
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{ color: t.textMute }}
            >
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
              style={{
                borderBottom: i < 3 ? `1px solid ${t.border}` : "none",
              }}
            >
              {/* Coin icon */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[11px] shrink-0"
                style={{
                  background: t.primaryGrad,
                  color: "white",
                  boxShadow: t.emeraldGlow,
                }}
              >
                {c.s.substring(0, 2)}
              </div>

              {/* Symbol + name */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black" style={{ color: t.text }}>
                  {c.s}/USDT
                </div>
                <div className="text-[10px]" style={{ color: t.textMute }}>
                  {c.n}
                </div>
              </div>

              {/* Sparkline */}
              <svg width="46" height="20" viewBox="0 0 46 20" className="shrink-0">
                <polyline
                  fill="none"
                  stroke={c.isUp ? t.good : t.bad}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={c.spark
                    .map((v, i) => `${i * 6.5},${20 - v * 2}`)
                    .join(" ")}
                />
              </svg>

              {/* Price + change */}
              <div className="text-right shrink-0">
                <div
                  className="text-sm font-mono font-black tabular-nums"
                  style={{ color: t.text }}
                >
                  ${c.p}
                </div>
                <div
                  className="text-[10px] font-mono font-bold tabular-nums flex items-center justify-end gap-0.5"
                  style={{ color: c.isUp ? t.good : t.bad }}
                >
                  {c.isUp ? (
                    <ArrowUpRight size={10} />
                  ) : (
                    <ArrowDownRight size={10} />
                  )}
                  {c.chg}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ============ START BOT CTA ============ */}
        <button
          className="w-full mt-5 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm tracking-widest text-white uppercase"
          style={{
            background: t.primaryGrad,
            boxShadow: t.emeraldGlow,
          }}
        >
          <Zap size={16} strokeWidth={2.5} />
          Start Auto Trading Bot
        </button>
      </div>

      {/* ============ BOTTOM NAV ============ */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 max-w-[440px] mx-auto"
        style={{
          background: t.surfaceGlass,
          borderTop: `1px solid ${t.border}`,
          backdropFilter: "blur(24px)",
          boxShadow: mode === "light"
            ? "0 -8px 24px rgba(15,118,110,0.08)"
            : "0 -8px 24px rgba(0,0,0,0.4)",
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
            <button
              key={n.label}
              className="flex flex-col items-center gap-0.5 relative"
            >
              {n.active && (
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{
                    background: t.aqua,
                    boxShadow: t.aquaGlow,
                  }}
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
