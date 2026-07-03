import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
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
      className="w-full text-left bg-[#0F1524]/60 backdrop-blur-xl border border-white/15 rounded-xl p-2.5 hover:border-[#00F0FF]/40 active:scale-[0.995] transition"
    >
      {/* Top row: coin, pair, mode, running dot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CoinIcon symbol={bot.symbol} size={24} />
          <div>
            <div className="font-bold text-[12px] leading-none">
              {shortSymbol(bot.symbol)}/USDT
            </div>
            <div className="text-[8px] uppercase tracking-widest text-[#8B9BB4] mt-1 leading-none">
              {(bot.trade_method || "Cycle")} · {isRunning ? "Running" : "Idle"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-[#39FF14] shadow-[0_0_6px_#39FF14]" : "bg-[#8B9BB4]"}`}
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
          <div className="text-[7px] uppercase tracking-widest text-[#8B9BB4] leading-none">
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
          <div className="text-[7px] uppercase tracking-widest text-[#8B9BB4] leading-none">
            {hasPosition ? "Floating P&L" : "Position"}
          </div>
          {hasPosition ? (
            hasLivePrice ? (
              <div
                className={`font-mono font-bold text-[12px] tabular-nums mt-0.5 leading-none ${floating >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"}`}
                data-testid={`bot-floating-${bot.symbol}`}
              >
                {floating >= 0 ? "+" : ""}${fmtNum(floating, 2)}
                <span className="text-[8px] ml-1 opacity-80">
                  ({floating >= 0 ? "+" : ""}
                  {floatingPct.toFixed(2)}%)
                </span>
              </div>
            ) : (
              <div className="text-[9px] text-[#8B9BB4] mt-0.5">Connecting…</div>
            )
          ) : (
            <div className="text-[9px] text-[#8B9BB4] mt-0.5">No open position</div>
          )}
        </div>
      </div>

      {/* Merged Buy/Sell/Profit strip with date range */}
      <div className="mt-2 pt-2 border-t border-white/10">
        {(bot.first_trade_at || bot.last_trade_at) && (
          <div
            className="text-[8px] uppercase tracking-widest text-[#8B9BB4] font-bold mb-1"
            style={{ fontVariantNumeric: "tabular-nums" }}
            data-testid={`bot-date-range-${bot.symbol}`}
          >
            {fmtDateShortUTC(bot.first_trade_at)}
            {bot.first_trade_at !== bot.last_trade_at && (
              <> → {fmtDateShortUTC(bot.last_trade_at)}</>
            )}
            {(bot.margin_call_count > 0 || hasPosition) && (
              <span className="ml-2 text-[#00F0FF]">· Round {(bot.margin_call_count || 0) + (hasPosition ? 1 : 0)}</span>
            )}
          </div>
        )}
        <div
          className="flex items-center gap-2 text-[11px] font-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <span className="text-[#39FF14] font-bold" data-testid={`bot-buys-${bot.symbol}`}>
            {bot.buy_count || 0}<span className="text-[8px] uppercase tracking-widest text-[#8B9BB4] ml-1">Buys</span>
          </span>
          <span className="text-white/20">·</span>
          <span className="text-[#FF007A] font-bold" data-testid={`bot-sells-${bot.symbol}`}>
            {bot.sell_count || 0}<span className="text-[8px] uppercase tracking-widest text-[#8B9BB4] ml-1">Sells</span>
          </span>
          <span
            className={`ml-auto font-extrabold ${cumProfit >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"}`}
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

  const totalProfit = bots.reduce((s, b) => s + (b.cumulative_profit || 0), 0);
  const active = bots.filter(
    (b) => String(b.status || b.state || "").toLowerCase() === "running"
  ).length;

  return (
    <div className="pb-24">
      <PageHeader
        title="Trade"
        subtitle={`${bots.length} Bots · ${active} Running`}
        showBack={false}
      />

      {/* Summary strip */}
      <div className="px-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/15 bg-[#0F1524]/50 p-2.5">
          <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-semibold">
            Active Bots
          </div>
          <div className="font-mono font-extrabold text-[16px] mt-1 tabular-nums">{active}</div>
        </div>
        <div className="rounded-xl border border-white/15 bg-[#0F1524]/50 p-2.5">
          <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-semibold">
            Total Bots
          </div>
          <div className="font-mono font-extrabold text-[16px] mt-1 tabular-nums">{bots.length}</div>
        </div>
        <div className="rounded-xl border border-white/15 bg-[#0F1524]/50 p-2.5">
          <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-semibold">
            Total Profit
          </div>
          <div
            className={`font-mono font-extrabold text-[16px] mt-1 tabular-nums ${totalProfit >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"}`}
            data-testid="trades-total-profit"
          >
            {totalProfit >= 0 ? "+" : ""}${fmtNum(totalProfit, 2)}
          </div>
        </div>
      </div>

      {/* Bot cards list */}
      <div className="px-4 mt-3 space-y-1.5" data-testid="bots-list">
        {loading && (
          <div className="text-center text-sm text-[#8B9BB4] py-12">Loading bots…</div>
        )}
        {!loading && bots.length === 0 && (
          <div
            className="text-center text-sm text-[#8B9BB4] py-16 border border-dashed border-white/20 rounded-2xl"
            data-testid="no-bots"
          >
            No bots yet. Tap the + button to start one.
          </div>
        )}
        {bots.map((b) => (
          <BotCard key={b.symbol} bot={b} />
        ))}
      </div>

      {/* Floating add-bot button */}
      <button
        onClick={() => navigate("/market")}
        data-testid="add-bot-fab"
        className="fixed bottom-24 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#00F0FF] text-[#050914] font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(0,240,255,0.6)] hover:scale-105 active:scale-95 transition"
        style={{ zIndex: 40, right: "calc(50vw - 220px + 20px)" }}
        aria-label="Start new bot"
      >
        <Plus size={16} strokeWidth={3} />
        New Bot
      </button>
    </div>
  );
}
