import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Key, ArrowRightLeft, TrendingUp, Users, Gift, Trophy, BookOpen, Newspaper, Zap } from "lucide-react";
import api from "@/lib/api";
import { fmtUSD, fmtPct, fmtNum, shortSymbol } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import CoinIcon from "@/components/CoinIcon";

const actions = [
  { to: "/bind-api", icon: Key, label: "Bind API", testid: "action-bind" },
  { to: "/transactions", icon: ArrowRightLeft, label: "Trade History", testid: "action-trades" },
  { to: "/revenue", icon: TrendingUp, label: "Revenue", testid: "action-revenue" },
  { to: "/referral", icon: Users, label: "Referral", testid: "action-referral" },
  { to: "/rewards", icon: Gift, label: "Rewards", testid: "action-rewards" },
  { to: "/rewards", icon: Trophy, label: "Bonus", testid: "action-bonus" },
  { to: "/guide", icon: BookOpen, label: "Guide", testid: "action-guide" },
  { to: "/news", icon: Newspaper, label: "News", testid: "action-news" },
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
    api.get("/market/top?limit=8").then(({ data }) => {
      const list = (data.coins || []).map((c) => ({
        symbol: c.symbol,
        asset: c.asset,
        rank: c.rank,
        last_price: c.last_price,
        change_pct: c.change_pct,
        volume: c.volume,
        image: c.image,
      }));
      setPairs(list);
    });
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
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--primary-grad)", boxShadow: "var(--shadow-sm)" }}
          >
            <Zap size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.25em] font-bold"
              style={{ color: "var(--text-mute)" }}
            >
              Hello,
            </div>
            <div
              className="font-display font-bold text-base"
              style={{ color: "var(--text)" }}
              data-testid="user-greeting"
            >
              {user?.name || "Trader"}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mt-5 relative overflow-hidden rounded-3xl p-6 min-h-[170px] flex flex-col justify-end"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,230,118,0.30) 0%, rgba(0,200,83,0.20) 100%), url('https://images.pexels.com/photos/9404662/pexels-photo-9404662.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundBlendMode: "screen",
          border: "1px solid var(--border)",
        }}
        data-testid="hero-banner"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--bg-base), transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div
            className="text-[10px] uppercase tracking-[0.3em] font-bold"
            style={{ color: "var(--primary)" }}
          >
            New Era
          </div>
          <div
            className="font-display font-black text-3xl leading-tight tracking-tighter mt-1 text-white"
          >
            OF CRYPTO
          </div>
          <div className="text-xs text-white/80 mt-1">
            Automate profits with quantitative trading.
          </div>
          <Link
            to="/bind-api"
            className="inline-flex items-center gap-1.5 mt-3 rounded-full px-4 py-1.5 font-bold text-xs tracking-wide text-white"
            style={{ background: "var(--primary-grad)", boxShadow: "var(--shadow-sm)" }}
            data-testid="join-now-btn"
          >
            JOIN NOW →
          </Link>
        </div>
      </motion.div>

      {/* Wallet Snapshot */}
      <div
        className="mx-4 mt-4 backdrop-blur-xl rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.2em] font-bold"
            style={{ color: "var(--text-mute)" }}
          >
            {isLiveMode ? "Demo Balance (USDT)" : "Total Assets (USDT)"}
          </div>
          <div
            className="font-display font-black text-2xl tabular-nums mt-1"
            style={{ color: "var(--text)" }}
            data-testid="total-assets"
          >
            {fmtNum(wallet?.total_usdt || user?.wallet_usdt || 0, 2)}
          </div>
        </div>
        <Link
          to="/wallet"
          className="text-[10px] uppercase tracking-[0.2em] font-bold rounded-full px-3 py-1.5 transition"
          style={{ color: "var(--primary)", border: "1px solid var(--border)" }}
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
                ? "border-[color:var(--bad)]/30 bg-gradient-to-br from-[#FF007A]/10 to-transparent"
                : "border-[color:var(--warn)]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap
                  size={14}
                  className={bind.mode === "real" ? "text-[color:var(--bad)]" : "text-[color:var(--warn)]"}
                />
                <div className="text-[10px] uppercase tracking-[0.25em] font-bold">
                  Real Binance Fund ·{" "}
                  <span className={bind.mode === "real" ? "text-[color:var(--bad)]" : "text-[color:var(--warn)]"}>
                    {bind.mode}
                  </span>
                </div>
              </div>
              <button
                onClick={loadLive}
                disabled={liveLoading}
                data-testid="dash-live-refresh"
                className="text-[10px] uppercase tracking-widest text-[color:var(--primary)] font-bold hover:opacity-80 disabled:opacity-40"
              >
                {liveLoading ? "..." : "↻"}
              </button>
            </div>

            {liveErr && !live && (
              <div className="text-[11px] text-white/70" data-testid="dash-live-err">
                <span className="text-[color:var(--bad)] font-bold">Unable to load · </span>
                {liveErr}
              </div>
            )}

            {live && (
              <div>
                {(() => {
                  const usdt = live.balances.find((b) => b.asset === "USDT");
                  return (
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">
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
                          className="flex-shrink-0 bg-white/5 border border-[color:var(--border)] rounded-lg px-2.5 py-1.5 min-w-[80px] flex items-center gap-2"
                          data-testid={`dash-asset-${b.asset}`}
                        >
                          <CoinIcon symbol={b.asset} size={20} />
                          <div>
                            <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">{b.asset}</div>
                            <div className="font-display font-bold text-xs tabular-nums">
                              {fmtNum(b.free, 4)}
                            </div>
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
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: "var(--primary-soft-grad)",
                  border: "1px solid var(--border)",
                }}
              >
                <a.icon size={20} strokeWidth={1.7} color="var(--primary)" />
              </div>
              <span
                className="text-[10px] text-center font-body font-semibold leading-tight"
                style={{ color: "var(--text-soft)" }}
              >
                {a.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Top Market Movers preview → link to full Market tab */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div
              className="font-display font-bold text-lg"
              style={{ color: "var(--text)" }}
            >
              Top Movers
            </div>
            <div
              className="text-[10px] uppercase tracking-[0.2em] font-bold"
              style={{ color: "var(--text-mute)" }}
            >
              Live · Tap to view full market
            </div>
          </div>
          <Link
            to="/market"
            data-testid="see-market-link"
            className="text-[10px] uppercase tracking-widest font-bold rounded-full px-3 py-1.5"
            style={{ color: "var(--primary)", border: "1px solid var(--border)" }}
          >
            See Market →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2" data-testid="top-movers-grid">
          {pairs.slice(0, 4).map((p, i) => (
            <motion.div
              key={p.symbol}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={`/pair/${p.symbol}`}
                data-testid={`mover-${p.symbol}`}
                className="flex items-center gap-2.5 backdrop-blur-xl rounded-2xl p-3 transition-all"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <CoinIcon symbol={p.symbol} size={32} />
                <div className="min-w-0 flex-1">
                  <div
                    className="font-display font-bold text-xs truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {shortSymbol(p.symbol)}
                  </div>
                  <div
                    className="font-display font-bold text-[11px] tabular-nums"
                    style={{ color: "var(--text)" }}
                  >
                    {fmtUSD(p.last_price, p.last_price > 100 ? 0 : 2)}
                  </div>
                  <div
                    className="text-[10px] font-bold tabular-nums"
                    style={{
                      color: p.change_pct >= 0 ? "var(--good)" : "var(--bad)",
                    }}
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
          className="w-full flex items-center justify-center gap-2 text-white font-display font-black text-base rounded-2xl py-4 transition-all tracking-wide"
          style={{
            background: "var(--primary-grad)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <Zap size={20} strokeWidth={2.5} /> START BOT
        </Link>
      </div>
    </div>
  );
}
