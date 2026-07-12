import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gift, Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

export default function Rewards() {
  const { refresh } = useAuth();
  const [rows, setRows] = useState([]);
  const load = () => api.get("/rewards").then(({ data }) => setRows(data));
  useEffect(() => {
    load();
  }, []);

  const claim = async (id) => {
    try {
      const { data } = await api.post(`/rewards/${id}/claim`);
      toast.success(`Claimed ${fmtUSD(data.claimed_amount)}!`);
      load();
      refresh();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="pb-4">
      <PageHeader title="Rewards" subtitle="Bonuses & Airdrops" />

      <div className="px-4">
        <div
          className="rounded-3xl border border-[color:var(--border)] p-5 flex items-center gap-4 text-white"
          style={{
            background: "var(--hero-grad)",
          }}
        >
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--gold)]/15 flex items-center justify-center">
            <Sparkles size={26} className="text-[color:var(--warn)]" />
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-base">Welcome to Rewards</div>
            <div className="text-xs text-white/70 mt-0.5">
              Claim joining, trading & referral bonuses here.
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-5">
        <div className="font-display font-bold text-lg mb-3">Available</div>
        {rows.length === 0 && (
          <div className="text-center text-sm text-[color:var(--text-mute)] py-8" data-testid="empty-rewards">
            No rewards yet.
          </div>
        )}
        <div className="space-y-2" data-testid="rewards-list">
          {rows.map((r) => (
            <div
              key={r.id}
              className="app-card rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-xl bg-[color:var(--primary)]/10 flex items-center justify-center">
                <Gift size={20} className="text-[color:var(--gold)]" />
              </div>
              <div className="flex-1">
                <div className="font-display font-bold text-sm capitalize">{r.type} Reward</div>
                <div className="text-[11px] text-[color:var(--text-mute)] mt-0.5">{r.note || fmtTime(r.created_at)}</div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold tabular-nums text-[color:var(--good)]">+{fmtUSD(r.amount)}</div>
                {r.status === "claimable" ? (
                  <button
                    onClick={() => claim(r.id)}
                    className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white bg-[color:var(--primary)] px-3 py-1 rounded-full"
                    data-testid={`claim-${r.id}`}
                  >
                    Claim
                  </button>
                ) : (
                  <div className="text-[10px] uppercase tracking-widest text-[color:var(--text-mute)] mt-1">
                    {r.status}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
