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
          className="rounded-3xl border border-white/25 p-6 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,0,122,0.10)), url('https://images.unsplash.com/photo-1669951584605-4deba095a87f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwxfHxnb2xkJTIwY29pbiUyMGNyeXB0byUyMHRva2VuJTIwZmxvYXRpbmclMjAzZHxlbnwwfHx8fDE3ODIwNzk5MjR8MA&ixlib=rb-4.1.0&q=85')",
            backgroundSize: "cover",
            backgroundBlendMode: "screen",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1524] via-transparent to-transparent" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#FFD700] font-bold">Your Code</div>
            <div className="font-display font-black text-3xl tabular-nums mt-2 tracking-wider" data-testid="ref-code">
              {data?.referral_code || "----"}
            </div>
            <div className="text-xs text-white/70 mt-2">Earn 10% of your team&apos;s trading revenue.</div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={copy}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white text-[#050914] rounded-xl py-2.5 font-bold text-sm"
                data-testid="ref-copy"
              >
                <Copy size={14} /> Copy
              </button>
              <button
                onClick={share}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 border border-white/20 rounded-xl py-2.5 font-bold text-sm"
                data-testid="ref-share"
              >
                <Share2 size={14} /> Share
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 mt-4">
        <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#00F0FF]" />
            <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold">Team Size</div>
          </div>
          <div className="font-display font-bold text-2xl tabular-nums mt-1">{data?.team_size || 0}</div>
        </div>
        <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-[#FFD700]" />
            <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold">Earned</div>
          </div>
          <div className="font-display font-bold text-2xl tabular-nums mt-1 text-[#FFD700]">
            {fmtUSD(data?.total_earned || 0)}
          </div>
        </div>
      </div>

      <div className="px-4 mt-5">
        <div className="font-display font-bold text-lg mb-3">Your Team</div>
        {data?.team?.length === 0 && (
          <div className="text-center text-sm text-[#8B9BB4] py-8" data-testid="empty-team">
            Share your code to grow your team.
          </div>
        )}
        <div className="space-y-2">
          {data?.team?.map((t) => (
            <div
              key={t.email}
              className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-display font-bold text-sm">{t.name || t.email}</div>
                <div className="text-[10px] text-[#8B9BB4] mt-0.5">Joined {fmtTime(t.created_at)}</div>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#00F0FF] font-bold border border-[#00F0FF]/40 rounded-full px-2 py-1">
                {t.rank || "Bronze"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
