import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  User,
  Award,
  Wallet as WalletIcon,
  Key,
  ArrowRightLeft,
  Users,
  Gift,
  Share2,
  LifeBuoy,
  Shield,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { fmtUSD } from "@/lib/format";

const items = [
  { icon: Award, label: "Rank & Activation", to: "/rewards", testid: "profile-rank" },
  { icon: WalletIcon, label: "Assets", to: "/wallet", testid: "profile-assets" },
  { icon: Key, label: "API Binding", to: "/bind-api", testid: "profile-api" },
  { icon: ArrowRightLeft, label: "Transactions", to: "/transactions", testid: "profile-tx" },
  { icon: Users, label: "Team", to: "/referral", testid: "profile-team" },
  { icon: Gift, label: "Rewards", to: "/rewards", testid: "profile-rewards" },
  { icon: Share2, label: "Share", to: "/referral", testid: "profile-share" },
  { icon: LifeBuoy, label: "Support", to: "/guide", testid: "profile-support" },
  { icon: Shield, label: "Security Center", to: "/bind-api", testid: "profile-sec" },
  { icon: Settings, label: "System Setting", to: "/guide", testid: "profile-set" },
];

export default function Profile() {
  const { user, logout } = useAuth();

  const doLogout = async () => {
    await logout();
    toast.success("Logged out");
    window.location.href = "/login";
  };

  return (
    <div className="pb-4">
      <PageHeader title="Profile" subtitle="Account · Settings" showBack={false} />

      <div className="px-4">
        <div className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/25 rounded-3xl p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00F0FF] to-[#FF007A] flex items-center justify-center font-display font-black text-2xl">
            {(user?.name || user?.email || "?")[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-lg truncate" data-testid="profile-name">
              {user?.name || "Trader"}
            </div>
            <div className="text-xs text-[#8B9BB4] truncate">{user?.email}</div>
            <div className="mt-1.5 inline-flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30">
                {user?.rank || "Bronze"}
              </span>
              {user?.activated && (
                <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30">
                  Active
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#8B9BB4] font-bold">Wallet</div>
            <div className="font-display font-bold text-xl tabular-nums mt-0.5">
              {fmtUSD(user?.wallet_usdt || 0)}
            </div>
          </div>
          <Link
            to="/wallet"
            className="text-[10px] uppercase tracking-widest text-[#00F0FF] font-bold border border-[#00F0FF]/40 rounded-full px-3 py-1.5"
          >
            View →
          </Link>
        </div>

        <div className="mt-3 bg-[#0F1524]/60 backdrop-blur-xl border border-white/20 rounded-2xl divide-y divide-white/15">
          {items.map((it) => (
            <Link
              key={it.label}
              to={it.to}
              data-testid={it.testid}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition"
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/25 flex items-center justify-center">
                <it.icon size={16} className="text-[#00F0FF]" strokeWidth={1.7} />
              </div>
              <div className="flex-1 font-body text-sm font-medium">{it.label}</div>
              <ChevronRight size={16} className="text-[#8B9BB4]" />
            </Link>
          ))}
        </div>

        <button
          onClick={doLogout}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#FF007A]/10 border border-[#FF007A]/30 text-[#FF007A] font-display font-bold hover:bg-[#FF007A]/20 transition"
          data-testid="logout-btn"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
}
