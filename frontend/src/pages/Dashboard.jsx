import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  TrendingUp,
  Wallet as WalletIcon,
  Send,
  Download,
  Repeat,
  ChevronRight,
  Bell,
  Search,
  Bot,
  Flame,
  Award,
  Crown,
  Gift,
  ShieldCheck,
  Key,
  ArrowRightLeft,
  BarChart3,
  Users,
  Trophy,
  BookOpen,
  Newspaper,
} from "lucide-react";
import api from "@/lib/api";
import { fmtUSD, fmtPct, fmtNum } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import CoinIcon from "@/components/CoinIcon";

export default function Dashboard() {
  const { user } = useAuth();
  const { mode, toggle } = useTheme();
  const [pairs, setPairs] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [rank, setRank] = useState(null);

  useEffect(() => {
    api.get("/market/top?limit=8").then(({ data }) => setPairs(data.coins || [])).catch(() => {});
    api.get("/wallet/summary").then(({ data }) => setWallet(data)).catch(() => {});
    api.get("/ranks/me").then(({ data }) => setRank(data)).catch(() => {});
  }, []);

  const totalBalance = wallet?.total_usdt ?? user?.wallet_usdt ?? 0;
  const change24h = pairs.reduce((s, p) => s + (p.change_pct || 0), 0) / Math.max(pairs.length, 1);
  const isUp = change24h >= 0;

  const currentRank = rank?.rank || { level: 1, title: "Starter" };
  const nextRank = rank?.next_rank;
  const progressPct = useMemo(() => {
    if (!rank?.progress) return 0;
    const p = rank.progress;
    const parts = [];
    if (p.direct_needed > 0) parts.push(Math.min(1, p.direct_have / p.direct_needed));
    if (p.team_needed > 0) parts.push(Math.min(1, p.team_have / p.team_needed));
    if (p.downline_requirement)
      parts.push(Math.min(1, p.downline_have / p.downline_requirement.count));
    if (!parts.length) return 100;
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  }, [rank]);


  return (
    <div className="pb-4">
      <div className="px-4 pt-4">
        {/* ============ HEADER ============ */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center relative"
              style={{ background: "var(--primary-grad)", boxShadow: "var(--shadow-sm)" }}
            >
              <Zap size={18} className="text-white" strokeWidth={2.5} />
              <div
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                style={{
                  background: "var(--gold)",
                  borderColor: "var(--surface)",
                  boxShadow: "0 0 8px var(--gold-glow)",
                }}
              >
                <Crown size={7} className="text-white" strokeWidth={3} />
              </div>
            </div>
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.25em] font-bold"
                style={{ color: "var(--text-mute)" }}
              >
                Welcome back
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[15px] font-black"
                  style={{ color: "var(--text)" }}
                  data-testid="user-greeting"
                >
                  {user?.name || "Trader"}
                </span>
                {user?.activated && (
                  <span
                    className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest text-white"
                    style={{
                      background: "var(--gold-grad)",
                      boxShadow: "0 0 8px var(--gold-glow)",
                    }}
                  >
                    PRO
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              data-testid="dash-mode-toggle"
              aria-label="Toggle theme"
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                backdropFilter: "blur(12px)",
              }}
            >
              {mode === "light" ? (
                <Bell size={16} color="var(--primary)" />
              ) : (
                <Bell size={16} color="var(--gold)" />
              )}
            </button>
            <Link
              to="/news"
              className="w-10 h-10 rounded-full flex items-center justify-center relative"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                backdropFilter: "blur(12px)",
              }}
              data-testid="dash-notif-btn"
            >
              <Bell size={16} color="var(--text-soft)" />
              <span
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ background: "var(--gold)", boxShadow: "0 0 8px var(--gold-glow)" }}
              />
            </Link>
          </div>
        </div>

        {/* ============ BALANCE HERO ============ */}
        <div
          className="rounded-xl p-5 text-white relative overflow-hidden mb-4"
          style={{
            background: "var(--premium-grad)",
            boxShadow: "var(--shadow-lg)",
          }}
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
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.4)",
            }}
          >
            <Award size={10} color="#FFFFFF" strokeWidth={2.5} />
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: "#FFFFFF" }}
            >
              PREMIUM
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
              <span className="text-[13px] opacity-70 font-bold">$</span>
              <span className="text-4xl font-black font-mono tracking-tight">
                {fmtNum(Math.floor(totalBalance), 0)}
              </span>
              <span className="text-xl opacity-70 font-bold font-mono">
                .{((totalBalance % 1) * 100).toFixed(0).padStart(2, "0")}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.35)",
                }}
              >
                {isUp ? (
                  <ArrowUpRight size={11} color="#FFFFFF" />
                ) : (
                  <ArrowDownRight size={11} color="#FECACA" />
                )}
                <span
                  className="text-[11px] font-black font-mono"
                  style={{ color: isUp ? "#FFFFFF" : "#FECACA" }}
                >
                  {fmtPct(change24h)}
                </span>
              </div>
              <span className="text-[11px] font-bold opacity-90">Market avg · 24h</span>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { icon: Download, label: "Deposit", to: "/wallet", testid: "hero-deposit" },
                { icon: Send, label: "Send", to: "/wallet", testid: "hero-send" },
                { icon: Repeat, label: "Swap", to: "/market", testid: "hero-swap" },
                { icon: TrendingUp, label: "Trade", to: "/trades", testid: "hero-trade" },
              ].map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
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
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ============ SEARCH BAR ============ */}
        <Link
          to="/market"
          data-testid="dash-search"
          className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 mb-5"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(20px)",
          }}
        >
          <Search size={16} color="var(--text-mute)" />
          <span className="text-sm" style={{ color: "var(--text-mute)" }}>
            Search coins, pairs, wallets
          </span>
        </Link>

        {/* ============ RANK PROGRESS CARD (Gold accent) ============ */}
        <Link
          to="/rank"
          data-testid="rank-card"
          className="block rounded-2xl p-3.5 mb-4"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(20px)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "var(--gold-grad)",
                  boxShadow: "0 0 10px var(--gold-glow)",
                }}
              >
                <Crown size={14} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div
                  className="text-[9px] uppercase tracking-widest font-black"
                  style={{ color: "var(--gold)" }}
                >
                  Your Rank
                </div>
                <div className="text-sm font-black" style={{ color: "var(--text)" }}>
                  {currentRank.level} STAR · {currentRank.title}
                </div>
              </div>
            </div>
            {nextRank && (
              <div className="text-right">
                <div
                  className="text-[9px] uppercase tracking-widest font-bold"
                  style={{ color: "var(--text-mute)" }}
                >
                  Next
                </div>
                <div className="text-xs font-black" style={{ color: "var(--gold)" }}>
                  {nextRank.level} STAR
                </div>
              </div>
            )}
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--surface-3)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: "var(--gold-grad)",
                boxShadow: "0 0 8px var(--gold-glow)",
              }}
            />
          </div>
          <div
            className="flex items-center justify-between mt-1.5 text-[10px]"
            style={{ color: "var(--text-mute)" }}
          >
            <span>
              Directs:{" "}
              <span className="font-black" style={{ color: "var(--text)" }}>
                {rank?.stats?.direct_count || 0}
              </span>
              {rank?.progress?.direct_needed ? `/${rank.progress.direct_needed}` : ""}
            </span>
            <span>
              Team:{" "}
              <span className="font-black" style={{ color: "var(--text)" }}>
                {rank?.stats?.total_team || 0}
              </span>
              {rank?.progress?.team_needed ? `/${rank.progress.team_needed}` : ""}
            </span>
            <span className="font-black" style={{ color: "var(--gold)" }}>
              {progressPct}%
            </span>
          </div>
        </Link>

        {/* ============ FEATURE TILES ============ */}
        <div className="grid grid-cols-4 gap-3 mb-5" data-testid="dash-feature-tiles">
          {[
            { icon: Bot, label: "Auto Bot", to: "/bot", tint: "var(--primary)", testid: "tile-bot" },
            { icon: Flame, label: "Hot Pairs", to: "/market", tint: "var(--gold)", testid: "tile-hot" },
            { icon: Award, label: "Rank", to: "/rank", tint: "var(--gold)", testid: "tile-rank" },
            { icon: WalletIcon, label: "Wallet", to: "/wallet", tint: "var(--primary)", testid: "tile-wallet" },
          ].map((f) => (
            <Link
              key={f.label}
              to={f.to}
              data-testid={f.testid}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: `color-mix(in srgb, ${f.tint} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${f.tint} 30%, transparent)`,
                  }}
                >
                  <f.icon size={18} color={f.tint} strokeWidth={2} />
                </div>
              </div>
              <span
                className="text-[10px] font-bold text-center"
                style={{ color: "var(--text-soft)" }}
              >
                {f.label}
              </span>
            </Link>
          ))}
        </div>

        {/* ============ QUICK ACCESS GRID (6 cards) ============ */}
        <div className="grid grid-cols-4 gap-2.5 mb-5" data-testid="dash-quick-grid">
          {[
            { icon: Key, label: "Bind API", to: "/bind-api", tint: "var(--primary)", testid: "quick-bind-api" },
            { icon: ArrowRightLeft, label: "Transactions", to: "/transactions", tint: "var(--gold)", testid: "quick-transactions" },
            { icon: BarChart3, label: "Revenue", to: "/revenue", tint: "var(--primary)", testid: "quick-revenue" },
            { icon: Users, label: "Referral", to: "/referral", tint: "var(--gold)", testid: "quick-referral" },
            { icon: Gift, label: "Rewards Joining", to: "/rewards", tint: "var(--primary)", testid: "quick-rewards-joining" },
            { icon: Trophy, label: "Rewards Trading", to: "/rewards", tint: "var(--gold)", testid: "quick-rewards-trading" },
            { icon: BookOpen, label: "User Guide", to: "/guide", tint: "var(--primary)", testid: "quick-guide" },
            { icon: Newspaper, label: "News", to: "/news", tint: "var(--gold)", testid: "quick-news" },
          ].map((c) => (
            <Link
              key={c.label}
              to={c.to}
              data-testid={c.testid}
              className="app-card rounded-2xl flex flex-col items-center justify-center gap-1.5 py-3 px-1 hover:border-[color:var(--primary)]/40 transition"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: `color-mix(in srgb, ${c.tint} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${c.tint} 28%, transparent)`,
                }}
              >
                <c.icon size={16} color={c.tint} strokeWidth={1.9} />
              </div>
              <span
                className="text-[9px] font-bold text-center leading-tight"
                style={{ color: "var(--text-soft)" }}
              >
                {c.label}
              </span>
            </Link>
          ))}
        </div>

        {/* ============ PREMIUM PROMO BANNER ============ */}
        <Link
          to="/rewards"
          data-testid="promo-banner"
          className="block rounded-2xl p-4 mb-5 relative overflow-hidden"
          style={{
            background: "var(--premium-grad)",
            boxShadow: "0 0 20px var(--gold-glow)",
          }}
        >
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <Gift size={10} className="text-white/90" />
                <div className="text-[9px] uppercase tracking-[0.3em] font-black text-white/95">
                  Premium Reward
                </div>
              </div>
              <div className="text-white font-black text-base">Win $100 Fuel Bonus</div>
              <div className="text-white/90 text-[10px] mt-0.5">
                Complete 10 trades this week
              </div>
            </div>
            <div
              className="text-[11px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full text-white shrink-0"
              style={{
                background: "rgba(255,255,255,0.22)",
                border: "1px solid rgba(255,255,255,0.4)",
              }}
            >
              Claim →
            </div>
          </div>
          <div
            className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-30"
            style={{
              background: "radial-gradient(circle, #F59E0B 0%, transparent 65%)",
            }}
          />
        </Link>

        {/* ============ MARKET LIST ============ */}
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <div className="text-base font-black" style={{ color: "var(--text)" }}>
              Market
            </div>
            <div
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{ color: "var(--text-mute)" }}
            >
              Real-time · Top movers
            </div>
          </div>
          <Link
            to="/market"
            data-testid="see-all-market"
            className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
            style={{ color: "var(--primary)" }}
          >
            See all <ChevronRight size={12} />
          </Link>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(20px)",
            boxShadow: "var(--shadow-sm)",
          }}
          data-testid="market-list"
        >
          {pairs.slice(0, 4).map((p, i) => {
            const spark = Array.from({ length: 8 }, (_, k) => 4 + Math.sin(k + i) * 3 + (p.change_pct || 0) * 0.5);
            const up = (p.change_pct || 0) >= 0;
            return (
              <Link
                key={p.symbol}
                to={`/pair/${p.symbol}`}
                data-testid={`mover-${p.symbol}`}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderBottom: i < 3 ? "1px solid var(--border)" : "none",
                }}
              >
                <div className="shrink-0">
                  <CoinIcon symbol={p.symbol} size={40} />
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-black"
                    style={{ color: "var(--text)" }}
                  >
                    {p.symbol.replace("USDT", "")}/USDT
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-mute)" }}>
                    {p.asset || p.symbol.replace("USDT", "")}
                  </div>
                </div>

                <svg width="46" height="20" viewBox="0 0 46 20" className="shrink-0">
                  <polyline
                    fill="none"
                    stroke={up ? "var(--good)" : "var(--bad)"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={spark.map((v, k) => `${k * 6.5},${20 - Math.max(1, Math.min(9, v)) * 2}`).join(" ")}
                  />
                </svg>

                <div className="text-right shrink-0">
                  <div
                    className="text-sm font-mono font-black tabular-nums"
                    style={{ color: "var(--text)" }}
                  >
                    {fmtUSD(p.last_price, p.last_price > 100 ? 0 : 2)}
                  </div>
                  <div
                    className="text-[10px] font-mono font-bold tabular-nums flex items-center justify-end gap-0.5"
                    style={{ color: up ? "var(--good)" : "var(--bad)" }}
                  >
                    {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {fmtPct(p.change_pct)}
                  </div>
                </div>
              </Link>
            );
          })}
          {!pairs.length && (
            <div
              className="px-4 py-6 text-center text-xs"
              style={{ color: "var(--text-mute)" }}
            >
              Loading market data...
            </div>
          )}
        </div>

        {/* ============ START BOT CTA ============ */}
        <div className="mt-5 relative">
          <Link
            to="/pair/BTCUSDT"
            data-testid="start-bot-btn"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm tracking-widest text-white uppercase"
            style={{
              background: "var(--primary-grad)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Zap size={16} strokeWidth={2.5} />
            Start Auto Trading Bot
          </Link>
          <div
            className="absolute -bottom-1 left-6 right-6 h-1 rounded-full opacity-70 pointer-events-none"
            style={{
              background: "var(--gold-grad)",
              boxShadow: "0 0 8px var(--gold-glow)",
              filter: "blur(3px)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
