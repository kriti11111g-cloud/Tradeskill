import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";

export default function BindAPI() {
  const [existing, setExisting] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [mode, setMode] = useState("demo");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ack, setAck] = useState(false);

  const load = () => api.get("/binance/bind").then(({ data }) => setExisting(data));
  useEffect(() => {
    load();
  }, []);

  const doBind = async () => {
    setLoading(true);
    try {
      await api.post("/binance/bind", { api_key: apiKey, api_secret: apiSecret, mode });
      toast.success("API bound successfully");
      setApiKey("");
      setApiSecret("");
      setConfirmOpen(false);
      setAck(false);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (mode === "real") {
      setConfirmOpen(true);
      return;
    }
    await doBind();
  };

  const unbind = async () => {
    if (!window.confirm("Remove API binding?")) return;
    try {
      await api.delete("/binance/bind");
      toast.success("API unbound");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div>
      <PageHeader title="Bind Binance API" subtitle="Connect · Trade · Automate" />

      <div className="px-4 space-y-4">
        {existing?.api_key_mask && (
          <div className="bg-[color:var(--surface)]/60 backdrop-blur-xl border border-[color:var(--good)]/30 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[color:var(--good)]/10 flex items-center justify-center">
              <ShieldCheck size={20} className="text-[color:var(--good)]" />
            </div>
            <div className="flex-1">
              <div className="font-display font-bold text-sm">API Bound</div>
              <div className="text-xs text-[color:var(--text-mute)] mt-0.5 font-mono">
                {existing.api_key_mask} · <span className="uppercase">{existing.mode}</span>
              </div>
            </div>
            <button
              onClick={unbind}
              className="w-9 h-9 rounded-xl bg-[color:var(--bad)]/10 border border-[color:var(--bad)]/30 flex items-center justify-center hover:bg-[color:var(--bad)]/20"
              data-testid="unbind-btn"
            >
              <Trash2 size={16} className="text-[color:var(--bad)]" />
            </button>
          </div>
        )}

        <div className="bg-[color:var(--surface)]/60 backdrop-blur-xl border border-[color:var(--border)] rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-bold mb-3">Trading Mode</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "demo", label: "Demo", desc: "Simulated" },
              { id: "testnet", label: "Testnet", desc: "Binance Testnet" },
              { id: "real", label: "Real", desc: "Live Trading" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                data-testid={`mode-${m.id}`}
                className={`py-3 px-2 rounded-xl font-display font-bold text-xs uppercase tracking-widest transition-all ${
                  mode === m.id
                    ? m.id === "demo"
                      ? "bg-[color:var(--good)] text-white"
                      : m.id === "testnet"
                      ? "bg-[color:var(--gold)] text-white"
                      : "bg-[color:var(--bad)] text-white glow-danger"
                    : "bg-white/5 text-[color:var(--text-mute)] border border-[color:var(--border)]"
                }`}
              >
                <div>{m.label}</div>
                <div className="text-[8px] font-normal opacity-70 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
          <div className="text-xs text-[color:var(--text-mute)] mt-3 leading-relaxed">
            {mode === "demo" &&
              "Demo mode uses live Binance prices with a virtual $1,000 balance. No real funds at risk. No Binance account required."}
            {mode === "testnet" &&
              "Testnet mode places REAL orders on Binance's Spot Testnet (fake funds). Get keys at testnet.binance.vision. Perfect to test the strategy live risk-free."}
            {mode === "real" &&
              "⚠️ Real mode places LIVE orders on Binance with your funds. Enable only Read Info + Spot Trading. Use IP whitelist. Not reversible."}
          </div>
        </div>

        <form onSubmit={save} className="bg-[color:var(--surface)]/60 backdrop-blur-xl border border-[color:var(--border)] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-[color:var(--primary)]" />
            <div className="font-display font-bold text-sm">API Credentials</div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-bold">API Key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              placeholder="Paste your Binance API key"
              className="w-full mt-1.5 bg-[color:var(--bg-base)] border border-[color:var(--border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[color:var(--primary)] transition-all placeholder:text-[color:var(--text-mute)] font-mono text-sm"
              data-testid="input-apikey"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-bold">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              required
              placeholder="Paste your Binance secret"
              className="w-full mt-1.5 bg-[color:var(--bg-base)] border border-[color:var(--border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[color:var(--primary)] transition-all placeholder:text-[color:var(--text-mute)] font-mono text-sm"
              data-testid="input-secret"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[color:var(--primary)] text-white font-display font-bold rounded-xl py-3.5 hover:bg-white transition-all hover:glow-primary disabled:opacity-60"
            data-testid="bind-submit"
          >
            {loading ? "Binding..." : mode === "real" ? "Bind API (Live Trading)" : "Bind API"}
          </button>
        </form>

        <div className="text-xs text-[color:var(--text-mute)] px-2 leading-relaxed">
          <span className="text-white font-bold">Tip:</span> Generate keys in Binance → Account → API Management.
          Enable only <span className="text-[color:var(--primary)]">Read Info + Spot Trading</span>. Never share your secret.
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4"
          onClick={() => {
            if (!loading) {
              setConfirmOpen(false);
              setAck(false);
            }
          }}
          data-testid="confirm-modal"
        >
          <div
            className="w-full max-w-md max-h-[85vh] bg-[color:var(--surface)] border border-[color:var(--bad)]/40 rounded-3xl p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-[color:var(--bad)]/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} className="text-[color:var(--bad)]" />
              </div>
              <div>
                <div className="font-display font-black text-lg tracking-tight">Enable Live Trading?</div>
                <div className="text-xs text-[color:var(--text-mute)] mt-1">This action places real orders with real funds.</div>
              </div>
            </div>

            {/* Acknowledgment checkbox — pinned above the fold */}
            <label className="flex items-start gap-2 text-xs text-white/90 cursor-pointer mb-3 rounded-xl bg-white/[0.04] border border-[color:var(--border-soft)] p-3">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="accent-[#F87171] w-4 h-4 mt-0.5"
                data-testid="confirm-ack"
              />
              <span>I understand the risks and want to enable live trading with my Binance funds.</span>
            </label>

            {/* Primary action row — always visible without scrolling */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setAck(false);
                }}
                disabled={loading}
                className="py-3 rounded-xl bg-white/5 border border-[color:var(--border)] font-display font-bold text-sm hover:bg-white/10 transition disabled:opacity-60"
                data-testid="confirm-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doBind}
                disabled={!ack || loading}
                className="py-3 rounded-xl bg-[color:var(--bad)] text-white font-display font-bold text-sm disabled:opacity-40 hover:brightness-110 transition"
                data-testid="confirm-proceed"
              >
                {loading ? "Binding..." : "Enable Live"}
              </button>
            </div>

            <div className="text-[10px] uppercase tracking-widest text-[color:var(--text-mute)] font-black mb-2">
              What you are agreeing to
            </div>
            <ul className="space-y-2 text-xs text-white/80 leading-relaxed">
              <li>• Every Buy/Sell will hit your <span className="text-[color:var(--bad)] font-bold">live Binance account</span>.</li>
              <li>• Losses from market moves or misconfigured strategy are <span className="text-[color:var(--bad)] font-bold">irreversible</span>.</li>
              <li>• You are responsible for enabling only <span className="text-[color:var(--primary)]">Read Info + Spot Trading</span> permissions on your key.</li>
              <li>• Turn on <span className="text-[color:var(--primary)]">IP whitelist</span> in Binance for extra safety.</li>
              <li>• TGX BOT will never withdraw funds — that permission is not requested.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
