import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";

export default function Guide() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/guide").then(({ data }) => setRows(data));
  }, []);

  return (
    <div className="pb-4">
      <PageHeader title="User Guide" subtitle="Get started with TGX BOT" />
      <div className="px-4 space-y-3" data-testid="guide-list">
        {rows.map((g, i) => (
          <div
            key={g.id}
            className="app-card rounded-2xl p-4 flex items-start gap-3"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-display font-black text-[11px]"
              style={{
                background: `color-mix(in srgb, ${i % 2 === 0 ? "var(--gold)" : "var(--primary)"} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${i % 2 === 0 ? "var(--gold)" : "var(--primary)"} 28%, transparent)`,
                color: i % 2 === 0 ? "var(--gold-deep)" : "var(--primary)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div>
              <div className="font-display font-bold text-sm">{g.title}</div>
              <div className="text-xs text-[color:var(--text-soft)] mt-2 leading-relaxed">{g.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
