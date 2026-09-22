import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Mail,
  Calendar,
  User as UserIcon,
  MapPin,
  BadgeCheck,
  Crown,
  Wallet as WalletIcon,
  Shield,
  Settings,
  Headphones,
  Gift,
  LogOut,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

const GRAD = "linear-gradient(90deg, #2563EB, #10B981)";
const CARD = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
};

const fmtJoin = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rankInfo, setRankInfo] = useState(null);

  useEffect(() => {
    api.get("/ranks/me").then(({ data }) => setRankInfo(data)).catch(() => {});
  }, []);

  const doLogout = async () => {
    await logout();
    toast.success("Logged out");
    window.location.href = "/login";
  };

  const prog = rankInfo?.progress;
  const nextRank = rankInfo?.next_rank;
  const pct = prog
    ? Math.min(
        100,
        Math.round(
          ((Math.min(1, prog.direct_have / Math.max(1, prog.direct_needed)) +
            Math.min(1, prog.team_have / Math.max(1, prog.team_needed))) /
            2) * 100
        )
      )
    : 0;

  const tiles = [
    { icon: Shield, label: "Security Centre", to: "/bind-api", testid: "profile-security" },
    { icon: Settings, label: "System Setting", to: "/guide", testid: "profile-settings" },
    { icon: Headphones, label: "Support", to: "/guide", testid: "profile-support" },
    { icon: Gift, label: "Bonanza", to: "/rewards", testid: "profile-bonanza" },
  ];

  return (
    <div className="pb-6">
      <PageHeader title="Profile" subtitle="Account · Settings" showBack={false} right={<ThemeToggle />} />

      <div className="px-4 space-y-3">
        {/* ===== Identity card ===== */}
        <div className="rounded-2xl p-4 flex items-center gap-3.5" style={CARD} data-testid="profile-identity-card">
          <div className="relative shrink-0">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-display font-black text-2xl text-white"
              style={{ background: GRAD, boxShadow: "0 2px 10px rgba(37,99,235,0.35)" }}
            >
              {(user?.name || user?.email || "?")[0]?.toUpperCase()}
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "#16A34A", border: "2px solid var(--surface)" }}
            >
              <Pencil size={9} color="#fff" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-display font-black text-lg truncate" style={{ color: "var(--ink)" }} data-testid="profile-name">
                {user?.name || "Trader"}
              </span>
              <BadgeCheck size={17} fill="#2563EB" color="var(--surface)" className="shrink-0" />
            </div>
            <div className="space-y-1 mt-1">
              <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text)" }}>
                <Mail size={12} style={{ color: "var(--ink)" }} />
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text)" }}>
                <Calendar size={12} style={{ color: "var(--ink)" }} />
                Joined on {fmtJoin(user?.created_at)}
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text)" }}>
                <UserIcon size={12} style={{ color: "var(--ink)" }} />
                UID: <span className="font-black" data-testid="profile-uid">{user?.uid || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text)" }}>
                <MapPin size={12} style={{ color: "var(--ink)" }} />
                <span>🇮🇳 Country: {user?.country || "India"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center shrink-0 pl-1">
            <ShieldCheck size={54} strokeWidth={1.6} style={{ color: "#16A34A" }} />
            <div className="text-[10px] font-black tracking-wider mt-1" style={{ color: "var(--ink)" }}>
              TRADE SKILL
            </div>
            <div className="h-[3px] w-10 rounded-full mt-1" style={{ background: GRAD }} />
          </div>
        </div>

        {/* ===== Current rank ===== */}
        <div className="rounded-2xl p-4 flex items-center gap-3.5" style={CARD} data-testid="profile-current-rank">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "#DCFCE7" }}>
            <Crown size={22} style={{ color: "#16A34A" }} />
          </div>
          <div>
            <div className="text-[11px] font-semibold" style={{ color: "var(--text-mute)" }}>CURRENT RANK</div>
            <div className="font-display font-black text-2xl leading-tight uppercase" style={{ color: "var(--ink)" }}>
              {rankInfo?.current_title || user?.rank || "Level 1"}
            </div>
          </div>
        </div>

        {/* ===== Next rank ===== */}
        {nextRank && (
          <div className="rounded-2xl p-4" style={CARD} data-testid="profile-next-rank">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--surface-3)" }}>
                <Crown size={22} style={{ color: "var(--ink)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold" style={{ color: "var(--text-mute)" }}>NEXT RANK</div>
                <div className="font-display font-black text-2xl leading-tight uppercase" style={{ color: "var(--ink)" }}>
                  {nextRank.title}
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-full text-[11px] font-black shrink-0" style={{ background: "#DBEAFE", color: "#2563EB" }}>
                Coming Soon
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GRAD }} />
              </div>
              <span className="text-[13px] font-black tabular-nums" style={{ color: "var(--ink)" }}>{pct}%</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[12px] font-semibold" style={{ color: "var(--text)" }}>
              <span>Directs: <b>{prog?.direct_have ?? 0} / {prog?.direct_needed ?? 0}</b></span>
              <span>Team: <b>{prog?.team_have ?? 0} / {prog?.team_needed ?? 0}</b></span>
            </div>
          </div>
        )}

        {/* ===== Wallet balance ===== */}
        <div className="rounded-2xl p-4 flex items-center gap-3.5" style={CARD} data-testid="profile-wallet-card">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--surface-3)" }}>
            <WalletIcon size={22} style={{ color: "var(--ink)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold" style={{ color: "var(--text-mute)" }}>WALLET BALANCE</div>
            <div className="font-display font-black text-xl leading-tight tabular-nums" style={{ color: "var(--ink)" }}>
              ${(user?.wallet_usdt || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <button
            onClick={() => navigate("/wallet")}
            className="px-4 py-2.5 rounded-full text-[12.5px] font-black text-white shrink-0"
            style={{ background: GRAD }}
            data-testid="profile-view-wallet"
          >
            View Wallet →
          </button>
        </div>

        {/* ===== 4 tiles ===== */}
        <div className="grid grid-cols-4 gap-2.5">
          {tiles.map((t) => (
            <Link
              key={t.label}
              to={t.to}
              data-testid={t.testid}
              className="rounded-2xl flex flex-col items-center justify-center gap-2 py-4 px-1"
              style={CARD}
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--surface-3)" }}>
                <t.icon size={20} strokeWidth={2} style={{ color: "var(--ink)" }} />
              </div>
              <span className="text-[10px] font-bold text-center leading-tight" style={{ color: "var(--ink)" }}>
                {t.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Admin */}
        {user?.role === "admin" && (
          <Link
            to="/admin/withdrawals"
            className="rounded-2xl p-4 flex items-center gap-3" style={CARD}
            data-testid="profile-admin-withdrawals"
          >
            <Shield size={18} style={{ color: "var(--ink)" }} />
            <span className="text-sm font-black" style={{ color: "var(--ink)" }}>Withdrawals Admin</span>
          </Link>
        )}

        <button
          onClick={doLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-display font-bold transition"
          style={{ background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.35)", color: "var(--bad)" }}
          data-testid="logout-btn"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
}
