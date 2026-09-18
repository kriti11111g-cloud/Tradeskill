import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const IMG = "https://coin-images.coingecko.com/markets/images";
/* Top 25 spot exchanges (CMC rank order) — sabhi me trading API facility available hai */
const EXCHANGES = [
  { id: "binance", name: "Binance", tag: "Trade Smarter", color: "#F3BA2F", mono: "B", logo: `${IMG}/52/small/binance.jpg` },
  { id: "bybit", name: "Bybit", tag: "Next Level Trading", color: "#17181E", mono: "BB", logo: `${IMG}/698/small/bybit_spot.png` },
  { id: "coinbase", name: "Coinbase", tag: "The Future of Money", color: "#0052FF", mono: "C", logo: `${IMG}/23/small/Coinbase_Coin_Primary.png` },
  { id: "okx", name: "OKX", tag: "Trade Like a Pro", color: "#000000", mono: "OK", logo: `${IMG}/96/small/WeChat_Image_20220117220452.png` },
  { id: "upbit", name: "Upbit", tag: "Korea's #1 Exchange", color: "#093687", mono: "U", logo: `${IMG}/117/small/upbit.png` },
  { id: "bitget", name: "Bitget", tag: "Trade Better", color: "#00F0FF", mono: "BG", logo: `${IMG}/540/small/2023-07-25_21.47.43.jpg` },
  { id: "mexc", name: "MEXC", tag: "More Tokens, Lower Fees", color: "#1972E2", mono: "M", logo: `${IMG}/409/small/164286be-32a5-4b58-978c-d072eea00eb9.jpeg` },
  { id: "gate", name: "Gate", tag: "Your Gateway to Crypto", color: "#2354E6", mono: "G", logo: `${IMG}/60/small/Frame_1.png` },
  { id: "kucoin", name: "KuCoin", tag: "People's Exchange", color: "#24AE8F", mono: "K", logo: `${IMG}/61/small/kucoin.png` },
  { id: "kraken", name: "Kraken", tag: "Crypto Securely", color: "#5741D9", mono: "KR", logo: `${IMG}/29/small/kraken.jpg` },
  { id: "htx", name: "HTX", tag: "Global Crypto Exchange", color: "#2B3BD8", mono: "H", logo: `${IMG}/25/small/htx.png` },
  { id: "cryptocom", name: "Crypto.com", tag: "Fortune Favours the Brave", color: "#03316C", mono: "CR", logo: `${IMG}/589/small/h2oMjPp6_400x400.jpg` },
  { id: "bingx", name: "BingX", tag: "Broader View, Better Trade", color: "#2A54FF", mono: "BX", logo: `${IMG}/812/small/YtFwQwJr_400x400.jpg` },
  { id: "bitmart", name: "BitMart", tag: "Trade Digital Assets", color: "#22A079", mono: "BM", logo: `${IMG}/239/small/Bitmart.png` },
  { id: "lbank", name: "LBank", tag: "Global Digital Asset Hub", color: "#FFB800", mono: "LB", logo: `${IMG}/118/small/LBank_200_200.png` },
  { id: "bitfinex", name: "Bitfinex", tag: "Advanced Trading", color: "#16B157", mono: "BF", logo: `${IMG}/4/small/BItfinex.png` },
  { id: "whitebit", name: "WhiteBIT", tag: "European Exchange", color: "#252525", mono: "W", logo: `${IMG}/418/small/800_800.jpg` },
  { id: "bithumb", name: "Bithumb", tag: "Trusted in Korea", color: "#F37321", mono: "BH", logo: `${IMG}/6/small/bithumb_BI.png` },
  { id: "bitstamp", name: "Bitstamp", tag: "Original Since 2011", color: "#12A05C", mono: "BS", logo: `${IMG}/9/small/bitstamp.jpg` },
  { id: "xt", name: "XT.com", tag: "Trade Anything", color: "#E9BB41", mono: "XT", logo: `${IMG}/404/small/xt_logo_%E7%BB%BF.png` },
  { id: "coinw", name: "CoinW", tag: "Worldwide Trading", color: "#3D6DEB", mono: "CW", logo: `${IMG}/1172/small/coinw_new_logo.png` },
  { id: "phemex", name: "Phemex", tag: "Trade Simple", color: "#1B6EF3", mono: "P", logo: `${IMG}/564/small/phemex-exchange-new-logo.png` },
  { id: "pionex", name: "Pionex", tag: "Built-in Trading Bots", color: "#F7A600", mono: "PX", logo: `${IMG}/1026/small/pionex.png` },
  { id: "bitvavo", name: "Bitvavo", tag: "Digital Assets, Simplified", color: "#2A46FF", mono: "BV", logo: `${IMG}/714/small/bitvavo-mark-square-black.png` },
  { id: "gemini", name: "Gemini", tag: "Crypto Without Chaos", color: "#00DCFA", mono: "GE", logo: `${IMG}/50/small/gemini.png` },
];

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
              <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: ex.color }}>
                <span className="text-[13px] font-black text-white">{ex.mono}</span>
                <img
                  src={ex.logo}
                  alt={ex.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
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
