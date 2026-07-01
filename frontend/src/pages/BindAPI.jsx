import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";

export default function BindAPI() {
  const [existing, setExisting] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [mode, setMode] = useState("demo");
  const [loading, setLoading] = useState(false);

  const load = () => api.get("/binance/bind").then(({ data }) => setExisting(data));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/binance/bind", { api_key: apiKey, api_secret: apiSecret, mode });
      toast.success("API bound successfully");
      setApiKey("");
      setApiSecret("");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
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
          <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-[#39FF14]/30 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 flex items-center justify-center">
              <ShieldCheck size={20} className="text-[#39FF14]" />
            </div>
            <div className="flex-1">
              <div className="font-display font-bold text-sm">API Bound</div>
              <div className="text-xs text-[#8B9BB4] mt-0.5 font-mono">
                {existing.api_key_mask} · <span className="uppercase">{existing.mode}</span>
              </div>
            </div>
            <button
              onClick={unbind}
              className="w-9 h-9 rounded-xl bg-[#FF007A]/10 border border-[#FF007A]/30 flex items-center justify-center hover:bg-[#FF007A]/20"
              data-testid="unbind-btn"
            >
              <Trash2 size={16} className="text-[#FF007A]" />
            </button>
          </div>
        )}

        <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold mb-3">Trading Mode</div>
          <div className="grid grid-cols-2 gap-2">
            {["demo", "real"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                data-testid={`mode-${m}`}
                className={`py-3 rounded-xl font-display font-bold text-sm uppercase tracking-widest transition-all ${
                  mode === m
                    ? m === "demo"
                      ? "bg-[#39FF14] text-[#050914] glow-cyan"
                      : "bg-[#FF007A] text-white glow-magenta"
                    : "bg-white/5 text-[#8B9BB4] border border-white/10"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="text-xs text-[#8B9BB4] mt-3 leading-relaxed">
            {mode === "demo"
              ? "Demo mode uses live Binance prices with a virtual $1,000 balance. No real funds at risk."
              : "Real mode places live orders on Binance. Only enable TRADE permission; keep IP whitelist ON."}
          </div>
        </div>

        <form onSubmit={save} className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-[#00F0FF]" />
            <div className="font-display font-bold text-sm">API Credentials</div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold">API Key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              placeholder="Paste your Binance API key"
              className="w-full mt-1.5 bg-[#050914] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#00F0FF] transition-all placeholder:text-[#8B9BB4] font-mono text-sm"
              data-testid="input-apikey"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              required
              placeholder="Paste your Binance secret"
              className="w-full mt-1.5 bg-[#050914] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#00F0FF] transition-all placeholder:text-[#8B9BB4] font-mono text-sm"
              data-testid="input-secret"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00F0FF] text-[#050914] font-display font-bold rounded-xl py-3.5 hover:bg-white transition-all hover:glow-cyan disabled:opacity-60"
            data-testid="bind-submit"
          >
            {loading ? "Binding..." : "Bind API"}
          </button>
        </form>

        <div className="text-xs text-[#8B9BB4] px-2 leading-relaxed">
          <span className="text-white font-bold">Tip:</span> Generate keys in Binance → Account → API Management.
          Enable only <span className="text-[#00F0FF]">Read Info + Spot Trading</span>. Never share your secret.
        </div>
      </div>
    </div>
  );
}
