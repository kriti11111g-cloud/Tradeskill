import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
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
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { fmtUSD } from "@/lib/format";

const items = [
  { icon: Award, label: "Rank & Activation", to: "/rewards", testid: "profile-rank", tint: "var(--gold)" },
  { icon: WalletIcon, label: "Wallet", to: "/wallet", testid: "profile-assets", tint: "var(--primary)" },
  { icon: Key, label: "API Binding", to: "/bind-api", testid: "profile-api", tint: "var(--primary)" },
  { icon: ArrowRightLeft, label: "Transactions", to: "/transactions", testid: "profile-tx", tint: "var(--primary)" },
  { icon: Users, label: "Team", to: "/referral", testid: "profile-team", tint: "var(--gold)" },
  { icon: Gift, label: "Rewards", to: "/rewards", testid: "profile-rewards", tint: "var(--gold)" },
  { icon: Share2, label: "Share", to: "/referral", testid: "profile-share", tint: "var(--primary)" },
  { icon: LifeBuoy, label: "Support", to: "/guide", testid: "profile-support", tint: "var(--primary)" },
  { icon: Shield, label: "Security Center", to: "/bind-api", testid: "profile-sec", tint: "var(--gold)" },
  { icon: Settings, label: "System Setting", to: "/guide", testid: "profile-set", tint: "var(--primary)" },
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
        {/* User card */}
        <div
          className="backdrop-blur-xl rounded-3xl p-5 flex items-center gap-4"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-2xl text-white relative"
            style={{
              background: "var(--hero-grad)",
              boxShadow: "var(--shadow-md)",
              border: "1px solid var(--border)",
            }}
          >
            {(user?.name || user?.email || "?")[0]?.toUpperCase()}
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{
                background: "var(--gold-grad)",
                border: "2px solid var(--surface)",
                boxShadow: "0 0 8px var(--gold-glow)",
              }}
            >
              <span className="text-[8px] font-black text-white">★</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-display font-bold text-lg truncate"
              style={{ color: "var(--text)" }}
              data-testid="profile-name"
            >
              {user?.name || "Trader"}
            </div>
            <div className="text-xs truncate" style={{ color: "var(--text-mute)" }}>
              {user?.email}
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1.5">
              <span
                className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(245,158,11,0.14)",
                  color: "var(--gold)",
                  border: "1px solid rgba(245,158,11,0.32)",
                }}
              >
                {user?.rank || "Bronze"}
              </span>
              {user?.activated && (
                <span
                  className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(22,163,74,0.14)",
                    color: "var(--primary)",
                    border: "1px solid rgba(22,163,74,0.32)",
                  }}
                >
                  Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Wallet mini */}
        <div
          className="mt-3 backdrop-blur-xl rounded-2xl p-4 flex items-center justify-between"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div>
            <div
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{ color: "var(--text-mute)" }}
            >
              Wallet
            </div>
            <div
              className="font-display font-bold text-xl tabular-nums mt-0.5"
              style={{ color: "var(--text)" }}
            >
              {fmtUSD(user?.wallet_usdt || 0)}
            </div>
          </div>
          <Link
            to="/wallet"
            className="text-[10px] uppercase tracking-widest font-bold rounded-full px-3 py-1.5"
            style={{
              color: "var(--primary)",
              border: "1px solid var(--border)",
            }}
          >
            View →
          </Link>
        </div>

        {/* Theme toggle card */}
        <div
          className="mt-3 backdrop-blur-xl rounded-2xl p-4 flex items-center justify-between"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          data-testid="theme-setting"
        >
          <div>
            <div
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{ color: "var(--text-mute)" }}
            >
              Appearance
            </div>
            <div
              className="font-display font-bold text-base mt-0.5"
              style={{ color: "var(--text)" }}
            >
              Day / Night Mode
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Menu list */}
        <div
          className="mt-3 backdrop-blur-xl rounded-2xl overflow-hidden"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          {items.map((it, i) => (
            <Link
              key={it.label}
              to={it.to}
              data-testid={it.testid}
              className="flex items-center gap-3 px-4 py-3.5 transition"
              style={{
                borderBottom:
                  i < items.length - 1 ? "1px solid var(--border-soft)" : "none",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: `color-mix(in srgb, ${it.tint} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${it.tint} 28%, transparent)`,
                }}
              >
                <it.icon size={16} color={it.tint} strokeWidth={1.7} />
              </div>
              <div
                className="flex-1 font-body text-sm font-medium"
                style={{ color: "var(--text)" }}
              >
                {it.label}
              </div>
              <ChevronRight size={16} color="var(--text-mute)" />
            </Link>
          ))}
        </div>

        <button
          onClick={doLogout}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-display font-bold transition"
          style={{
            background: "rgba(248,113,113,0.10)",
            border: "1px solid rgba(248,113,113,0.35)",
            color: "var(--bad)",
          }}
          data-testid="logout-btn"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
}
