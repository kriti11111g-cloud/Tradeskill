import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft, Headphones, Settings, BarChart3, Info, Globe, Copy,
  KeyRound, Lock, Eye, EyeOff, AlertTriangle, ShieldCheck, Trash2, Save, Search,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";

const EX = {
  binance: {
    name: "Binance",
    path: "/binance/bind",
    others: [{ id: "kucoin", path: "/kucoin/bind", name: "KuCoin" }, { id: "lbank", path: "/lbank/bind", name: "LBank" }],
    needsPassphrase: false,
    modes: [
      { id: "demo", label: "Demo", desc: "Simulated" },
      { id: "testnet", label: "Testnet", desc: "Binance Testnet" },
      { id: "real", label: "Real", desc: "Live Trading" },
    ],
    keyHint: "Generate keys in Binance → Account → API Management.",
  },
  kucoin: {
    name: "KuCoin",
    path: "/kucoin/bind",
    others: [{ id: "binance", path: "/binance/bind", name: "Binance" }, { id: "lbank", path: "/lbank/bind", name: "LBank" }],
    needsPassphrase: true,
    modes: [
      { id: "demo", label: "Demo", desc: "Simulated" },
      { id: "real", label: "Real", desc: "Live Trading" },
    ],
    keyHint: "Generate keys in KuCoin → API Management. Enable General + Spot Trading only. Set the API Passphrase you chose while creating the key.",
  },
  lbank: {
    name: "LBank",
    path: "/lbank/bind",
    others: [{ id: "binance", path: "/binance/bind", name: "Binance" }, { id: "kucoin", path: "/kucoin/bind", name: "KuCoin" }],
    needsPassphrase: false,
    modes: [
      { id: "demo", label: "Demo", desc: "Simulated" },
      { id: "real", label: "Real", desc: "Live Trading" },
    ],
    keyHint: "Generate keys in LBank → API Management. Choose HmacSHA256, enable Read + Spot Trading only (never withdrawals), and bind this server's IP.",
  },
};

const BLUE_GRAD = "linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)";

export default function BindAPI() {
  const params = useParams();
  const navigate = useNavigate();
  const exId = (params.exchange || "binance").toLowerCase();
  const cfg = EX[exId] || EX.binance;

  const { mode: themeMode } = useTheme();
  const dark = themeMode === "dark";
  const C = dark ? {
    card: "rgba(13,27,48,0.65)", cardBorder: "rgba(59,130,246,0.14)", inner: "rgba(6,14,26,0.8)",
    white: "#EAF2FF", mute: "#8CA3C0", blue: "#4F9BFF",
    headerBg: "rgba(6,14,26,0.6)", modeOff: "rgba(10,22,40,0.5)", modeOffBorder: "rgba(255,255,255,0.06)",
  } : {
    card: "rgba(255,255,255,0.97)", cardBorder: "rgba(37,99,235,0.1)", inner: "#F4F8FF",
    white: "#17304F", mute: "#6B7E99", blue: "#2563EB",
    headerBg: "rgba(255,255,255,0.8)", modeOff: "#F4F8FF", modeOffBorder: "rgba(15,35,64,0.06)",
  };
  const PAGE_BG = dark
    ? "radial-gradient(130% 80% at 50% 0%, #0E2A44 0%, #081322 55%, #060E1A 100%)"
    : "radial-gradient(130% 80% at 50% 0%, #EAF2FF 0%, #F5F9FF 55%, #FFFFFF 100%)";
  const cardStyle = {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    boxShadow: dark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(37,99,235,0.05)",
    backdropFilter: "blur(14px)",
  };

  const [existing, setExisting] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [mode, setMode] = useState("demo");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const load = () => api.get(cfg.path).then(({ data }) => setExisting(data)).catch(() => {});
  useEffect(() => {
    setExisting(null);
    setBlocked(null);
    load();
    cfg.others.forEach((o) => {
      api.get(o.path).then(({ data }) => { if (data?.api_key_mask) setBlocked(o.name); }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exId]);

  const doBind = async () => {
    setLoading(true);
    try {
      const payload = { api_key: apiKey, api_secret: apiSecret, mode };
      if (cfg.needsPassphrase) payload.passphrase = passphrase;
      await api.post(cfg.path, payload);
      toast.success(`${cfg.name} API bound successfully`);
      setApiKey(""); setApiSecret(""); setPassphrase("");
      setConfirmOpen(false); setAck(false);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (mode === "real") { setConfirmOpen(true); return; }
    await doBind();
  };

  const unbind = async () => {
    if (!window.confirm(`Remove ${cfg.name} API binding?`)) return;
    try {
      await api.delete(cfg.path);
      toast.success("API unbound");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const copyIp = () => {
    navigator.clipboard.writeText(existing?.whitelist_ip || "");
    toast.success("IP copied!");
  };

  return (
    <div className="min-h-screen pb-10" style={{ background: PAGE_BG, color: C.white }} data-testid={`bind-page-${exId}`}>
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-4 py-3.5 sticky top-0 z-20" style={{ background: C.headerBg, backdropFilter: "blur(10px)" }}>
        <button onClick={() => navigate(-1)} data-testid="bind-back" className="p-1 -ml-1">
          <ChevronLeft size={24} color={C.white} />
        </button>
        <div className="flex items-center gap-1.5">
          <BarChart3 size={22} color={C.blue} strokeWidth={2.6} />
          <span className="font-display font-black text-lg tracking-tight" style={{ color: C.white }}>
            Trade<span style={{ color: C.blue }}>Skill</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/guide")}><Headphones size={21} color={C.white} strokeWidth={2.2} /></button>
          <button onClick={() => navigate("/guide")}><Settings size={21} color={C.white} strokeWidth={2.2} /></button>
        </div>
      </div>

      <div className="px-4 space-y-4 pt-3">
        {/* ===== Blocked notice ===== */}
        {blocked && !existing?.api_key_mask && (
          <div className="rounded-2xl p-3.5 flex items-start gap-3" style={{ background: "rgba(220,38,38,0.12)", border: "1.5px solid rgba(248,113,113,0.45)" }} data-testid="bind-blocked-notice">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" color="#F87171" />
            <div className="text-[12px] leading-relaxed" style={{ color: C.white }}>
              <b>{blocked}</b> is already connected on this account. Only one exchange can be added per account — to add {cfg.name}, please disconnect <b>{blocked}</b> first.
            </div>
          </div>
        )}

        {/* ===== API Bound card ===== */}
        {existing?.api_key_mask && (
          <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{ ...cardStyle, border: "1px solid rgba(34,197,94,0.4)" }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(34,197,94,0.15)" }}>
              <ShieldCheck size={20} color="#22C55E" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm" style={{ color: C.white }}>API Bound</div>
              <div className="text-xs mt-0.5 font-mono" style={{ color: C.mute }}>
                {existing.api_key_mask} · <span className="uppercase">{existing.mode}</span>
              </div>
            </div>
            <button onClick={unbind} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)" }} data-testid="unbind-btn">
              <Trash2 size={16} color="#F87171" />
            </button>
          </div>
        )}

        {/* ===== Server IP card ===== */}
        <div className="rounded-3xl p-5" style={{ ...cardStyle, boxShadow: dark ? "0 0 18px rgba(37,99,235,0.1), 0 8px 24px rgba(0,0,0,0.28)" : "0 4px 18px rgba(37,99,235,0.07)" }} data-testid="whitelist-ip-card">
          <div className="flex items-start gap-3.5">
            <div className="rounded-2xl flex items-center justify-center text-white shrink-0" style={{ width: 46, height: 46, background: BLUE_GRAD, boxShadow: "0 0 12px rgba(59,130,246,0.3)" }}>
              <Globe size={21} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-[15.5px] leading-snug" style={{ color: C.white }}>Server IP — Whitelist This</div>
              <div className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: C.mute }}>
                Add this IP to your {cfg.name} API whitelist to allow secure access from TradeSkill.
              </div>
            </div>
            <button onClick={copyIp} className="flex items-center gap-1.5 px-3 py-2 rounded-xl shrink-0 font-semibold text-[12px]" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.35)", color: C.blue }} data-testid="whitelist-ip-copy">
              <Copy size={14} /> Copy
            </button>
          </div>
          <div className="flex items-center justify-between rounded-2xl px-4 py-3 mt-4" style={{ background: C.inner, border: "1px solid rgba(59,130,246,0.18)" }}>
            <span className="font-mono font-bold text-[19px] tabular-nums mx-auto tracking-wide" style={{ color: C.blue }} data-testid="whitelist-ip-value">
              {existing?.whitelist_ip || "—"}
            </span>
            <button onClick={copyIp}><Copy size={16} color={C.blue} /></button>
          </div>
        </div>

        {/* ===== Trading Mode ===== */}
        <div className="rounded-3xl p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} color={C.blue} strokeWidth={2.2} />
              <span className="font-display font-semibold text-[13px] uppercase tracking-[0.15em]" style={{ color: C.white }}>Trading Mode</span>
            </div>
            <Info size={17} color={C.mute} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {cfg.modes.map((m, idx) => {
              const sel = mode === m.id;
              const full = idx === cfg.modes.length - 1 && cfg.modes.length % 2 === 1;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  data-testid={`mode-${m.id}`}
                  className={`rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 transition-all ${full ? "col-span-2" : ""}`}
                  style={sel
                    ? { background: BLUE_GRAD, border: "1px solid rgba(127,180,255,0.6)", boxShadow: "0 0 14px rgba(59,130,246,0.25)" }
                    : { background: C.modeOff, border: `1px solid ${C.modeOffBorder}` }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: sel ? "rgba(255,255,255,0.16)" : (dark ? "rgba(255,255,255,0.05)" : "rgba(15,35,64,0.05)") }}>
                      <BarChart3 size={15} color={sel ? "#fff" : C.mute} strokeWidth={2.1} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-[13.5px] tracking-tight leading-none" style={{ color: sel ? "#fff" : C.white }}>{m.label.toUpperCase()}</div>
                      <div className="text-[8.5px] font-medium uppercase tracking-[0.1em] mt-1 leading-none" style={{ color: sel ? "rgba(255,255,255,0.8)" : C.mute }}>
                        {m.id === "real" ? "Live Trading" : m.id === "testnet" ? "Testnet" : "Simulated"}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 17, height: 17, border: `2px solid ${sel ? "#fff" : C.mute}` }}>
                    {sel && <span className="w-[7px] h-[7px] rounded-full bg-white" />}
                  </span>
                </button>
              );
            })}
          </div>

          {mode === "real" ? (
            <div className="rounded-2xl p-4 mt-4 flex items-start gap-3" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(248,113,113,0.4)" }}>
              <AlertTriangle size={20} color="#F87171" className="shrink-0 mt-0.5" />
              <div className="text-[11.5px] leading-relaxed" style={{ color: dark ? "#FCA5A5" : "#B91C1C" }}>
                <b className="font-semibold text-[#EF4444]">Real mode places live orders on {cfg.name} using your funds.</b> Enable only Read Info + Spot Trading, and whitelist this IP. This setting cannot be reversed.
              </div>
            </div>
          ) : mode === "testnet" ? (
            <div className="rounded-2xl p-4 mt-4 text-[11.5px] leading-relaxed" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: dark ? "#FCD34D" : "#B45309" }}>
              Testnet mode places REAL orders on Binance's Spot Testnet (fake funds). Get keys at testnet.binance.vision.
            </div>
          ) : (
            <div className="rounded-2xl p-4 mt-4 text-[11.5px] leading-relaxed" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", color: C.mute }}>
              Demo mode uses live market prices with a virtual balance. No real funds at risk. No {cfg.name} account required.
            </div>
          )}
        </div>

        {/* ===== API Credentials ===== */}
        <form onSubmit={save} className="rounded-3xl p-5 space-y-4" style={cardStyle}>
          <div className="flex items-center gap-3.5">
            <div className="rounded-2xl flex items-center justify-center text-white shrink-0" style={{ width: 46, height: 46, background: BLUE_GRAD, boxShadow: "0 0 12px rgba(59,130,246,0.3)" }}>
              <KeyRound size={21} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-semibold text-[15.5px]" style={{ color: C.white }}>API Credentials</div>
              <div className="text-[11.5px] mt-1 leading-relaxed" style={{ color: C.mute }}>
                Enter your {cfg.name} API key and secret to connect with TradeSkill.
              </div>
            </div>
          </div>

          {/* API KEY */}
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.16em] font-semibold" style={{ color: C.mute }}>API Key</label>
            <div className="relative mt-2">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" color={C.mute} />
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} required type={showKey ? "text" : "password"}
                placeholder={`Paste your ${cfg.name} API key`}
                className="w-full rounded-2xl pl-10 pr-10 py-3 font-mono text-[13px] outline-none transition-all"
                style={{ background: C.inner, border: "1px solid rgba(59,130,246,0.18)", color: C.white }}
                data-testid="input-apikey" />
              <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {showKey ? <EyeOff size={17} color={C.mute} /> : <Eye size={17} color={C.mute} />}
              </button>
            </div>
          </div>

          {/* API SECRET */}
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.16em] font-semibold" style={{ color: C.mute }}>API Secret</label>
            <div className="relative mt-2">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" color={C.mute} />
              <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} required type={showSecret ? "text" : "password"}
                placeholder={`Paste your ${cfg.name} secret`}
                className="w-full rounded-2xl pl-10 pr-10 py-3 font-mono text-[13px] outline-none transition-all"
                style={{ background: C.inner, border: "1px solid rgba(59,130,246,0.18)", color: C.white }}
                data-testid="input-secret" />
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {showSecret ? <EyeOff size={17} color={C.mute} /> : <Eye size={17} color={C.mute} />}
              </button>
            </div>
          </div>

          {/* PASSPHRASE (KuCoin) */}
          {cfg.needsPassphrase && (
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.16em] font-semibold" style={{ color: C.mute }}>API Passphrase</label>
              <div className="relative mt-2">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" color={C.mute} />
                <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} required type={showPass ? "text" : "password"}
                  placeholder="Passphrase set during key creation"
                  className="w-full rounded-2xl pl-10 pr-10 py-3 font-mono text-[13px] outline-none transition-all"
                  style={{ background: C.inner, border: "1px solid rgba(59,130,246,0.18)", color: C.white }}
                  data-testid="input-passphrase" />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  {showPass ? <EyeOff size={17} color={C.mute} /> : <Eye size={17} color={C.mute} />}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || !!blocked}
            className="w-full flex items-center justify-center gap-2 font-display font-semibold text-white rounded-2xl py-3.5 text-[14.5px] transition-all disabled:opacity-50"
            style={{ background: BLUE_GRAD, boxShadow: "0 0 16px rgba(59,130,246,0.32)" }}
            data-testid="bind-submit">
            <Save size={17} />
            {blocked ? `Disconnect ${blocked} first` : loading ? "Saving..." : "Save API Settings"}
          </button>

          <div className="text-[10.5px] leading-relaxed px-0.5" style={{ color: C.mute }}>
            <span className="font-semibold" style={{ color: C.white }}>Tip:</span> {cfg.keyHint} Enable only <span style={{ color: C.blue }}>Read Info + Spot Trading</span>. Never share your secret.
          </div>
        </form>
      </div>

      {/* ===== Confirm modal (Real) ===== */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 py-6"
          onClick={() => { if (!loading) { setConfirmOpen(false); setAck(false); } }} data-testid="confirm-modal">
          <div className="w-full max-w-md max-h-[88vh] rounded-3xl p-5 overflow-y-auto" style={{ ...cardStyle, border: "1px solid rgba(248,113,113,0.45)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(248,113,113,0.15)" }}>
                <AlertTriangle size={22} color="#F87171" />
              </div>
              <div>
                <div className="font-display font-black text-lg tracking-tight" style={{ color: C.white }}>Enable Live Trading?</div>
                <div className="text-xs mt-1" style={{ color: C.mute }}>This places real orders with real funds on {cfg.name}.</div>
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs cursor-pointer mb-3 rounded-xl p-3" style={{ background: C.modeOff, border: `1px solid ${C.modeOffBorder}`, color: C.white }}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="accent-[#F87171] w-4 h-4 mt-0.5" data-testid="confirm-ack" />
              <span>I understand the risks and want to enable live trading with my {cfg.name} funds.</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button type="button" onClick={() => { setConfirmOpen(false); setAck(false); }} disabled={loading}
                className="py-3 rounded-xl font-display font-bold text-sm disabled:opacity-60" style={{ background: C.modeOff, border: `1px solid ${C.modeOffBorder}`, color: C.white }} data-testid="confirm-cancel">
                Cancel
              </button>
              <button type="button" onClick={doBind} disabled={!ack || loading}
                className="py-3 rounded-xl text-white font-display font-bold text-sm disabled:opacity-40" style={{ background: "#DC2626" }} data-testid="confirm-proceed">
                {loading ? "Binding..." : "Enable Live"}
              </button>
            </div>
            <div className="text-[10px] uppercase tracking-widest font-black mb-2" style={{ color: C.mute }}>What you are agreeing to</div>
            <ul className="space-y-2 text-xs leading-relaxed" style={{ color: C.mute }}>
              <li>• Every Buy/Sell will hit your <span className="text-[#F87171] font-bold">live {cfg.name} account</span>.</li>
              <li>• Losses from market moves or misconfigured strategy are <span className="text-[#F87171] font-bold">irreversible</span>.</li>
              <li>• Enable only <span style={{ color: C.blue }}>Read Info + Spot Trading</span> permissions on your key.</li>
              <li>• Turn on <span style={{ color: C.blue }}>IP whitelist</span> for extra safety.</li>
              <li>• Trade Skill will never withdraw funds — that permission is not requested.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
