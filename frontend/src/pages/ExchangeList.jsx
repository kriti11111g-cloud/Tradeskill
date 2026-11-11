import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, BookOpen, BadgeCheck, KeyRound, ShieldCheck, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const IMG = "https://coin-images.coingecko.com/markets/images";
/* Top spot exchanges — sabhi me trading API facility available hai */
const EXCHANGES = [
  { id: "binance", name: "Binance", tag: "Trade Smarter", color: "#F3BA2F", mono: "B", logo: `${IMG}/52/small/binance.jpg` },
  { id: "bybit", name: "Bybit", tag: "Next Level Trading", color: "#17181E", mono: "BB", logo: `${IMG}/698/small/bybit_spot.png` },
  { id: "coinbase", name: "Coinbase", tag: "The Future of Money", color: "#0052FF", mono: "C", logo: `${IMG}/23/small/Coinbase_Coin_Primary.png` },
  { id: "okx", name: "OKX", tag: "Trade Like a Pro", color: "#000000", mono: "OK", logo: `${IMG}/96/small/WeChat_Image_20220117220452.png` },
  { id: "upbit", name: "Upbit", tag: "Korea's #1 Exchange", color: "#093687", mono: "U", logo: `${IMG}/117/small/upbit.png` },
  { id: "bitget", name: "Bitget", tag: "Trade Better", color: "#00F0FF", mono: "BG", logo: `${IMG}/540/small/2023-07-25_21.47.43.jpg` },
  { id: "mexc", name: "MEXC", tag: "More Tokens, Lower Fees", color: "#1972E2", mono: "M", logo: `${IMG}/409/small/164286be-32a5-4b58-978c-d072eea00eb9.jpeg` },
  { id: "gate", name: "Gate", tag: "Your Gateway to Crypto", color: "#2354E6", mono: "G", logo: `${IMG}/60/small/Frame_1.png` },
  { id: "hyperliquid", name: "Hyperliquid", tag: "No-KYC · Non-custodial Spot", color: "#0B3B36", mono: "HL", logo: "https://customer-assets-lxgj4vgw.emergentagent.net/job_tgx-api-gateway/artifacts/c48ff1bb886e9d5b_logo.png" },
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

const Logo = ({ ex, s = 30, ts = "text-[11px]" }) => (
  <div className={`relative rounded-full overflow-hidden flex items-center justify-center shrink-0 ${ts}`} style={{ width: s, height: s, background: ex.color }}>
    <span className="font-black text-white">{ex.mono}</span>
    <img
      src={ex.logo}
      alt={ex.name}
      className="absolute inset-0 w-full h-full object-cover"
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  </div>
);

const SUPPORTED = new Set(["hyperliquid", "binance", "kucoin", "lbank"]);

export default function ExchangeList() {
  const [binanceBind, setBinanceBind] = useState(null);
  const [kucoinBind, setKucoinBind] = useState(null);
  const [lbankBind, setLbankBind] = useState(null);
  const [hyperliquidBind, setHyperliquidBind] = useState(null);
  const [ipModal, setIpModal] = useState(null); // exchange whose IP popup is open
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/binance/bind").then(({ data }) => setBinanceBind(data)).catch(() => {});
    api.get("/kucoin/bind").then(({ data }) => setKucoinBind(data)).catch(() => {});
    api.get("/lbank/bind").then(({ data }) => setLbankBind(data)).catch(() => {});
    api.get("/hyperliquid/bind").then(({ data }) => setHyperliquidBind(data)).catch(() => {});
  }, []);

  const bindOf = (id) => (id === "kucoin" ? kucoinBind : id === "lbank" ? lbankBind : id === "hyperliquid" ? hyperliquidBind : binanceBind);
  // Account me jo exchange add hai (demo ya real) — one exchange per account
  const activeId = kucoinBind?.api_key_mask ? "kucoin" : lbankBind?.api_key_mask ? "lbank" : hyperliquidBind?.api_key_mask ? "hyperliquid" : binanceBind?.api_key_mask ? "binance" : null;
  const connectedId = kucoinBind?.bound ? "kucoin" : lbankBind?.bound ? "lbank" : hyperliquidBind?.bound ? "hyperliquid" : binanceBind?.bound ? "binance" : null;
  const isConnected = !!connectedId;
  const connected = EXCHANGES.find((e) => e.id === connectedId) || EXCHANGES[0];
  const others = isConnected ? EXCHANGES.filter((e) => e.id !== connectedId) : EXCHANGES;
  const connBind = bindOf(connectedId);
  const isLive = isConnected && (connBind?.mode === "real" || connBind?.mode === "testnet");
  const bind = binanceBind; // used by IP modal fallback

  return (
    <div className="pb-24" data-testid="exchange-list-page">
      {/* Sticky top: header + connected exchange card (scroll par fixed) */}
      <div className="sticky top-0 z-20 pt-3 pb-2 px-4" style={{ background: "var(--bg-base)" }}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <button onClick={() => navigate(-1)} className="p-1 justify-self-start" style={{ color: "var(--ink)" }} data-testid="exchange-back">
            <ArrowLeft size={24} strokeWidth={2.4} />
          </button>
          <div className="text-center">
            <div className="font-display font-black text-[17px] leading-tight whitespace-nowrap" style={{ color: "var(--ink)" }}>Api Binding Exchange</div>
            <div className="text-[11px]" style={{ color: "var(--text-mute)" }}>Top 25 · API supported only</div>
          </div>
          <div className="justify-self-end">
            <button
              onClick={() => navigate("/bot")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", color: "var(--ink)" }}
              data-testid="exchange-guide-btn"
            >
              <BookOpen size={14} style={{ color: "var(--ink)" }} /> Guide
            </button>
          </div>
        </div>

        {/* Connected exchange — sirf tab dikhe jab user ne API bind kiya ho */}
        {isConnected && (
        <div className="relative mt-5">
          <span
            className="absolute -top-3 left-3 z-10 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide text-white"
            style={{ background: "#16A34A" }}
          >
            Connected Exchange
          </span>
          <button
            onClick={() => navigate(`/bind-api/${connected.id}`)}
            className="w-full rounded-2xl px-4 pt-5 pb-3 text-left transition active:scale-[0.995]"
            style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", boxShadow: "0 2px 12px rgba(22,163,74,0.10)" }}
            data-testid="connected-exchange-card"
          >
            <div className="flex items-center gap-3">
              <Logo ex={connected} s={44} ts="text-[14px]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[17px] font-black leading-tight" style={{ color: "var(--ink)" }}>{connected.name}</span>
                  <BadgeCheck size={17} fill="#16A34A" color="#F0FDF4" className="shrink-0" />
                </div>
                <div className="text-[11.5px] mt-0.5" style={{ color: "var(--text-mute)" }}>{connected.tag}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full" style={{ background: "#16A34A" }} />
                <span className="text-[15px] font-black" style={{ color: "#16A34A" }} data-testid="connected-status">
                  Active
                </span>
                <ChevronRight size={18} style={{ color: "var(--ink)" }} />
              </div>
            </div>

            <div className="grid grid-cols-3 mt-3 pt-2.5" style={{ borderTop: "1px solid #BBF7D0" }}>
              {[
                { Icon: KeyRound, t: "API Connected", d: "Read / Trade Enabled" },
                { Icon: ShieldCheck, t: "Secure & Safe", d: "Your API is encrypted" },
                { Icon: BarChart3, t: "Real-Time Data", d: "Live market access" },
              ].map(({ Icon, t, d }, idx) => (
                <div key={t} className="flex items-start gap-1.5 px-1.5" style={idx > 0 ? { borderLeft: "1px solid #BBF7D0" } : {}}>
                  <Icon size={15} className="shrink-0 mt-0.5" style={{ color: "#16A34A" }} />
                  <div className="min-w-0">
                    <div className="text-[10px] font-black leading-tight" style={{ color: "var(--ink)" }}>{t}</div>
                    <div className="text-[8.5px] leading-tight mt-0.5" style={{ color: "var(--text-mute)" }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </button>
        </div>
        )}

        {/* Other exchanges heading */}
        <div className="mt-4 flex items-end justify-between">
          <div className="font-display font-black text-xl leading-tight" style={{ color: "var(--ink)" }}>
            {isConnected ? "Other Exchanges" : "All Exchanges"}
          </div>
          <div className="text-[11px] font-semibold" style={{ color: "var(--text-mute)" }}>Top 25 · API supported only</div>
        </div>
      </div>

      {/* Scrollable list — sirf ye scroll hota hai */}
      <div className="px-4 mt-1 space-y-1.5">
        {others.map((ex, i) => {
          const supported = SUPPORTED.has(ex.id);
          return (
          <button
            key={ex.id}
            onClick={() => {
              if (!supported) { setIpModal(ex); return; }
              if (activeId && ex.id !== activeId) {
                const activeName = EXCHANGES.find((e) => e.id === activeId)?.name || "exchange";
                toast.error(`Please disconnect ${activeName} first to add a new exchange`);
                return;
              }
              navigate(`/bind-api/${ex.id}`);
            }}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition active:scale-[0.995]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
            data-testid={`exchange-row-${ex.id}`}
          >
            <span className="w-5 text-[12px] font-black tabular-nums text-center shrink-0" style={{ color: "var(--text-mute)" }}>
              {i + 1}
            </span>
            <Logo ex={ex} />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-black truncate leading-tight" style={{ color: "var(--ink)" }}>{ex.name}</div>
              <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-mute)" }}>{ex.tag}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={ex.id === activeId
                  ? { background: "rgba(22,163,74,0.12)", color: "#16A34A" }
                  : supported
                    ? { background: "rgba(37,99,235,0.1)", color: "#2563EB" }
                    : { background: "var(--surface-3)", color: "var(--text-mute)" }}>
                {ex.id === activeId ? "Active" : supported ? "Live" : "Soon"}
              </span>
              <ChevronRight size={16} style={{ color: "var(--ink)" }} />
            </div>
          </button>
          );
        })}
      </div>

      {/* Whitelist IP popup for other exchanges */}
      {ipModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6" onClick={() => setIpModal(null)} data-testid="exchange-ip-modal">
          <div className="w-full max-w-xs rounded-2xl p-5 text-center" style={{ background: "var(--surface)", border: "1.5px solid rgba(37,99,235,0.35)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2"><Logo ex={ipModal} s={48} ts="text-[16px]" /></div>
            <div className="font-display font-black text-[17px]" style={{ color: "var(--ink)" }}>{ipModal.name}</div>
            <div className="text-[11px] font-semibold mt-1" style={{ color: "var(--text-mute)" }}>
              Integration Coming Soon 🚀 — Binance is supported for now.
            </div>
            <div className="rounded-xl px-3 py-2.5 mt-3" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
              <div className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>API Whitelist IP</div>
              <div className="font-mono font-black text-[16px] tabular-nums mt-0.5" style={{ color: "#2563EB" }} data-testid="exchange-ip-value">
                {bind?.whitelist_ip || "—"}
              </div>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(bind?.whitelist_ip || ""); toast.success("IP copied!"); }}
              className="w-full rounded-xl py-2.5 mt-2.5 text-white font-display font-black text-[13px]"
              style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)", touchAction: "manipulation" }}
              data-testid="exchange-ip-copy"
            >
              Copy IP
            </button>
            <button onClick={() => setIpModal(null)} className="w-full rounded-xl py-2.5 mt-1.5 font-display font-black text-[13px]"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--ink)", touchAction: "manipulation" }}
              data-testid="exchange-ip-close">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
