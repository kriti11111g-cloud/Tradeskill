import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpToLine, ArrowRightLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtNum, fmtTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const actions = [
  { type: "deposit", label: "Deposit", icon: ArrowDownToLine, color: "#39FF14", testid: "wallet-deposit" },
  { type: "withdraw", label: "Withdraw", icon: ArrowUpToLine, color: "#FF007A", testid: "wallet-withdraw" },
  { type: "transfer", label: "Transfer", icon: ArrowRightLeft, color: "#FFD700", testid: "wallet-transfer" },
];

export default function Wallet() {
  const { refresh } = useAuth();
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState("");

  const load = async () => {
    const [s, h] = await Promise.all([
      api.get("/wallet/summary").then((r) => r.data),
      api.get("/wallet/history").then((r) => r.data),
    ]);
    setSummary(s);
    setHistory(h);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/wallet/transaction", { type: modal, amount: parseFloat(amount), asset: "USDT" });
      toast.success(`${modal} · ${fmtUSD(amount)} processed`);
      setModal(null);
      setAmount("");
      load();
      refresh();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="pb-4">
      <PageHeader title="Assets" subtitle="Wallet · Portfolio" />

      {/* Balance card */}
      <div className="px-4">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 p-6"
          style={{
            background: "linear-gradient(135deg, rgba(0,240,255,0.12), rgba(255,215,0,0.08)), #0F1524",
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#8B9BB4] font-bold">Total Assets (USDT)</div>
          <div className="font-display font-black text-4xl tabular-nums mt-2" data-testid="wallet-total">
            {fmtNum(summary?.total_usdt || 0, 2)}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold">Available USDT</div>
              <div className="font-display font-bold text-lg tabular-nums mt-0.5">
                {fmtNum(summary?.wallet_usdt || 0, 2)}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#8B9BB4] font-bold">In Positions</div>
              <div className="font-display font-bold text-lg tabular-nums mt-0.5 text-[#00F0FF]">
                {fmtNum(summary?.positions_value_usdt || 0, 2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-3 px-4 mt-4">
        {actions.map((a) => (
          <button
            key={a.type}
            onClick={() => setModal(a.type)}
            data-testid={a.testid}
            className="flex flex-col items-center gap-2 py-4 bg-[#0F1524]/60 backdrop-blur-xl border border-white/5 rounded-2xl hover:border-[#00F0FF]/30 transition"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: `${a.color}15`, boxShadow: `inset 0 0 20px ${a.color}22` }}
            >
              <a.icon size={20} strokeWidth={1.8} style={{ color: a.color }} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Positions */}
      {summary?.positions?.length > 0 && (
        <div className="px-4 mt-5">
          <div className="font-display font-bold text-lg mb-3">Open Positions</div>
          <div className="space-y-2">
            {summary.positions.map((p) => (
              <div
                key={p.symbol}
                className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-3 flex items-center justify-between"
                data-testid={`position-${p.symbol}`}
              >
                <div>
                  <div className="font-display font-bold text-sm">{p.symbol.replace("USDT", "/USDT")}</div>
                  <div className="text-[10px] text-[#8B9BB4] mt-0.5 tabular-nums">
                    {fmtNum(p.qty, 6)} @ {fmtNum(p.avg_price, 4)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold tabular-nums text-sm">{fmtUSD(p.value)}</div>
                  <div className={`text-[11px] tabular-nums ${p.pnl >= 0 ? "text-[#39FF14]" : "text-[#FF007A]"}`}>
                    {p.pnl >= 0 ? "+" : ""}
                    {fmtUSD(p.pnl)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="px-4 mt-5">
        <div className="font-display font-bold text-lg mb-3">History</div>
        {history.length === 0 && (
          <div className="text-center text-sm text-[#8B9BB4] py-8" data-testid="empty-history">
            No wallet activity yet
          </div>
        )}
        <div className="space-y-2">
          {history.map((h) => (
            <div
              key={h.id}
              className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-display font-bold text-sm capitalize">{h.type}</div>
                <div className="text-[10px] text-[#8B9BB4] mt-0.5">{fmtTime(h.created_at)}</div>
              </div>
              <div className="text-right">
                <div
                  className={`font-display font-bold text-sm tabular-nums ${
                    h.type === "deposit" ? "text-[#39FF14]" : h.type === "withdraw" ? "text-[#FF007A]" : "text-white"
                  }`}
                >
                  {h.type === "withdraw" ? "-" : "+"}
                  {fmtUSD(h.amount)}
                </div>
                <div className="text-[10px] text-[#8B9BB4]">Bal {fmtUSD(h.balance_after)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md bg-[#0F1524] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display font-bold text-xl capitalize mb-4">{modal}</div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] font-bold">Amount (USDT)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1.5 bg-[#050914] border border-white/10 rounded-xl px-4 py-3 font-display font-bold text-xl tabular-nums focus:outline-none focus:border-[#00F0FF]"
                  data-testid="wallet-amount-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-3 rounded-xl bg-[#00F0FF] text-[#050914] font-display font-bold"
                  data-testid="wallet-submit"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
