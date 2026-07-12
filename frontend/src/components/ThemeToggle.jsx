import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/**
 * Compact pill toggle switching between Day / Night mode.
 * Green brand aware — respects CSS variables from index.css.
 */
export default function ThemeToggle({ compact = false }) {
  const { mode, toggle } = useTheme();
  const isLight = mode === "light";

  return (
    <button
      onClick={toggle}
      data-testid="theme-toggle"
      aria-label={`Switch to ${isLight ? "night" : "day"} mode`}
      className="relative flex items-center gap-1 rounded-full p-1 transition-all"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
        style={{
          background: isLight ? "var(--primary-grad)" : "transparent",
          boxShadow: isLight ? "0 4px 12px var(--primary-glow)" : "none",
        }}
      >
        <Sun size={12} color={isLight ? "#fff" : "var(--text-mute)"} />
      </span>
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
        style={{
          background: !isLight ? "var(--primary-grad)" : "transparent",
          boxShadow: !isLight ? "0 4px 12px var(--primary-glow)" : "none",
        }}
      >
        <Moon size={12} color={!isLight ? "#fff" : "var(--text-mute)"} />
      </span>
      {!compact && (
        <span
          className="ml-1 mr-2 text-[10px] font-black uppercase tracking-widest"
          style={{ color: "var(--text-soft)" }}
        >
          {isLight ? "Day" : "Night"}
        </span>
      )}
    </button>
  );
}
