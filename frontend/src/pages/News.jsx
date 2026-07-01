import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtTime } from "@/lib/format";

export default function News() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/news").then(({ data }) => setRows(data));
  }, []);

  return (
    <div className="pb-4">
      <PageHeader title="News" subtitle="Market · Platform Updates" />
      <div className="px-4 space-y-3" data-testid="news-list">
        {rows.map((n) => (
          <div
            key={n.id}
            className="bg-[#0F1524]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 hover:border-[#00F0FF]/30 transition"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30">
                {n.category}
              </span>
              <span className="text-[10px] text-[#8B9BB4]">{fmtTime(n.created_at)}</span>
            </div>
            <div className="font-display font-bold text-sm leading-snug">{n.title}</div>
            <div className="text-xs text-white/70 mt-1">{n.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
