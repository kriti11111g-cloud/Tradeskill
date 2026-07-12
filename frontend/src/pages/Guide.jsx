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
        {rows.map((g) => (
          <div
            key={g.id}
            className="app-card rounded-2xl p-4"
          >
            <div className="font-display font-bold text-sm">{g.title}</div>
            <div className="text-xs text-white/70 mt-2 leading-relaxed">{g.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
