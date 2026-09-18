import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

/* Top 25 spot exchanges (CMC rank order) — sabhi me trading API facility available hai */
const EXCHANGES = [
  { id: "binance", name: "Binance", tag: "Trade Smarter", color: "#F3BA2F", mono: "◆" },
  { id: "bybit", name: "Bybit", tag: "Next Level Trading", color: "#17181E", mono: "BB" },
  { id: "coinbase", name: "Coinbase", tag: "The Future of Money", color: "#0052FF", mono: "C" },
  { id: "okx", name: "OKX", tag: "Trade Like a Pro", color: "#000000", mono: "OK" },
  { id: "upbit", name: "Upbit", tag: "Korea's #1 Exchange", color: "#093687", mono: "U" },
  { id: "bitget", name: "Bitget", tag: "Trade Better", color: "#00F0FF", mono: "BG" },
  { id: "mexc", name: "MEXC", tag: "More Tokens, Lower Fees", color: "#1972E2", mono: "M" },
  { id: "gate", name: "Gate", tag: "Your Gateway to Crypto", color: "#2354E6", mono: "G" },
  { id: "kucoin", name: "KuCoin", tag: "People's Exchange", color: "#24AE8F", mono: "K" },
  { id: "kraken", name: "Kraken", tag: "Crypto Securely", color: "#5741D9", mono: "KR" },
  { id: "htx", name: "HTX", tag: "Global Crypto Exchange", color: "#2B3BD8", mono: "H" },
  { id: "cryptocom", name: "Crypto.com", tag: "Fortune Favours the Brave", color: "#03316C", mono: "CR" },
  { id: "bingx", name: "BingX", tag: "Broader View, Better Trade", color: "#2A54FF", mono: "BX" },
  { id: "bitmart", name: "BitMart", tag: "Trade Digital Assets", color: "#22A079", mono: "BM" },
  { id: "lbank", name: "LBank", tag: "Global Digital Asset Hub", color: "#FFB800", mono: "LB" },
  { id: "bitfinex", name: "Bitfinex", tag: "Advanced Trading", color: "#16B157", mono: "BF" },
  { id: "whitebit", name: "WhiteBIT", tag: "European Exchange", color: "#252525", mono: "W" },
  { id: "bithumb", name: "Bithumb", tag: "Trusted in Korea", color: "#F37321", mono: "BH" },
  { id: "bitstamp", name: "Bitstamp", tag: "Original Since 2011", color: "#12A05C", mono: "BS" },
  { id: "xt", name: "XT.com", tag: "Trade Anything", color: "#E9BB41", mono: "XT" },
  { id: "coinw", name: "CoinW", tag: "Worldwide Trading", color: "#3D6DEB", mono: "CW" },
  { id: "phemex", name: "Phemex", tag: "Trade Simple", color: "#1B6EF3", mono: "P" },
  { id: "pionex", name: "Pionex", tag: "Built-in Trading Bots", color: "#F7A600", mono: "PX" },
  { id: "bitvavo", name: "Bitvavo", tag: "Digital Assets, Simplified", color: "#2A46FF", mono: "BV" },
  { id: "gemini", name: "Gemini", tag: "Crypto Without Chaos", color: "#00DCFA", mono: "GE" },
];

const BinanceLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
    <path d="M12 2 8.7 5.3 12 8.6l3.3-3.3L12 2zM5.3 8.7 2 12l3.3 3.3L8.6 12 5.3 8.7zm13.4 0L15.4 12l3.3 3.3L22 12l-3.3-3.3zM12 15.4l-3.3 3.3L12 22l3.3-3.3-3.3-3.3zm0-6.1L9.3 12l2.7 2.7 2.7-2.7L12 9.3z" />
  </svg>
);

export default function ExchangeList() {
  const [bind, setBind] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/binance/bind").then(({ data }) => setBind(data)).catch(() => {});
  }, []);

  const binanceBound = !!bind?.bound && bind?.mode !== "demo";

  return (
    <div className="pb-24" data-testid="exchange-list-page">
      <div className="sticky top-0 z-20 pt-3 pb-2 px-4" style={{ background: "var(--bg-base)" }}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <button onClick={() => navigate(-1)} className="p-1 justify-self-start" style={{ color: "var(--ink)" }} data-testid="exchange-back">
            <ArrowLeft size={24} strokeWidth={2.4} />
          </button>
          <div className="text-center">
            <div className="font-display font-black text-2xl leading-tight" style={{ color: "var(--ink)" }}>Api Binding Exchange</div>
            <div className="text-[11px]" style={{ color: "var(--text-mute)" }}>Top 25 · API supported only</div>
          </div>
          <span />
        </div>
      </div>

      <div className="px-4 mt-1 space-y-2">
        {EXCHANGES.map((ex, i) => {
          const isBinance = ex.id === "binance";
          return (
            <button
              key={ex.id}
              onClick={() =>
                isBinance
                  ? navigate("/bind-api/binance")
                  : toast(`${ex.name} integration — Coming Soon 🚀 (abhi Binance supported hai)`)
              }
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition active:scale-[0.995]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
              data-testid={`exchange-row-${ex.id}`}
            >
              <span className="w-6 text-[12px] font-black tabular-nums text-center shrink-0" style={{ color: "var(--text-mute)" }}>
                {i + 1}
              </span>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: ex.color }}>
                {isBinance ? (
                  <BinanceLogo />
                ) : (
                  <span className="text-[13px] font-black text-white" style={ex.color === "#00F0FF" || ex.color === "#FFB800" || ex.color === "#E9BB41" || ex.color === "#00DCFA" || ex.color === "#F7A600" ? { color: "#111" } : {}}>
                    {ex.mono}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-black truncate" style={{ color: "var(--ink)" }}>{ex.name}</div>
                <div className="text-[11px] truncate" style={{ color: "var(--text-mute)" }}>{ex.tag}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isBinance && binanceBound ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-black" style={{ background: "#DCFCE7", color: "#15803D" }}>
                    Bound · Live
                  </span>
                ) : isBinance && bind?.bound ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-black" style={{ background: "#DCFCE7", color: "#15803D" }}>
                    Bound · Demo
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: "var(--surface-3)", color: "var(--text-mute)" }}>
                    Not Bound
                  </span>
                )}
                <ChevronRight size={16} style={{ color: "var(--ink)" }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
