import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import LiveTicker from "@/components/LiveTicker";
import TopProfileBadge from "@/components/TopProfileBadge";

export default function AppShell() {
  return (
    <div className="min-h-screen w-full bg-[#050914] text-white flex justify-center overflow-x-hidden relative">
      <div className="grain-overlay" />
      <div
        className="w-full max-w-[480px] min-h-screen bg-[#050914] relative shadow-[0_0_80px_rgba(0,0,0,0.6)] pb-24"
        data-testid="app-shell"
      >
        <LiveTicker />
        <TopProfileBadge />
        <Outlet />
        <BottomNav />
      </div>
    </div>
  );
}
