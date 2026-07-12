import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageHeader({ title, subtitle, right, showBack = true, onBack }) {
  const nav = useNavigate();
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-3" data-testid="page-header">
      {showBack && (
        <button
          onClick={() => (onBack ? onBack() : nav(-1))}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
          data-testid="back-btn"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <div className="flex-1">
        <div
          className="font-display font-bold text-lg leading-tight"
          style={{ color: "var(--text)" }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            className="text-[10px] uppercase tracking-[0.2em] mt-0.5"
            style={{ color: "var(--text-mute)" }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}
