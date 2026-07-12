import { NavLink } from "react-router-dom";
import { Home, LineChart, ArrowRightLeft, Wallet, CircleUserRound, Bot } from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "Home", testid: "nav-home" },
  { to: "/market", icon: LineChart, label: "Market", testid: "nav-market" },
  { to: "/trades", icon: ArrowRightLeft, label: "Trade", testid: "nav-trade" },
  { to: "/wallet", icon: Wallet, label: "Asset", testid: "nav-wallet" },
  { to: "/bot", icon: Bot, label: "Bot", testid: "nav-bot" },
  { to: "/profile", icon: CircleUserRound, label: "Profile", testid: "nav-profile" },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-20 backdrop-blur-2xl z-50 flex justify-around items-center px-2 no-select transition-colors duration-300"
      style={{
        background: "var(--nav-bg)",
        borderTop: "1px solid var(--nav-border)",
      }}
      data-testid="bottom-nav"
    >
      {items.map(({ to, icon: Icon, label, testid }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          data-testid={testid}
          className="flex flex-col items-center gap-1 transition-all duration-200"
        >
          {({ isActive }) => (
            <>
              <Icon
                size={22}
                strokeWidth={1.7}
                style={{
                  color: isActive ? "var(--primary)" : "var(--text-mute)",
                  filter: isActive
                    ? "drop-shadow(0 0 6px var(--primary-glow))"
                    : "none",
                }}
              />
              <span
                className="text-[10px] uppercase tracking-widest font-semibold font-body"
                style={{ color: isActive ? "var(--primary)" : "var(--text-mute)" }}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
