import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Wallet as WalletIcon, Link2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtNum, fmtUSD, shortSymbol } from "@/lib/format";
import CoinIcon from "@/components/CoinIcon";
import useBinanceStream from "@/hooks/useBinanceStream";

const fmtDateShortUTC = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
};

function BotCard({ bot }) {
  const navigate = useNavigate();
  const ticker = useBinanceStream(bot.symbol);
  const hasLivePrice = (ticker?.price || 0) > 0;
  const livePrice = hasLivePrice ? ticker.price : bot.avg_price || 0;
  const positionQty = bot.position_qty || 0;
  const avgPrice = bot.avg_price || 0;
  const hasPosition = positionQty > 0 && avgPrice > 0;
  const marketValue = positionQty * livePrice;
  const costBasis = positionQty * avgPrice;
  const floating = hasPosition && hasLivePrice ? marketValue - costBasis : 0;
  const floatingPct =
    hasPosition && hasLivePrice && avgPrice > 0 ? ((livePrice - avgPrice) / avgPrice) * 100 : 0;
  const rawState = bot.status || bot.state || "";
  const isRunning = String(rawState).toLowerCase() === "running";
  const cumProfit = bot.cumulative_profit || 0;

  return (
    <button
      onClick={() => navigate(`/pair/${bot.symbol}`)}
      data-testid={`bot-card-${bot.symbol}`}
      className={`relative w-full text-left rounded-xl p-2.5 active:scale-[0.995] transition-all overflow-hidden ${
        isRunning
          ? "bg-gradient-to-br from-[color:var(--surface)] to-[color:var(--bg-base)] border border-[color:var(--good)]/35 hover:border-[color:var(--good)]/60"
          : "bg-[color:var(--surface)]/60 backdrop-blur-xl border border-[color:var(--border-soft)] hover:border-[color:var(--primary)]/40"
      }`}
      style={
        isRunning
          ? { boxShadow: "inset 0 0 12px rgba(57,255,20,0.06), 0 0 0 1px rgba(57,255,20,0.05)" }
          : undefined
      }
    >
      {/* Left accent bar for live bots */}
      {isRunning && (
        <div
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[color:var(--good)]"
          style={{ boxShadow: "0 0 10px rgba(57,255,20,0.7)" }}
        />
      )}
      {/* Top row: coin, pair, mode, running dot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CoinIcon symbol={bot.symbol} size={24} />
          <div>
            <div className="font-bold text-[12px] leading-none">
              {shortSymbol(bot.symbol)}/USDT
            </div>
            <div className="text-[8px] uppercase tracking-widest text-[color:var(--text-mute)] mt-1 leading-none">
              {(bot.trade_method || "Cycle")} · {isRunning ? "Running" : "Idle"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-[color:var(--good)] shadow-[0_0_6px_#39FF14]" : "bg-[#8B9BB4]"}`}
          />
          <span
            className="text-[8px] uppercase tracking-widest font-bold"
            style={{ color: isRunning ? "#39FF14" : "#8B9BB4" }}
          >
            {isRunning ? "Live" : "Off"}
          </span>
        </div>
      </div>

      {/* Middle: price + floating */}
      <div className="flex items-end justify-between mt-2 gap-2">
        <div>
          <div className="text-[7px] uppercase tracking-widest text-[color:var(--text-mute)] leading-none">
            Live Price
          </div>
          <div
            className="font-mono font-bold text-[12px] tabular-nums mt-0.5 leading-none"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {livePrice > 0 ? `$${fmtNum(livePrice, livePrice < 1 ? 4 : 2)}` : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[7px] uppercase tracking-widest text-[color:var(--text-mute)] leading-none">
            {hasPosition ? "Floating P&L" : "Position"}
          </div>
          {hasPosition ? (
            hasLivePrice ? (
              <div
                className={`font-mono font-bold text-[12px] tabular-nums mt-0.5 leading-none ${floating >= 0 ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"}`}
                data-testid={`bot-floating-${bot.symbol}`}
              >
                {floating >= 0 ? "+" : ""}${fmtNum(floating, 2)}
                <span className="text-[8px] ml-1 opacity-80">
                  ({floating >= 0 ? "+" : ""}
                  {floatingPct.toFixed(2)}%)
                </span>
              </div>
            ) : (
              <div className="text-[9px] text-[color:var(--text-mute)] mt-0.5">Connecting…</div>
            )
          ) : (
            <div className="text-[9px] text-[color:var(--text-mute)] mt-0.5">No open position</div>
          )}
        </div>
      </div>

      {/* Merged Buy/Sell/Profit strip with date range */}
      <div className="mt-2 pt-2 border-t border-[color:var(--border-soft)]">
        {(bot.first_trade_at || bot.last_trade_at) && (
          <div
            className="text-[8px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold mb-1"
            style={{ fontVariantNumeric: "tabular-nums" }}
            data-testid={`bot-date-range-${bot.symbol}`}
          >
            {fmtDateShortUTC(bot.first_trade_at)}
            {bot.first_trade_at !== bot.last_trade_at && (
              <> → {fmtDateShortUTC(bot.last_trade_at)}</>
            )}
            {(bot.margin_call_count > 0 || hasPosition) && (
              <span className="ml-2 text-[color:var(--primary)]">· Round {(bot.margin_call_count || 0) + (hasPosition ? 1 : 0)}</span>
            )}
          </div>
        )}
        <div
          className="flex items-center gap-2 text-[11px] font-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <span className="text-[color:var(--good)] font-bold" data-testid={`bot-buys-${bot.symbol}`}>
            {bot.buy_count || 0}<span className="text-[8px] uppercase tracking-widest text-[color:var(--text-mute)] ml-1">Buys</span>
          </span>
          <span className="text-white/20">·</span>
          <span className="text-[color:var(--bad)] font-bold" data-testid={`bot-sells-${bot.symbol}`}>
            {bot.sell_count || 0}<span className="text-[8px] uppercase tracking-widest text-[color:var(--text-mute)] ml-1">Sells</span>
          </span>
          <span
            className={`ml-auto font-extrabold ${cumProfit >= 0 ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"}`}
            data-testid={`bot-profit-${bot.symbol}`}
          >
            {cumProfit >= 0 ? "+" : ""}${fmtNum(cumProfit, 2)}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function Trades() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("live"); // "live" | "all" | "idle"
  const [spot, setSpot] = useState(null);       // { mode, connected, usdt_balance, error? }
  const navigate = useNavigate();

  useEffect(() => {
    const load = () =>
      api
        .get("/bots")
        .then(({ data }) => setBots(data || []))
        .finally(() => setLoading(false));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const loadWallet = async () => {
      try {
        const { data } = await api.get("/wallet/spot");
        setSpot(data);
      } catch {
        /* silent */
      }
    };
    loadWallet();
    const t = setInterval(loadWallet, 15000);
    return () => clearInterval(t);
  }, []);

  const isLive = (b) => String(b.status || b.state || "").toLowerCase() === "running";
  const totalProfit = bots.reduce((s, b) => s + (b.cumulative_profit || 0), 0);
  const active = bots.filter(isLive).length;

  // Sort: live bots first, then by profit desc
  const sorted = [...bots].sort((a, b) => {
    const la = isLive(a) ? 1 : 0;
    const lb = isLive(b) ? 1 : 0;
    if (la !== lb) return lb - la;
    return (b.cumulative_profit || 0) - (a.cumulative_profit || 0);
  });

  const visible =
    filter === "live"
      ? sorted.filter(isLive)
      : filter === "idle"
      ? sorted.filter((b) => !isLive(b))
      : sorted;

  const idleCount = bots.length - active;

  return (
    <div className="pb-24">
      <PageHeader
        title="Trade"
        subtitle={`${bots.length} Bots · ${active} Running`}
        showBack={false}
      />

      {/* Wallet Card — Only the connected Exchange API's USDT balance */}
      <div className="px-4 mb-3">
        <button
          onClick={() => navigate("/bind-api")}
          className="w-full text-left rounded-2xl border border-[color:var(--primary)]/25 bg-gradient-to-br from-[color:var(--surface)] to-[color:var(--bg-base)] p-3 hover:border-[color:var(--warn)]/40 transition"
          style={{ boxShadow: "0 0 22px rgba(16,185,129,0.08)" }}
          data-testid="trades-wallet-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <WalletIcon size={14} className="text-[color:var(--primary)]" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--text-mute)] font-semibold">
              Exchange Wallet
            </span>
            <span
              className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded ${
                spot?.connected
                  ? "bg-[color:var(--good)]/15 text-[color:var(--good)]"
                  : "bg-white/5 text-[color:var(--text-mute)]"
              }`}
              data-testid="wallet-exchange-status"
            >
              {spot?.connected ? (spot?.mode || "LIVE").toUpperCase() : "NOT LINKED"}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div
                className="font-mono font-extrabold text-[22px] tabular-nums text-white leading-none"
                data-testid="wallet-exchange-usdt"
              >
                {spot?.connected ? fmtUSD(spot?.usdt_balance || 0) : "—"}
              </div>
              <div className="text-[10px] text-[color:var(--text-mute)] mt-1.5 flex items-center gap-1">
                <Link2 size={10} className={spot?.connected ? "text-[color:var(--good)]" : "text-[color:var(--text-mute)]"} />
                {spot?.connected
                  ? "Binance · Spot USDT (free)"
                  : spot?.error
                  ? "Binance geo-blocked from server region"
                  : "Tap to bind your Binance API"}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Summary strip */}
      <div className="px-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]/50 p-2.5">
          <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-semibold">
            Active Bots
          </div>
          <div className="font-mono font-extrabold text-[16px] mt-1 tabular-nums text-[color:var(--good)]">{active}</div>
        </div>
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]/50 p-2.5">
          <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-semibold">
            Total Bots
          </div>
          <div className="font-mono font-extrabold text-[16px] mt-1 tabular-nums">{bots.length}</div>
        </div>
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]/50 p-2.5">
          <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)] font-semibold">
            Total Profit
          </div>
          <div
            className={`font-mono font-extrabold text-[16px] mt-1 tabular-nums ${totalProfit >= 0 ? "text-[color:var(--good)]" : "text-[color:var(--bad)]"}`}
            data-testid="trades-total-profit"
          >
            {totalProfit >= 0 ? "+" : ""}${fmtNum(totalProfit, 2)}
          </div>
        </div>
      </div>

      {/* Filter chips: Live / All / Idle */}
      <div className="px-4 mt-3 flex items-center gap-2" data-testid="trades-filter">
        {[
          { key: "live", label: "Live", count: active, color: "#39FF14" },
          { key: "all", label: "All", count: bots.length, color: "#10B981" },
          { key: "idle", label: "Idle", count: idleCount, color: "#8B9BB4" },
        ].map((t) => {
          const isActive = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              data-testid={`trades-filter-${t.key}`}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-black transition-all"
              style={{
                background: isActive ? `${t.color}18` : "rgba(255,255,255,0.03)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: isActive ? `${t.color}80` : "rgba(255,255,255,0.15)",
                color: isActive ? t.color : "#8B9BB4",
                boxShadow: isActive ? `0 0 12px ${t.color}40` : "none",
              }}
            >
              {t.key === "live" && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: t.color,
                    boxShadow: isActive ? `0 0 6px ${t.color}` : "none",
                  }}
                />
              )}
              {t.label}
              <span
                className="tabular-nums font-mono"
                style={{ color: isActive ? t.color : "#556072" }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bot cards list */}
      <div className="px-4 mt-3 space-y-1.5" data-testid="bots-list">
        {loading && (
          <div className="text-center text-sm text-[color:var(--text-mute)] py-12">Loading bots…</div>
        )}
        {!loading && bots.length === 0 && (
          <div
            className="text-center text-sm text-[color:var(--text-mute)] py-16 border border-dashed border-[color:var(--border)] rounded-2xl"
            data-testid="no-bots"
          >
            No bots yet. Tap the + button to start one.
          </div>
        )}
        {!loading && bots.length > 0 && visible.length === 0 && (
          <div
            className="text-center text-sm text-[color:var(--text-mute)] py-16 border border-dashed border-[color:var(--border)] rounded-2xl"
            data-testid="no-bots-filter"
          >
            {filter === "live" ? (
              <>
                No live bots right now.<br />
                <span className="text-[11px] text-[#556072]">Switch to <b>All</b> to view idle bots.</span>
              </>
            ) : (
              "No bots in this filter."
            )}
          </div>
        )}
        {visible.map((b) => (
          <BotCard key={b.symbol} bot={b} />
        ))}
      </div>

      {/* Floating add-bot button */}
      <button
        onClick={() => navigate("/market")}
        data-testid="add-bot-fab"
        className="fixed bottom-24 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[color:var(--primary)] text-white font-black text-xs uppercase tracking-widest shadow-[0_0_20px_var(--primary-glow)] hover:scale-105 active:scale-95 transition"
        style={{ zIndex: 40, right: "calc(50vw - 220px + 20px)" }}
        aria-label="Start new bot"
      >
        <Plus size={16} strokeWidth={3} />
        New Bot
      </button>
    </div>
  );
}
