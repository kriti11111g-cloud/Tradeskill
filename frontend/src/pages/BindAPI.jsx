import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Trash2, AlertTriangle, Globe, Copy } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";

const EX = {
  binance: {
    name: "Binance",
    path: "/binance/bind",
    other: "kucoin",
    otherName: "KuCoin",
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
    other: "binance",
    otherName: "Binance",
    needsPassphrase: true,
    modes: [
      { id: "demo", label: "Demo", desc: "Simulated" },
      { id: "real", label: "Real", desc: "Live Trading" },
    ],
    keyHint: "Generate keys in KuCoin → API Management. Enable General + Spot Trading only. Set the API Passphrase you chose while creating the key.",
  },
};

export default function BindAPI() {
  const params = useParams();
  const exId = (params.exchange || "binance").toLowerCase();
  const cfg = EX[exId] || EX.binance;

  const [existing, setExisting] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [mode, setMode] = useState("demo");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [blocked, setBlocked] = useState(false); // other exchange already connected

  const load = () => api.get(cfg.path).then(({ data }) => setExisting(data)).catch(() => {});
  useEffect(() => {
    setExisting(null);
    setBlocked(false);
    load();
    // One exchange per account — check if the OTHER exchange is already connected
    const otherPath = `/${cfg.other}/bind`;
    api.get(otherPath).then(({ data }) => setBlocked(!!data?.api_key_mask)).catch(() => {});
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

  return (
    <div data-testid={`bind-page-${exId}`}>
      <PageHeader title={`Bind ${cfg.name} API`} subtitle="Connect · Trade · Automate" />

      <div className="px-4 space-y-4">
        {blocked && !existing?.api_key_mask && (
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "rgba(220,38,38,0.08)", border: "1.5px solid rgba(220,38,38,0.35)" }} data-testid="bind-blocked-notice">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: "var(--bad)" }} />
            <div className="text-[12px] leading-relaxed" style={{ color: "var(--ink)" }}>
              <b>{cfg.otherName}</b> already connected hai is account par. Ek account me sirf ek exchange add ho sakta hai —
              {" "}{cfg.name} add karne ke liye pehle <b>{cfg.otherName}</b> ko disconnect karo.
            </div>
          </div>
        )}
        {existing?.api_key_mask && (
          <div className="app-card !border-[color:var(--gold)]/30 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[color:var(--gold)]/10 flex items-center justify-center">
              <ShieldCheck size={20} className="text-[color:var(--gold)]" />
            </div>
            <div className="flex-1">
              <div className="font-display font-bold text-sm">API Bound</div>
              <div className="text-xs text-[color:var(--text-mute)] mt-0.5 font-mono">
                {existing.api_key_mask} · <span className="uppercase">{existing.mode}</span>
              </div>
            </div>
            <button onClick={unbind} className="w-9 h-9 rounded-xl bg-[color:var(--bad)]/10 border border-[color:var(--bad)]/30 flex items-center justify-center hover:bg-[color:var(--bad)]/20" data-testid="unbind-btn">
              <Trash2 size={16} className="text-[color:var(--bad)]" />
            </button>
          </div>
        )}

        {existing?.whitelist_ip && (
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "var(--lp-card-grad)", border: "1.5px solid var(--lp-border)" }} data-testid="whitelist-ip-card">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
              <Globe size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>Server IP — Whitelist This</div>
              <div className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-mute)" }}>
                {cfg.name} API settings me "Restrict access to trusted IPs" me ye IP add karo:
              </div>
              <div className="font-mono font-black text-[15px] mt-1.5 tabular-nums" style={{ color: "var(--lp-blue)" }} data-testid="whitelist-ip-value">
                {existing.whitelist_ip}
              </div>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(existing.whitelist_ip); toast.success("IP copied!"); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--surface-3)", border: "1px solid var(--lp-border)", touchAction: "manipulation" }} data-testid="whitelist-ip-copy">
              <Copy size={15} style={{ color: "var(--lp-blue)" }} />
            </button>
          </div>
        )}

        <div className="app-card rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-bold mb-3">Trading Mode</div>
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cfg.modes.length}, minmax(0, 1fr))` }}>
            {cfg.modes.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)} data-testid={`mode-${m.id}`}
                className={`py-3 px-2 rounded-xl font-display font-bold text-xs uppercase tracking-widest transition-all ${
                  mode === m.id
                    ? m.id === "demo" ? "bg-[color:var(--good)] text-white"
                      : m.id === "testnet" ? "bg-[color:var(--gold)] text-white"
                      : "bg-[color:var(--bad)] text-white glow-danger"
                    : "bg-[color:var(--text)]/5 text-[color:var(--text-mute)] border border-[color:var(--border)]"
                }`}>
                <div>{m.label}</div>
                <div className="text-[8px] font-normal opacity-70 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
          <div className="text-xs text-[color:var(--text-mute)] mt-3 leading-relaxed">
            {mode === "demo" && `Demo mode uses live market prices with a virtual balance. No real funds at risk. No ${cfg.name} account required.`}
            {mode === "testnet" && "Testnet mode places REAL orders on Binance's Spot Testnet (fake funds). Get keys at testnet.binance.vision."}
            {mode === "real" && `⚠️ Real mode places LIVE orders on ${cfg.name} with your funds. Enable only Read Info + Spot Trading. Use IP whitelist. Not reversible.`}
          </div>
        </div>

        <form onSubmit={save} className="app-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-[color:var(--gold-deep)]" />
            <div className="font-display font-bold text-sm">API Credentials</div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-bold">API Key</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
              placeholder={`Paste your ${cfg.name} API key`}
              className="w-full mt-1.5 bg-[color:var(--bg-base)] border border-[color:var(--border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[color:var(--primary)] transition-all placeholder:text-[color:var(--text-mute)] font-mono text-sm"
              data-testid="input-apikey" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-bold">API Secret</label>
            <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} required
              placeholder={`Paste your ${cfg.name} secret`}
              className="w-full mt-1.5 bg-[color:var(--bg-base)] border border-[color:var(--border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[color:var(--primary)] transition-all placeholder:text-[color:var(--text-mute)] font-mono text-sm"
              data-testid="input-secret" />
          </div>
          {cfg.needsPassphrase && (
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-bold">API Passphrase</label>
              <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} required
                placeholder="Passphrase set during key creation"
                className="w-full mt-1.5 bg-[color:var(--bg-base)] border border-[color:var(--border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[color:var(--primary)] transition-all placeholder:text-[color:var(--text-mute)] font-mono text-sm"
                data-testid="input-passphrase" />
            </div>
          )}
          <button type="submit" disabled={loading || blocked}
            className="w-full bg-[color:var(--primary)] text-white font-display font-bold rounded-xl py-3.5 hover:brightness-110 transition-all hover:glow-primary disabled:opacity-60"
            data-testid="bind-submit">
            {blocked ? `Disconnect ${cfg.otherName} first` : loading ? "Binding..." : mode === "real" ? "Bind API (Live Trading)" : "Bind API"}
          </button>
        </form>

        <div className="text-xs text-[color:var(--text-mute)] px-2 leading-relaxed">
          <span className="text-[color:var(--text)] font-bold">Tip:</span> {cfg.keyHint} Enable only{" "}
          <span className="text-[color:var(--primary)]">Read Info + Spot Trading</span>. Never share your secret.
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 py-6"
          onClick={() => { if (!loading) { setConfirmOpen(false); setAck(false); } }} data-testid="confirm-modal">
          <div className="w-full max-w-md max-h-[88vh] bg-[color:var(--surface)] border border-[color:var(--bad)]/40 rounded-3xl p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-[color:var(--bad)]/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} className="text-[color:var(--bad)]" />
              </div>
              <div>
                <div className="font-display font-black text-lg tracking-tight">Enable Live Trading?</div>
                <div className="text-xs text-[color:var(--text-mute)] mt-1">This places real orders with real funds on {cfg.name}.</div>
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs text-[color:var(--text-soft)] cursor-pointer mb-3 rounded-xl bg-[color:var(--text)]/5 border border-[color:var(--border-soft)] p-3">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="accent-[#F87171] w-4 h-4 mt-0.5" data-testid="confirm-ack" />
              <span>I understand the risks and want to enable live trading with my {cfg.name} funds.</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button type="button" onClick={() => { setConfirmOpen(false); setAck(false); }} disabled={loading}
                className="py-3 rounded-xl bg-[color:var(--surface-2)] border border-[color:var(--border)] font-display font-bold text-sm hover:bg-[color:var(--text)]/10 transition disabled:opacity-60" data-testid="confirm-cancel">
                Cancel
              </button>
              <button type="button" onClick={doBind} disabled={!ack || loading}
                className="py-3 rounded-xl bg-[color:var(--bad)] text-white font-display font-bold text-sm disabled:opacity-40 hover:brightness-110 transition" data-testid="confirm-proceed">
                {loading ? "Binding..." : "Enable Live"}
              </button>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[color:var(--text-mute)] font-black mb-2">What you are agreeing to</div>
            <ul className="space-y-2 text-xs text-[color:var(--text-soft)] leading-relaxed">
              <li>• Every Buy/Sell will hit your <span className="text-[color:var(--bad)] font-bold">live {cfg.name} account</span>.</li>
              <li>• Losses from market moves or misconfigured strategy are <span className="text-[color:var(--bad)] font-bold">irreversible</span>.</li>
              <li>• Enable only <span className="text-[color:var(--primary)]">Read Info + Spot Trading</span> permissions on your key.</li>
              <li>• Turn on <span className="text-[color:var(--primary)]">IP whitelist</span> for extra safety.</li>
              <li>• Trade Skill will never withdraw funds — that permission is not requested.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
