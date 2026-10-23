import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  Headphones,
  Settings,
  Mail,
  Calendar,
  User as UserIcon,
  MapPin,
  BadgeCheck,
  Camera,
  Copy,
  ChevronRight,
  Trophy,
  Gift,
  ShieldCheck,
  HelpCircle,
  Cog,
  Facebook,
  Instagram,
  Youtube,
  Send,
  LogOut,
  Shield,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { TS_LOGO } from "@/pages/Login";

const BLUE_GRAD = "linear-gradient(135deg, #2563EB 0%, #1E88E5 45%, #10B981 100%)";
const CARD = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
};

const fmtJoin = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function SocialCluster() {
  return (
    <div className="grid grid-cols-2 gap-1 w-8 shrink-0">
      <Facebook size={14} color="#1877F2" fill="#1877F2" strokeWidth={0} />
      <Send size={14} color="#229ED9" fill="#229ED9" strokeWidth={0} />
      <Youtube size={15} color="#FF0000" fill="#FF0000" strokeWidth={0} />
      <Instagram size={14} color="#E1306C" strokeWidth={2.4} />
    </div>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const avatarKey = `ts_avatar_${user?.uid || user?.id || "me"}`;
  const [avatar, setAvatar] = useState(() => localStorage.getItem(avatarKey) || "");

  const doLogout = async () => {
    await logout();
    toast.success("Logged out");
    window.location.href = "/login";
  };

  const copyUID = () => {
    navigator.clipboard?.writeText(user?.uid || "").then(
      () => toast.success("UID copied"),
      () => toast.error("Copy failed")
    );
  };

  const pickAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return toast.error("Image must be under 3MB");
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      setAvatar(url);
      try {
        localStorage.setItem(avatarKey, url);
      } catch {
        toast.error("Could not save photo");
      }
      toast.success("Profile photo updated");
    };
    reader.readAsDataURL(f);
  };

  const items = [
    { icon: <Trophy size={26} color="#2563EB" strokeWidth={2.2} />, label: "Current Rank", to: "/rank", testid: "profile-rank" },
    { icon: <Gift size={26} color="#2563EB" fill="#DBEAFE" strokeWidth={2} />, label: "Referral", to: "/referral", testid: "profile-referral" },
    { icon: <ShieldCheck size={26} color="#16A34A" fill="#16A34A" strokeWidth={1.6} className="[&>path:last-child]:stroke-white" />, label: "Security Centre", to: "/guide", testid: "profile-security" },
    { icon: <SocialCluster />, label: "Social Media", to: "/social-bonus", testid: "profile-social" },
    { icon: <HelpCircle size={26} color="#2563EB" strokeWidth={2.2} />, label: "Help Center", to: "/guide", testid: "profile-help" },
    { icon: <Cog size={26} color="#16A34A" strokeWidth={2.2} />, label: "API Management", to: "/bind-api", testid: "profile-api" },
  ];

  return (
    <div className="pb-8" style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-4 py-3.5 sticky top-0 z-20" style={{ background: "var(--bg-base)" }}>
        <button onClick={() => navigate("/")} data-testid="profile-back" className="p-1 -ml-1">
          <ChevronLeft size={26} style={{ color: "var(--ink)" }} />
        </button>
        <div className="flex items-center gap-1.5">
          <img src={TS_LOGO} alt="Trade Skill" className="w-7 h-7 rounded-md object-cover" />
          <span className="font-display font-black text-xl tracking-tight" style={{ color: "var(--ink)" }}>
            Trade<span style={{ color: "#2563EB" }}>Skill</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/guide")} data-testid="profile-support-icon">
            <Headphones size={23} style={{ color: "var(--ink)" }} strokeWidth={2.2} />
          </button>
          <button onClick={() => navigate("/guide")} data-testid="profile-settings-icon">
            <Settings size={23} style={{ color: "var(--ink)" }} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-2.5">
        {/* ===== Identity card ===== */}
        <div
          className="relative rounded-3xl p-5 overflow-hidden"
          style={{ background: BLUE_GRAD, boxShadow: "0 8px 24px rgba(37,99,235,0.3)" }}
          data-testid="profile-identity-card"
        >
          <div
            className="absolute right-[-60px] top-[-40px] w-56 h-56 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 70%)" }}
          />
          <div className="relative flex items-start gap-4">
            {/* avatar column */}
            <div className="flex flex-col items-center shrink-0">
              <div className="relative">
                <div
                  className="w-[88px] h-[88px] rounded-full overflow-hidden flex items-center justify-center font-display font-black text-3xl text-white"
                  style={{ border: "3px solid rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.15)" }}
                >
                  {avatar ? (
                    <img src={avatar} alt="avatar" className="w-full h-full object-cover" data-testid="profile-avatar-img" />
                  ) : (
                    (user?.name || user?.email || "?")[0]?.toUpperCase()
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  data-testid="profile-avatar-camera"
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "#2563EB", border: "2px solid #fff" }}
                >
                  <Camera size={14} color="#fff" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} data-testid="profile-avatar-input" />
              </div>
              <div
                className="flex items-center gap-1 mt-2.5 px-3 py-1 rounded-full"
                style={{ background: "#16A34A" }}
                data-testid="profile-verified-pill"
              >
                <BadgeCheck size={13} color="#fff" />
                <span className="text-white text-[11px] font-black">Verified</span>
              </div>
            </div>

            {/* details column */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-black text-[22px] text-white truncate" data-testid="profile-name">
                  Hi, {user?.name || "Trader"}
                </span>
                <BadgeCheck size={18} fill="#fff" color="#2563EB" className="shrink-0" />
              </div>

              <div className="space-y-2 mt-2.5">
                <div className="flex items-center gap-2 text-white/95 text-[13px]">
                  <Mail size={15} className="shrink-0 opacity-90" />
                  <span className="truncate" data-testid="profile-email">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-white/95 text-[13px]">
                  <Calendar size={15} className="shrink-0 opacity-90" />
                  <span>Joined on {fmtJoin(user?.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-white/95 text-[13px]">
                  <UserIcon size={15} className="shrink-0 opacity-90" />
                  <span>UID: <b data-testid="profile-uid">{user?.uid || "—"}</b></span>
                  <button onClick={copyUID} data-testid="profile-copy-uid" className="opacity-90 active:opacity-60">
                    <Copy size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-white/95 text-[13px]">
                  <MapPin size={15} className="shrink-0 opacity-90" />
                  <span>🇮🇳 Country: {user?.country || "India"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Menu list ===== */}
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => navigate(it.to)}
            data-testid={it.testid}
            className="w-full rounded-2xl px-4 py-3 flex items-center gap-4 active:scale-[0.99] transition-transform"
            style={CARD}
          >
            <div className="w-8 flex items-center justify-center shrink-0">{it.icon}</div>
            <span className="flex-1 text-left font-medium text-[17px]" style={{ color: "var(--ink)" }}>
              {it.label}
            </span>
            <ChevronRight size={22} style={{ color: "var(--text-mute)" }} />
          </button>
        ))}

        {/* Admin */}
        {user?.role === "admin" && (
          <button
            onClick={() => navigate("/admin/withdrawals")}
            className="w-full rounded-2xl px-4 py-3 flex items-center gap-4"
            style={CARD}
            data-testid="profile-admin-withdrawals"
          >
            <div className="w-8 flex items-center justify-center shrink-0">
              <Shield size={26} color="#DC2626" strokeWidth={2.2} />
            </div>
            <span className="flex-1 text-left font-medium text-[17px]" style={{ color: "var(--ink)" }}>
              Withdrawals Admin
            </span>
            <ChevronRight size={22} style={{ color: "var(--text-mute)" }} />
          </button>
        )}

        {/* Logout */}
        <button
          onClick={doLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-display font-black"
          style={{ background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.35)", color: "var(--bad)" }}
          data-testid="logout-btn"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
}
