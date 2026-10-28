import { useState } from "react";
import { ShieldAlert, LogOut } from "lucide-react";

export default function ImpersonationBanner() {
  const [info] = useState(() => {
    try {
      const raw = localStorage.getItem("tgx_impersonating");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  if (!info) return null;

  const exit = () => {
    const prev = localStorage.getItem("tgx_prev_token") || "";
    if (prev) localStorage.setItem("tgx_token", prev);
    else localStorage.removeItem("tgx_token");
    localStorage.removeItem("tgx_impersonating");
    localStorage.removeItem("tgx_prev_token");
    window.location.href = "/admin";
  };

  return (
    <div
      className="sticky top-0 z-[60] flex items-center justify-between gap-2 px-3 py-2"
      style={{ background: "linear-gradient(90deg,#B45309,#92400E)", color: "#fff" }}
      data-testid="impersonation-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert size={16} className="shrink-0" />
        <span className="text-[11.5px] font-semibold truncate">
          Admin view: {info.name || info.uid}{" "}
          <span className="opacity-80">({info.uid})</span>
        </span>
      </div>
      <button
        onClick={exit}
        className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11.5px] font-bold"
        style={{ background: "rgba(255,255,255,0.18)" }}
        data-testid="impersonation-exit-btn"
      >
        <LogOut size={13} /> Exit to Admin
      </button>
    </div>
  );
}
