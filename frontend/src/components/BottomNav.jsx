import { NavLink } from "react-router-dom";
import { Home, LineChart, ArrowRightLeft, Wallet } from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "Home", testid: "nav-home" },
  { to: "/market", icon: LineChart, label: "Market", testid: "nav-market" },
  { to: "/transactions", icon: ArrowRightLeft, label: "Trade", testid: "nav-trade" },
  { to: "/wallet", icon: Wallet, label: "Asset", testid: "nav-wallet" },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-20 bg-[#050914]/85 backdrop-blur-2xl border-t border-white/25 z-50 flex justify-around items-center px-2 no-select"
      data-testid="bottom-nav"
    >
      {items.map(({ to, icon: Icon, label, testid }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          data-testid={testid}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-all duration-200 ${
              isActive ? "text-[#00F0FF]" : "text-[#8B9BB4] hover:text-white"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={22}
                strokeWidth={1.7}
                style={isActive ? { filter: "drop-shadow(0 0 6px rgba(0,240,255,0.7))" } : {}}
              />
              <span className="text-[10px] uppercase tracking-widest font-semibold font-body">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
