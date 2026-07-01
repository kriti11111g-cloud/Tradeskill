import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Key, ArrowRightLeft, TrendingUp, Users, Gift, Trophy, BookOpen, Newspaper, Bell, Zap } from "lucide-react";
import api from "@/lib/api";
import { fmtUSD, fmtPct, fmtNum, shortSymbol } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const actions = [
  { to: "/bind-api", icon: Key, label: "Bind API", color: "#00F0FF", testid: "action-bind" },
  { to: "/transactions", icon: ArrowRightLeft, label: "Trades", color: "#FF007A", testid: "action-trades" },
  { to: "/revenue", icon: TrendingUp, label: "Revenue", color: "#39FF14", testid: "action-revenue" },
  { to: "/referral", icon: Users, label: "Referral", color: "#FFD700", testid: "action-referral" },
  { to: "/rewards", icon: Gift, label: "Rewards", color: "#00F0FF", testid: "action-rewards" },
  { to: "/rewards", icon: Trophy, label: "Bonus", color: "#FF007A", testid: "action-bonus" },
  { to: "/guide", icon: BookOpen, label: "Guide", color: "#39FF14", testid: "action-guide" },
  { to: "/news", icon: Newspaper, label: "News", color: "#FFD700", testid: "action-news" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [pairs, setPairs] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [bind, setBind] = useState(null);
  const [live, setLive] = useState(null);
  const [liveErr, setLiveErr] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const isLiveMode = bind?.mode === "real" || bind?.mode === "testnet";

  const loadLive = async () => {
    setLiveLoading(true);
    setLiveErr(null);
    try {
      const { data } = await api.get("/binance/account");
      setLive(data);
    } catch (err) {
      setLiveErr(err?.response?.data?.detail || err?.message || "Unable to load");
      setLive(null);
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    api.get("/market/pairs").then(({ data }) => setPairs(data.pairs || []));
    api.get("/wallet/summary").then(({ data }) => setWallet(data));
    api.get("/binance/bind").then(({ data }) => setBind(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isLiveMode) loadLive();
  }, [isLiveMode]);

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00F0FF] to-[#0088FF] flex items-center justify-center glow-cyan">
            <Zap size={18} className="text-[#050914]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#8B9BB4] font-bold">Hello,</div>
            <div className="font-display font-bold text-base" data-testid="user-greeting">
              {user?.name || "Trader"}
            </div>
          </div>
        </div>
        <Link
          to="/news"
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center relative"
          data-testid="notif-btn"
        >
          <Bell size={18} />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF007A] animate-tgx-pulse" />
        </Link>
      </div>

      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mt-5 relative overflow-hidden rounded-3xl border border-white/10 p-6 min-h-[170px] flex flex-col justify-end"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,240,255,0.20) 0%, rgba(255,0,122,0.20) 100%), url('https://images.pexels.com/photos/9404662/pexels-photo-9404662.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundBlendMode: "screen",
        }}
        data-testid="hero-banner"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#050914] via-transparent to-transparent" />
        <div className="relative z-10">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#FFD700] font-bold">New Era</div>
          <div className="font-display font-black text-3xl leading-tight tracking-tighter mt-1">
            OF CRYPTO
          </div>
          <div className="text-xs text-white/70 mt-1">Automate profits with quantitative trading.</div>
          <Link
            to="/bind-api"
            className="inline-flex items-center gap-1.5 mt-3 bg-white text-[#050914] rounded-full px-4 py-1.5 font-bold text-xs tracking-wide"
            data-testid="join-now-btn"
          >
            JOIN NOW →
          </Link>
        </div>
      </motion.div>

      {/* Wallet Snapshot */}
      <div className="mx-4 mt-4 bg-[#0F1524]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold">
            {isLiveMode ? "Demo Balance (USDT)" : "Total Assets (USDT)"}
          </div>
          <div className="font-display font-black text-2xl tabular-nums mt-1" data-testid="total-assets">
            {fmtNum(wallet?.total_usdt || user?.wallet_usdt || 0, 2)}
          </div>
        </div>
        <Link
          to="/wallet"
          className="text-[10px] uppercase tracking-[0.2em] text-[#00F0FF] font-bold border border-[#00F0FF]/40 rounded-full px-3 py-1.5 hover:bg-[#00F0FF]/10 transition"
          data-testid="wallet-link"
        >
          View →
        </Link>
      </div>

      {/* Real Binance Balance (live/testnet only) */}
      {isLiveMode && (
        <div className="mx-4 mt-3" data-testid="dash-live-balance">
          <div
            className={`rounded-2xl border p-4 relative overflow-hidden ${
              bind.mode === "real"
                ? "border-[#FF007A]/30 bg-gradient-to-br from-[#FF007A]/10 to-transparent"
                : "border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap
                  size={14}
                  className={bind.mode === "real" ? "text-[#FF007A]" : "text-[#FFD700]"}
                />
                <div className="text-[10px] uppercase tracking-[0.25em] font-bold">
                  Real Binance Fund ·{" "}
                  <span className={bind.mode === "real" ? "text-[#FF007A]" : "text-[#FFD700]"}>
                    {bind.mode}
                  </span>
                </div>
              </div>
              <button
                onClick={loadLive}
                disabled={liveLoading}
                data-testid="dash-live-refresh"
                className="text-[10px] uppercase tracking-widest text-[#00F0FF] font-bold hover:opacity-80 disabled:opacity-40"
              >
                {liveLoading ? "..." : "↻"}
              </button>
            </div>

            {liveErr && !live && (
              <div className="text-[11px] text-white/70" data-testid="dash-live-err">
                <span className="text-[#FF007A] font-bold">Unable to load · </span>
                {liveErr}
              </div>
            )}

            {live && (
              <div>
                {(() => {
                  const usdt = live.balances.find((b) => b.asset === "USDT");
                  return (
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold">
                        Available USDT on Binance
                      </div>
                      <div className="font-display font-black text-2xl tabular-nums mt-0.5">
                        {fmtNum(usdt?.free || 0, 2)}
                      </div>
                    </div>
                  );
                })()}
                {live.balances.filter((b) => b.asset !== "USDT" && b.free > 0).length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {live.balances
                      .filter((b) => b.asset !== "USDT" && b.free > 0)
                      .slice(0, 6)
                      .map((b) => (
                        <div
                          key={b.asset}
                          className="flex-shrink-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 min-w-[80px]"
                          data-testid={`dash-asset-${b.asset}`}
                        >
                          <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold">{b.asset}</div>
                          <div className="font-display font-bold text-xs tabular-nums">
                            {fmtNum(b.free, 4)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Grid */}
      <div className="grid grid-cols-4 gap-3 px-4 mt-5" data-testid="action-grid">
        {actions.map((a, i) => (
          <motion.div
            key={a.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={a.to}
              data-testid={a.testid}
              className="flex flex-col items-center gap-2 py-3 hover:opacity-80 transition"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5"
                style={{
                  background: `linear-gradient(135deg, ${a.color}22, transparent)`,
                  boxShadow: `inset 0 0 20px ${a.color}22`,
                }}
              >
                <a.icon size={20} strokeWidth={1.7} style={{ color: a.color }} />
              </div>
              <span className="text-[10px] text-center font-body font-semibold leading-tight">{a.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Active Trading Pairs */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display font-bold text-lg">Trading Pairs</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold">Live · Binance data</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-tgx-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-[#39FF14] font-bold">LIVE</span>
          </div>
        </div>

        <div className="space-y-3" data-testid="pairs-list">
          {pairs.map((p, i) => (
            <motion.div
              key={p.symbol}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={`/pair/${p.symbol}`}
                data-testid={`pair-${p.symbol}`}
                className="flex items-center justify-between bg-[#0F1524]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 hover:border-[#00F0FF]/30 hover:bg-[#0F1524]/80 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-black text-sm"
                    style={{
                      background: "linear-gradient(135deg, #00F0FF33, #FF007A33)",
                      color: "#fff",
                    }}
                  >
                    {shortSymbol(p.symbol).slice(0, 3)}
                  </div>
                  <div>
                    <div className="font-display font-bold text-sm">
                      {shortSymbol(p.symbol)}<span className="text-[#8B9BB4]">/USDT</span>
                    </div>
                    <div className="text-[10px] text-[#8B9BB4] uppercase tracking-wider mt-0.5">
                      Vol {(p.volume / 1_000_000).toFixed(1)}M
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold tabular-nums text-sm">
                    {fmtUSD(p.last_price, p.last_price > 100 ? 2 : 4)}
                  </div>
                  <div
                    className={`text-xs font-bold tabular-nums mt-0.5 ${
                      p.change_pct >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"
                    }`}
                  >
                    {fmtPct(p.change_pct)}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Start Bot CTA */}
      <div className="px-4 mt-6">
        <Link
          to="/pair/BTCUSDT"
          data-testid="start-bot-btn"
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00F0FF] to-[#0088FF] text-[#050914] font-display font-black text-base rounded-2xl py-4 hover:brightness-110 transition-all glow-cyan tracking-wide"
        >
          <Zap size={20} strokeWidth={2.5} /> START BOT
        </Link>
      </div>
    </div>
  );
}
