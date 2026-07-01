import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Persistent floating avatar in the top-right corner of every authenticated screen.
 * Tapping it navigates to the Mine (/profile) page — same content that used to be
 * in the bottom-nav "Mine" tab.
 */
export default function TopProfileBadge() {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return null;
  const active = loc.pathname === "/profile";
  const initial = (user.name || user.email || "?")[0]?.toUpperCase();

  return (
    <Link
      to="/profile"
      data-testid="top-profile-btn"
      aria-label="Open profile"
      className={`fixed z-50 top-1 right-2 sm:right-[calc(50%-232px)] w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-sm text-white shadow-[0_2px_10px_rgba(0,0,0,0.6)] transition-all hover:scale-105 border-2 ${
        active
          ? "border-[#00F0FF] bg-[#00F0FF] text-[#050914]"
          : "border-white/40 bg-gradient-to-br from-[#00F0FF] to-[#FF007A]"
      }`}
    >
      {initial}
    </Link>
  );
}
