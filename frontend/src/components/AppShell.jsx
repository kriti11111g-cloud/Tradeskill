import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import LiveTicker from "@/components/LiveTicker";

export default function AppShell() {
  return (
    <div
      className="min-h-screen w-full flex justify-center overflow-x-hidden relative transition-colors duration-300"
      style={{ background: "var(--bg-gradient)", color: "var(--text)" }}
    >
      <div className="grain-overlay" />
      <div
        className="w-full max-w-[480px] min-h-screen relative pt-9 pb-24"
        style={{
          background: "var(--bg-base)",
          boxShadow: "0 0 80px rgba(0,0,0,0.6)",
        }}
        data-testid="app-shell"
      >
        <LiveTicker />
        <Outlet />
        <BottomNav />
      </div>
    </div>
  );
}
