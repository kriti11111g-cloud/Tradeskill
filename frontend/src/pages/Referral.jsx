import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Share2, Users, Gift } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtUSD, fmtTime } from "@/lib/format";

export default function Referral() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/referral").then(({ data }) => setData(data));
  }, []);

  const copy = () => {
    if (!data?.referral_code) return;
    navigator.clipboard.writeText(data.referral_code);
    toast.success("Code copied!");
  };
  const share = () => {
    const url = `${window.location.origin}/register?ref=${data.referral_code}`;
    if (navigator.share) navigator.share({ title: "Join TGX BOT", url });
    else {
      navigator.clipboard.writeText(url);
      toast.success("Referral link copied!");
    }
  };

  return (
    <div className="pb-4">
      <PageHeader title="Referral" subtitle="Invite · Earn · Grow" showBack={false} />

      <div className="px-4">
        <div
          className="rounded-3xl border border-[color:var(--border)] p-6 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(248,113,113,0.10)), url('https://images.unsplash.com/photo-1669951584605-4deba095a87f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwxfHxnb2xkJTIwY29pbiUyMGNyeXB0byUyMHRva2VuJTIwZmxvYXRpbmclMjAzZHxlbnwwfHx8fDE3ODIwNzk5MjR8MA&ixlib=rb-4.1.0&q=85')",
            backgroundSize: "cover",
            backgroundBlendMode: "screen",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--surface)] via-transparent to-transparent" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--warn)] font-bold">Your Code</div>
            <div className="font-display font-black text-3xl tabular-nums mt-2 tracking-wider" data-testid="ref-code">
              {data?.referral_code || "----"}
            </div>
            <div className="text-xs text-white/70 mt-2">Earn 10% of your team&apos;s trading revenue.</div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={copy}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white text-white rounded-xl py-2.5 font-bold text-sm"
                data-testid="ref-copy"
              >
                <Copy size={14} /> Copy
              </button>
              <button
                onClick={share}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 border border-[color:var(--border)] rounded-xl py-2.5 font-bold text-sm"
                data-testid="ref-share"
              >
                <Share2 size={14} /> Share
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 mt-4">
        <div className="app-card rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[color:var(--primary)]" />
            <div className="text-[10px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">Team Size</div>
          </div>
          <div className="font-display font-bold text-2xl tabular-nums mt-1" data-testid="team-size">{data?.team_size || 0}</div>
        </div>
        <div className="app-card rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-[color:var(--warn)]" />
            <div className="text-[10px] uppercase tracking-widest text-[color:var(--text-mute)] font-bold">Earned</div>
          </div>
          <div className="font-display font-bold text-2xl tabular-nums mt-1 text-[color:var(--warn)]" data-testid="ref-earned">
            {fmtUSD(data?.total_earned || 0)}
          </div>
          {(data?.pending || 0) > 0 && (
            <div className="text-[10px] text-[color:var(--good)] font-bold mt-1" data-testid="ref-pending">
              +{fmtUSD(data.pending)} pending · claim in Rewards
            </div>
          )}
        </div>
      </div>

      {data?.earnings?.length > 0 && (
        <div className="px-4 mt-5">
          <div className="font-display font-bold text-lg mb-3">Commission Log</div>
          <div className="space-y-2" data-testid="commission-log">
            {data.earnings.slice(0, 10).map((e) => (
              <div
                key={e.id}
                className="app-card rounded-2xl p-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm truncate">
                    {e.symbol ? e.symbol.replace("USDT", "/USDT") : "Referral"}
                  </div>
                  <div className="text-[10px] text-[color:var(--text-mute)] mt-0.5 truncate">
                    {e.note || fmtTime(e.created_at)}
                  </div>
                </div>
                <div className="text-right pl-3">
                  <div className="font-display font-bold tabular-nums text-[color:var(--good)] text-sm">
                    +{fmtUSD(e.amount)}
                  </div>
                  <div className={`text-[9px] uppercase tracking-widest font-bold mt-0.5 ${
                    e.status === "claimed" ? "text-[color:var(--text-mute)]" : "text-[color:var(--primary)]"
                  }`}>
                    {e.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-5">
        <div className="font-display font-bold text-lg mb-3">Your Team</div>
        {data?.team?.length === 0 && (
          <div className="text-center text-sm text-[color:var(--text-mute)] py-8" data-testid="empty-team">
            Share your code to grow your team.
          </div>
        )}
        <div className="space-y-2">
          {data?.team?.map((t) => (
            <div
              key={t.email}
              className="app-card rounded-2xl p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-display font-bold text-sm">{t.name || t.email}</div>
                <div className="text-[10px] text-[color:var(--text-mute)] mt-0.5">Joined {fmtTime(t.created_at)}</div>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[color:var(--primary)] font-bold border border-[color:var(--primary)]/40 rounded-full px-2 py-1">
                {t.rank || "Bronze"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
