import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageHeader({ title, subtitle, right, showBack = true }) {
  const nav = useNavigate();
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-3" data-testid="page-header">
      {showBack && (
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/25 flex items-center justify-center hover:border-[#00F0FF]/40 hover:bg-white/10 transition-all"
          data-testid="back-btn"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <div className="flex-1">
        <div className="font-display font-bold text-lg leading-tight">{title}</div>
        {subtitle && (
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B9BB4] mt-0.5">{subtitle}</div>
        )}
      </div>
      {right}
    </div>
  );
}
