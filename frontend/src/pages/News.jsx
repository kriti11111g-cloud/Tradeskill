import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";
import { fmtTime } from "@/lib/format";

export default function News() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/news")
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-4">
      <PageHeader title="News" subtitle="Live Crypto Feed · Powered by Cointelegraph" />

      <div className="px-4 space-y-3" data-testid="news-list">
        {loading && (
          <div className="text-center text-sm text-[color:var(--text-mute)] py-16">Loading latest headlines…</div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-center text-sm text-[color:var(--text-mute)] py-16" data-testid="empty-news">
            No news available right now. Please check back later.
          </div>
        )}

        {rows.map((n) => {
          const Card = (
            <div
              key={n.id}
              className="app-card rounded-2xl overflow-hidden hover:border-[color:var(--primary)]/40 transition"
              data-testid={`news-item-${n.id}`}
            >
              {n.image && (
                <div className="w-full h-36 overflow-hidden bg-[color:var(--bg-base)]">
                  <img
                    src={n.image}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-[color:var(--primary)]/10 text-[color:var(--primary)] border border-[color:var(--primary)]/30 max-w-[45%] truncate">
                    {n.category}
                  </span>
                  <span className="text-[10px] text-[color:var(--text-mute)]">{fmtTime(n.created_at)}</span>
                  {n.url && <ExternalLink size={12} className="ml-auto text-[color:var(--text-mute)]" />}
                </div>
                <div className="font-display font-bold text-sm leading-snug">{n.title}</div>
                <div className="text-xs text-white/70 mt-1 line-clamp-3">{n.summary}</div>
              </div>
            </div>
          );

          return n.url ? (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              data-testid={`news-link-${n.id}`}
            >
              {Card}
            </a>
          ) : (
            Card
          );
        })}
      </div>
    </div>
  );
}
