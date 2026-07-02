import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtNum, fmtUSD, shortSymbol } from "@/lib/format";
import CoinIcon from "@/components/CoinIcon";
import useBinanceStream from "@/hooks/useBinanceStream";

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
  const isRunning = bot.state === "running" || bot.state === "RUNNING";
  const cumProfit = bot.cumulative_profit || 0;

  return (
    <button
      onClick={() => navigate(`/pair/${bot.symbol}`)}
      data-testid={`bot-card-${bot.symbol}`}
      className="w-full text-left bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3 hover:border-[#00F0FF]/40 active:scale-[0.995] transition"
    >
      {/* Top row: coin, pair, mode, running dot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CoinIcon symbol={bot.symbol} size={30} />
          <div>
            <div className="font-display font-bold text-[14px] leading-none">
              {shortSymbol(bot.symbol)}/USDT
            </div>
            <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] mt-1 leading-none">
              {(bot.trade_method || "Cycle")} · {isRunning ? "Running" : "Idle"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-[#39FF14] shadow-[0_0_6px_#39FF14]" : "bg-[#8B9BB4]"}`}
          />
          <span
            className="text-[9px] uppercase tracking-widest font-bold"
            style={{ color: isRunning ? "#39FF14" : "#8B9BB4" }}
          >
            {isRunning ? "Live" : "Off"}
          </span>
        </div>
      </div>

      {/* Middle: price + floating */}
      <div className="flex items-end justify-between mt-2.5 gap-2">
        <div>
          <div className="text-[8px] uppercase tracking-widest text-[#8B9BB4] leading-none">
            Live Price
          </div>
          <div
            className="font-mono font-bold text-[15px] tabular-nums mt-1 leading-none"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {livePrice > 0 ? `$${fmtNum(livePrice, livePrice < 1 ? 4 : 2)}` : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-widest text-[#8B9BB4] leading-none">
            {hasPosition ? "Floating P&L" : "Position"}
          </div>
          {hasPosition ? (
            hasLivePrice ? (
              <div
                className={`font-mono font-bold text-[15px] tabular-nums mt-1 leading-none ${floating >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"}`}
                data-testid={`bot-floating-${bot.symbol}`}
              >
                {floating >= 0 ? "+" : ""}${fmtNum(floating, 2)}
                <span className="text-[9px] ml-1 opacity-80">
                  ({floating >= 0 ? "+" : ""}
                  {floatingPct.toFixed(2)}%)
                </span>
              </div>
            ) : (
              <div className="text-[10px] text-[#8B9BB4] mt-1">Connecting…</div>
            )
          ) : (
            <div className="text-[10px] text-[#8B9BB4] mt-1">No open position</div>
          )}
        </div>
      </div>

      {/* Bottom counter row (HiTechBot style) */}
      <div className="mt-3 pt-2.5 border-t border-white/10 grid grid-cols-4 gap-1.5">
        <Counter label="Buys" value={bot.buy_count || 0} color="#39FF14" testid={`bot-buys-${bot.symbol}`} />
        <Counter label="Sells" value={bot.sell_count || 0} color="#FF007A" testid={`bot-sells-${bot.symbol}`} />
        <Counter
          label="Round"
          value={hasPosition ? (bot.margin_call_count || 0) + 1 : "—"}
          color="#00F0FF"
          testid={`bot-round-${bot.symbol}`}
        />
        <Counter
          label="Profit"
          value={`${cumProfit >= 0 ? "+" : ""}$${fmtNum(cumProfit, 2)}`}
          color={cumProfit >= 0 ? "#39FF14" : "#FF007A"}
          small
          testid={`bot-profit-${bot.symbol}`}
        />
      </div>
    </button>
  );
}

function Counter({ label, value, color, small, testid }) {
  return (
    <div className="text-center" data-testid={testid}>
      <div className="text-[8px] uppercase tracking-widest text-[#8B9BB4] font-bold leading-none">
        {label}
      </div>
      <div
        className={`font-mono font-extrabold tabular-nums mt-1 leading-none ${small ? "text-[11px]" : "text-[14px]"}`}
        style={{ color }}
      >
        {value}
      </div>
    </div>
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
  const active = bots.filter((b) => b.state === "running" || b.state === "RUNNING").length;

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
      <div className="px-4 mt-3 space-y-2.5" data-testid="bots-list">
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
        className="fixed bottom-24 right-6 w-12 h-12 rounded-full bg-[#00F0FF] text-[#050914] flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.6)] hover:scale-105 active:scale-95 transition"
        style={{ zIndex: 40, right: "calc(50vw - 220px + 20px)" }}
        aria-label="Start new bot"
      >
        <Plus size={22} strokeWidth={3} />
      </button>
    </div>
  );
}
