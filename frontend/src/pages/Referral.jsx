import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Copy, User, Link2, Users, BarChart3, HandCoins, Infinity as InfinityIcon, ScanLine } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import api from "@/lib/api";

const LOGO = "https://static.prod-images.emergentagent.com/jobs/e3103ddd-0dc9-4cf2-8d94-ea48e4389b5b/images/2fc173585b6a7c8ae03589e9d69e196865e3322126777cf481e10020b4b21714.jpeg";

const CARD = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", boxShadow: "0 1px 8px rgba(0,0,0,0.05)" };

export default function Referral() {
  const nav = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/referral").then(({ data }) => setData(data));
  }, []);

  const code = data?.referral_code || "";
  const link = code ? `${window.location.origin}/register?ref=${code}` : "";

  const copyCode = () => { navigator.clipboard.writeText(code); toast.success("Referral code copied!"); };
  const copyLink = () => { navigator.clipboard.writeText(link); toast.success("Referral link copied!"); };

  return (
    <div className="min-h-screen pb-8" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div className="flex items-center px-3 py-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 flex items-center justify-center" data-testid="invite-back" style={{ touchAction: "manipulation" }}>
          <ChevronLeft size={26} strokeWidth={2.6} style={{ color: "var(--ink)" }} />
        </button>
        <div className="flex-1 text-center font-display font-black text-[22px] pr-9" style={{ color: "var(--ink)" }}>Invite Friends</div>
      </div>

      <div className="px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <img src={LOGO} alt="TradeSkill" className="w-11 h-11 rounded-xl object-cover" style={{ transform: "scale(1.0)" }} />
          <span className="font-display font-black text-[30px] leading-none">
            <span style={{ color: "#2563EB" }}>Trade</span><span style={{ color: "#16A34A" }}>Skill</span>
          </span>
        </div>
        <div className="text-center text-[11px] font-bold tracking-[0.35em] mt-1.5" style={{ color: "var(--text-mute)" }}>
          TRADE · EARN · GROW TOGETHER
        </div>
        <div className="text-center text-[13px] font-semibold mt-2" style={{ color: "var(--ink)" }}>
          Invite your friends and be a part of our growing community
        </div>

        {/* QR */}
        <div className="flex flex-col items-center mt-4">
          <div className="relative rounded-3xl p-3" style={{ border: "6px solid #0A0A0A", background: "#FFFFFF" }} data-testid="invite-qr">
            {link ? (
              <QRCodeCanvas value={link} size={200} level="H" bgColor="#FFFFFF" fgColor="#0A0A0A" />
            ) : (
              <div className="w-[200px] h-[200px]" />
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center" style={{ boxShadow: "0 0 0 4px #FFFFFF" }}>
                <img src={LOGO} alt="" className="w-11 h-11 rounded-xl object-cover" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-full -mt-5 relative z-10 text-white font-display font-black text-[15px]" style={{ background: "#0A0A0A" }}>
            <ScanLine size={17} /> Scan &amp; Join Now
          </div>
          <div className="text-[12px] font-semibold mt-2.5" style={{ color: "var(--text-mute)" }}>
            Share your QR code with friends
          </div>
        </div>

        {/* Referral Code card */}
        <div className="flex items-center gap-3 px-3.5 py-3 mt-4" style={CARD} data-testid="invite-code-card">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--surface-3)" }}>
            <User size={20} style={{ color: "var(--ink)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: "var(--text-mute)" }}>Your Referral Code</div>
            <div className="font-display font-black text-[20px] tracking-wide" style={{ color: "var(--ink)" }} data-testid="invite-code">{code || "----"}</div>
          </div>
          <div className="self-stretch w-px" style={{ background: "var(--border)" }} />
          <button onClick={copyCode} className="flex items-center gap-1.5 font-display font-black text-[15px] px-1" style={{ color: "#2563EB", touchAction: "manipulation" }} data-testid="invite-copy-code">
            <Copy size={18} /> Copy
          </button>
        </div>

        {/* Referral Link card */}
        <div className="flex items-center gap-3 px-3.5 py-3 mt-2.5" style={CARD} data-testid="invite-link-card">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--surface-3)" }}>
            <Link2 size={20} style={{ color: "var(--ink)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: "var(--text-mute)" }}>Your Referral Link</div>
            <div className="font-semibold text-[12px] truncate" style={{ color: "var(--ink)" }} data-testid="invite-link">{link || "—"}</div>
          </div>
          <div className="self-stretch w-px" style={{ background: "var(--border)" }} />
          <button onClick={copyLink} className="flex items-center gap-1.5 font-display font-black text-[15px] px-1" style={{ color: "#2563EB", touchAction: "manipulation" }} data-testid="invite-copy-link">
            <Copy size={18} /> Copy
          </button>
        </div>

        {/* Big gradient button */}
        <button onClick={copyLink} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 mt-3.5 text-white font-display font-black text-[17px]"
          style={{ background: "linear-gradient(90deg,#2563EB 0%,#16A34A 100%)", touchAction: "manipulation" }} data-testid="invite-copy-link-btn">
          <Copy size={19} /> Copy Referral Link
        </button>

        {/* Info row */}
        <div className="grid grid-cols-4 mt-4" style={CARD} data-testid="invite-info-row">
          {[
            { Icon: Users, color: "#2563EB", title: "Invite Friends", sub: "Share your link" },
            { Icon: BarChart3, color: "#16A34A", title: "They Trade", sub: "Grow together" },
            { Icon: HandCoins, color: "#16A34A", title: "You Earn", sub: "Get rewards" },
            { Icon: InfinityIcon, color: "#16A34A", title: "Unlimited Potential", sub: "Build your network" },
          ].map((it, i) => (
            <div key={it.title} className="flex flex-col items-center text-center px-1.5 py-3" style={{ borderLeft: i > 0 ? "1px solid var(--border)" : "none" }}>
              <it.Icon size={26} style={{ color: it.color }} strokeWidth={2.2} />
              <div className="font-display font-black text-[11px] mt-1.5 leading-tight" style={{ color: "var(--ink)" }}>{it.title}</div>
              <div className="text-[9px] font-semibold mt-0.5 leading-tight" style={{ color: "var(--text-mute)" }}>{it.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
