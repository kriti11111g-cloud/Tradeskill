import { useState, useMemo } from "react";
import {
  Crown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Wallet as WalletIcon,
  Bot,
  Home,
  BarChart3,
  Sparkles,
  Sun,
  Moon,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from "lucide-react";

/**
 * DEMO PREVIEW — HUBXBOT Green Theme
 * Day + Night mode toggle. Route: /demo-theme
 * Standalone. Does NOT touch main app.
 */
export default function DemoTheme() {
  const [tab, setTab] = useState("rank");
  const [mode, setMode] = useState("dark"); // "dark" | "light"

  // Green-based token palettes for both modes
  const t = useMemo(() => {
    if (mode === "light") {
      return {
        bg: "radial-gradient(1200px 800px at 10% -10%, #DCFCE7 0%, transparent 55%), radial-gradient(900px 700px at 100% 100%, #ECFDF5 0%, transparent 60%), #F6FFFA",
        surface: "#FFFFFF",
        surfaceSoft: "#F0FDF4",
        border: "#BBF7D0",
        borderSoft: "#DCFCE7",
        text: "#052E16",
        textSoft: "#065F46",
        textMute: "#6B8E7F",
        primary: "#00A854",
        primaryDeep: "#008040",
        primaryGrad: "linear-gradient(135deg,#00C853 0%,#00A854 100%)",
        primarySoftGrad: "linear-gradient(135deg,#DCFCE7 0%,#FFFFFF 100%)",
        heroGrad:
          "linear-gradient(135deg,#00A854 0%,#00C853 55%,#4ADE80 100%)",
        good: "#059669",
        bad: "#DC2626",
        chipBg: "#FFFFFF",
        navBg: "rgba(255,255,255,0.9)",
        navBorder: "#BBF7D0",
        headerBg: "rgba(255,255,255,0.75)",
        shadow: "0 12px 32px -12px rgba(0,168,84,0.35)",
        cardShadow:
          "0 20px 60px -20px rgba(0,168,84,0.25), 0 0 0 1px rgba(0,168,84,0.08)",
      };
    }
    return {
      bg: "radial-gradient(1200px 800px at 10% -10%, #052E16 0%, transparent 55%), radial-gradient(900px 700px at 100% 100%, #041F10 0%, transparent 60%), #030B08",
      surface: "#0A1710",
      surfaceSoft: "#0F2318",
      border: "rgba(0,200,83,0.22)",
      borderSoft: "rgba(0,200,83,0.10)",
      text: "#EAFFF3",
      textSoft: "#B7E4C7",
      textMute: "#6B8E7F",
      primary: "#00E676",
      primaryDeep: "#00C853",
      primaryGrad: "linear-gradient(135deg,#00E676 0%,#00C853 100%)",
      primarySoftGrad:
        "linear-gradient(135deg,rgba(0,230,118,0.18) 0%,rgba(0,200,83,0.04) 100%)",
      heroGrad:
        "linear-gradient(135deg,#00C853 0%,#00E676 55%,#4ADE80 100%)",
      good: "#4ADE80",
      bad: "#F87171",
      chipBg: "rgba(255,255,255,0.04)",
      navBg: "rgba(6,20,12,0.85)",
      navBorder: "rgba(0,200,83,0.2)",
      headerBg: "rgba(6,20,12,0.7)",
      shadow: "0 12px 32px -12px rgba(0,230,118,0.45)",
      cardShadow:
        "0 20px 60px -20px rgba(0,230,118,0.35), 0 0 0 1px rgba(0,230,118,0.12)",
    };
  }, [mode]);

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300"
      style={{ background: t.bg, fontFamily: "Outfit, sans-serif", color: t.text }}
      data-testid="demo-theme-page"
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 px-4 py-2 flex items-center justify-between border-b"
        style={{
          background: t.headerBg,
          backdropFilter: "blur(12px)",
          borderColor: t.navBorder,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: t.primaryGrad, boxShadow: t.shadow }}
          >
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: t.primary }}
            >
              {mode === "light" ? "Day Mode" : "Night Mode"} Preview
            </div>
            <div className="text-[13px] font-black" style={{ color: t.text }}>
              HUBXBOT — Green Theme
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        <button
          onClick={() => setMode(mode === "light" ? "dark" : "light")}
          data-testid="mode-toggle"
          className="relative flex items-center gap-1 rounded-full p-1 transition-all"
          style={{
            background: mode === "light" ? "#DCFCE7" : "rgba(0,200,83,0.15)",
            border: `1px solid ${t.border}`,
          }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{
              background: mode === "light" ? t.primaryGrad : "transparent",
              boxShadow: mode === "light" ? t.shadow : "none",
            }}
          >
            <Sun size={12} color={mode === "light" ? "white" : t.textMute} />
          </div>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{
              background: mode === "dark" ? t.primaryGrad : "transparent",
              boxShadow: mode === "dark" ? t.shadow : "none",
            }}
          >
            <Moon size={12} color={mode === "dark" ? "white" : t.textMute} />
          </div>
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: "rank", label: "Rank Card" },
          { id: "dash", label: "Dashboard" },
          { id: "trades", label: "Trades" },
          { id: "wallet", label: "Wallet" },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            data-testid={`demo-tab-${tabItem.id}`}
            className="shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all"
            style={
              tab === tabItem.id
                ? {
                    background: t.primaryGrad,
                    color: "white",
                    boxShadow: t.shadow,
                  }
                : {
                    background: t.chipBg,
                    color: t.textSoft,
                    border: `1px solid ${t.border}`,
                  }
            }
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-24">
        {tab === "rank" && <RankPreview t={t} />}
        {tab === "dash" && <DashPreview t={t} />}
        {tab === "trades" && <TradesPreview t={t} />}
        {tab === "wallet" && <WalletPreview t={t} />}
      </div>

      {/* Bottom Nav */}
      <div
        className="fixed bottom-0 inset-x-0 z-20 px-2 py-2 flex items-center justify-around border-t"
        style={{
          background: t.navBg,
          backdropFilter: "blur(12px)",
          borderColor: t.navBorder,
          boxShadow: `0 -4px 20px ${
            mode === "light" ? "rgba(0,168,84,0.08)" : "rgba(0,230,118,0.12)"
          }`,
        }}
      >
        {[
          { icon: Home, label: "Home" },
          { icon: BarChart3, label: "Market" },
          { icon: TrendingUp, label: "Trade" },
          { icon: WalletIcon, label: "Asset" },
          { icon: Bot, label: "Bot", active: true },
        ].map((n) => (
          <div key={n.label} className="flex flex-col items-center gap-0.5">
            <n.icon size={20} color={n.active ? t.primary : t.textMute} />
            <span
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: n.active ? t.primary : t.textMute }}
            >
              {n.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========= RANK ========= */
function RankPreview({ t }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-black tracking-tight" style={{ color: t.text }}>
            Rank
          </h1>
          <span
            className="text-[10px] tracking-[0.28em] uppercase font-bold"
            style={{ color: t.primary }}
          >
            ★ Your Current
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: t.textMute }}>
          3 / 10
        </span>
      </div>

      {/* Rank card */}
      <div
        className="rounded-3xl overflow-hidden relative"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          boxShadow: t.cardShadow,
        }}
      >
        <div
          className="relative py-8 px-6 text-center"
          style={{ background: t.primarySoftGrad }}
        >
          <Crown size={22} className="absolute top-4 left-4" color={t.primary} />
          <div
            className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white"
            style={{ background: t.primaryGrad, boxShadow: t.shadow }}
          >
            ★ YOU
          </div>

          <svg viewBox="0 0 100 100" className="w-40 h-40 mx-auto">
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={t.primary} />
                <stop offset="100%" stopColor={t.primaryDeep} />
              </linearGradient>
            </defs>
            <polygon
              points="50,8 62,38 94,38 68,58 78,90 50,72 22,90 32,58 6,38 38,38"
              fill="url(#sg)"
              style={{
                filter: `drop-shadow(0 6px 12px ${t.primary}66)`,
              }}
            />
            <text
              x="50"
              y="62"
              textAnchor="middle"
              fontSize="34"
              fill="white"
              fontWeight="900"
            >
              3
            </text>
          </svg>

          <div
            className="mt-2 text-2xl font-black tracking-widest"
            style={{ color: t.primaryDeep }}
          >
            3 STAR
          </div>
          <div
            className="text-[11px] tracking-[0.4em] font-bold"
            style={{ color: t.primary }}
          >
            ADVANCING
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-3 pt-3">
          <StatBox t={t} label="Direct Income" value="$15" />
          <StatBox t={t} label="Trading Comm." value="6.50%" />
          <StatBox t={t} label="Support Inc." value="10%" />
        </div>

        <div className="grid grid-cols-3 gap-2 px-3 pt-2">
          <MiniBox t={t} label="Direct" value="4 Users" />
          <MiniBox t={t} label="Team" value="80 Members" />
          <MiniBox t={t} label="Downline" value="2 · Rising" />
        </div>

        <div
          className="px-4 py-3 mt-2 border-t"
          style={{ borderColor: t.borderSoft }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div
              className="text-[10px] tracking-[0.28em] uppercase font-black"
              style={{ color: t.primary }}
            >
              Processing
            </div>
            <div
              className="text-[13px] font-mono font-black"
              style={{ color: t.text }}
            >
              48%
            </div>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: t.borderSoft }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: "48%",
                background: t.primaryGrad,
                boxShadow: `0 0 12px ${t.primary}80`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Prev/Next */}
      <div className="flex items-center justify-between pt-1">
        <button
          className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold"
          style={{
            background: t.chipBg,
            border: `1px solid ${t.border}`,
            color: t.textSoft,
          }}
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <div className="flex items-center gap-1.5">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === 2 ? 22 : 6,
                height: 6,
                background: i === 2 ? t.primary : t.borderSoft,
              }}
            />
          ))}
        </div>
        <button
          className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-black text-white"
          style={{ background: t.primaryGrad, boxShadow: t.shadow }}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ========= DASHBOARD ========= */
function DashPreview({ t }) {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-black" style={{ color: t.text }}>
        Dashboard
      </h1>

      {/* Balance hero */}
      <div
        className="rounded-3xl p-5 text-white relative overflow-hidden"
        style={{ background: t.heroGrad, boxShadow: t.shadow }}
      >
        <div className="text-[10px] uppercase tracking-widest opacity-90 font-bold">
          Total Balance
        </div>
        <div className="text-3xl font-black mt-1 font-mono">$12,486.53</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/25 font-bold">
            +$248.19 (24h)
          </span>
          <span className="text-[11px] font-bold opacity-90 flex items-center gap-0.5">
            <ArrowUpRight size={12} /> 2.04%
          </span>
        </div>
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full"
          style={{ background: "radial-gradient(circle,#FFFFFF33,transparent)" }}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {["Deposit", "Trade", "Bot", "P2P"].map((a) => (
          <div
            key={a}
            className="rounded-2xl p-3 text-center"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
            }}
          >
            <div
              className="w-9 h-9 mx-auto rounded-xl flex items-center justify-center"
              style={{ background: t.primarySoftGrad }}
            >
              <Sparkles size={16} color={t.primary} />
            </div>
            <div
              className="text-[10px] mt-1.5 font-bold"
              style={{ color: t.textSoft }}
            >
              {a}
            </div>
          </div>
        ))}
      </div>

      {/* Active bots */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between border-b"
          style={{ borderColor: t.borderSoft }}
        >
          <span
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: t.text }}
          >
            Active Bots
          </span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: t.primary }}
          >
            3 LIVE
          </span>
        </div>
        {[
          { s: "BTCUSDT", p: "+$42.18", pct: "+3.4%" },
          { s: "ETHUSDT", p: "+$18.60", pct: "+2.1%" },
          { s: "SOLUSDT", p: "+$9.44", pct: "+1.8%" },
        ].map((b, i) => (
          <div
            key={b.s}
            className="px-4 py-2.5 flex items-center justify-between"
            style={{
              borderBottom: i < 2 ? `1px solid ${t.borderSoft}` : "none",
            }}
          >
            <div>
              <div className="text-sm font-black" style={{ color: t.text }}>
                {b.s}
              </div>
              <div className="text-[10px]" style={{ color: t.textMute }}>
                Running · Cycle 4
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-sm font-mono font-black"
                style={{ color: t.good }}
              >
                {b.p}
              </div>
              <div
                className="text-[10px] font-mono font-bold"
                style={{ color: t.good }}
              >
                {b.pct}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========= TRADES ========= */
function TradesPreview({ t }) {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-black" style={{ color: t.text }}>
        Trades
      </h1>

      <div className="flex gap-2">
        {["ALL", "LIVE", "OFF"].map((f, i) => (
          <button
            key={f}
            className="px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider"
            style={
              i === 1
                ? { background: t.primaryGrad, color: "white", boxShadow: t.shadow }
                : {
                    background: t.chipBg,
                    color: t.textSoft,
                    border: `1px solid ${t.border}`,
                  }
            }
          >
            {f}
          </button>
        ))}
      </div>

      {[
        { sym: "BTCUSDT", price: "63,342.85", chg: "+1.53%", pnl: "+$142.18" },
        { sym: "ETHUSDT", price: "1,794.61", chg: "+2.65%", pnl: "+$68.24" },
        { sym: "BNBUSDT", price: "612.40", chg: "-0.42%", pnl: "-$8.10" },
      ].map((tr) => {
        const isUp = tr.chg.startsWith("+");
        return (
          <div
            key={tr.sym}
            className="rounded-2xl p-4"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black" style={{ color: t.text }}>
                  {tr.sym}
                </div>
                <div
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: t.textMute }}
                >
                  Spot · DCA + Trailing TP
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-base font-mono font-black"
                  style={{ color: t.text }}
                >
                  ${tr.price}
                </div>
                <div
                  className="text-[11px] font-mono font-bold flex items-center gap-0.5 justify-end"
                  style={{ color: isUp ? t.good : t.bad }}
                >
                  {isUp ? (
                    <ArrowUpRight size={11} />
                  ) : (
                    <ArrowDownRight size={11} />
                  )}
                  {tr.chg}
                </div>
              </div>
            </div>
            <div
              className="mt-3 pt-3 flex items-center justify-between border-t border-dashed"
              style={{ borderColor: t.border }}
            >
              <span
                className="text-[10px] uppercase tracking-widest font-bold"
                style={{ color: t.textMute }}
              >
                Session PnL
              </span>
              <span
                className="text-sm font-mono font-black"
                style={{ color: isUp ? t.good : t.bad }}
              >
                {tr.pnl}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ========= WALLET ========= */
function WalletPreview({ t }) {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-black" style={{ color: t.text }}>
        Wallet
      </h1>

      <div
        className="rounded-3xl p-5 relative overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
      >
        <div
          className="text-[10px] uppercase tracking-widest font-bold"
          style={{ color: t.textMute }}
        >
          Main Wallet
        </div>
        <div
          className="text-3xl font-black mt-1 font-mono"
          style={{ color: t.text }}
        >
          $8,240.19
        </div>
        <div className="flex gap-2 mt-3">
          <button
            className="flex-1 py-2 rounded-xl text-xs font-black text-white"
            style={{ background: t.primaryGrad, boxShadow: t.shadow }}
          >
            DEPOSIT
          </button>
          <button
            className="flex-1 py-2 rounded-xl text-xs font-black"
            style={{
              background: t.chipBg,
              color: t.textSoft,
              border: `1px solid ${t.border}`,
            }}
          >
            WITHDRAW
          </button>
        </div>
      </div>

      <div
        className="rounded-3xl p-5 text-white relative overflow-hidden"
        style={{ background: t.heroGrad, boxShadow: t.shadow }}
      >
        <div className="text-[10px] uppercase tracking-widest opacity-90 font-bold">
          Bot Fuel Wallet
        </div>
        <div className="text-3xl font-black mt-1 font-mono">$246.32</div>
        <div className="mt-1 text-[11px] opacity-90 font-bold">
          Auto 25% fuel from profits
        </div>
        <div
          className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full"
          style={{ background: "radial-gradient(circle,#FFFFFF33,transparent)" }}
        />
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
      >
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: t.borderSoft }}
        >
          <div
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: t.text }}
          >
            Recent Activity
          </div>
        </div>
        {[
          { k: "Deposit", a: "+$500.00", clr: t.good },
          { k: "Trading Fee", a: "-$12.40", clr: t.bad },
          { k: "P2P Send", a: "-$100.00", clr: t.bad },
        ].map((r, i) => (
          <div
            key={r.k + i}
            className="px-4 py-2.5 flex items-center justify-between"
            style={{
              borderBottom: i < 2 ? `1px solid ${t.borderSoft}` : "none",
            }}
          >
            <span className="text-xs font-bold" style={{ color: t.textSoft }}>
              {r.k}
            </span>
            <span
              className="text-sm font-mono font-black"
              style={{ color: r.clr }}
            >
              {r.a}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ t, label, value }) {
  return (
    <div
      className="rounded-xl px-2 py-2.5 text-center"
      style={{
        background: t.primarySoftGrad,
        border: `1px solid ${t.borderSoft}`,
      }}
    >
      <div
        className="text-[8px] uppercase tracking-widest font-black"
        style={{ color: t.primary }}
      >
        {label}
      </div>
      <div
        className="text-base font-black mt-1"
        style={{ color: t.primaryDeep }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniBox({ t, label, value }) {
  return (
    <div
      className="rounded-xl px-2 py-1.5 text-center"
      style={{
        background: t.chipBg,
        border: `1px solid ${t.borderSoft}`,
      }}
    >
      <div
        className="text-[8px] uppercase tracking-widest font-bold"
        style={{ color: t.textMute }}
      >
        {label}
      </div>
      <div className="text-[11px] font-black" style={{ color: t.text }}>
        {value}
      </div>
    </div>
  );
}
