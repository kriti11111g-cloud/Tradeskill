import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HandCoins,
  Landmark,
  ExternalLink,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const EXPLORERS = {
  BEP20: "https://bscscan.com/tx/",
  POLYGON: "https://polygonscan.com/tx/",
};

export default function AdminWithdrawals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [requests, setRequests] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [busy, setBusy] = useState(null); // request id being processed
  const [tab, setTab] = useState("pending");

  useEffect(() => {
    if (user && !isAdmin) navigate("/", { replace: true });
  }, [user, isAdmin, navigate]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get("/admin/withdrawals");
      setRequests(data || []);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, [isAdmin]);

  const loadTreasury = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get("/admin/treasury");
      setTreasury(data);
    } catch {
      /* ignore */
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
    loadTreasury();
  }, [load, loadTreasury]);

  const act = async (id, action, payload = {}) => {
    setBusy(id);
    try {
      const { data } = await api.post(`/admin/withdrawals/${id}/${action}`, payload);
      if (action === "approve" && data.tx_hash) {
        toast.success(`Paid on-chain · tx ${data.tx_hash.slice(0, 12)}…`);
      } else {
        toast.success(action === "reject" ? "Rejected — user refunded" : "Marked as paid");
      }
      await load();
      await loadTreasury();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const visible = requests.filter((r) =>
    tab === "pending" ? r.status === "pending" : r.status !== "pending",
  );
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (!isAdmin) return null;

  return (
    <div className="pb-40" data-testid="admin-withdrawals-page">
      <PageHeader title="Withdrawals Admin" subtitle="Approval Queue · Treasury" />

      <div className="px-4 mt-2 space-y-4">
        {/* Treasury card */}
        <div className="app-card p-4" data-testid="admin-treasury-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Landmark size={14} className="text-[color:var(--warn)]" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-[color:var(--text-mute)]">
                Master / Gas Wallet
              </span>
            </div>
            <button
              onClick={() => { loadTreasury(); load(); }}
              className="text-[color:var(--primary)]"
              data-testid="btn-refresh-treasury"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          {!treasury ? (
            <div className="text-[11px] text-[color:var(--text-mute)]">Loading balances…</div>
          ) : (
            <>
              <div
                className="text-[11px] font-mono break-all text-[color:var(--text)] mb-2"
                data-testid="treasury-master-address"
              >
                {treasury.master_address}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(treasury.networks || {}).map(([net, info]) => (
                  <div
                    key={net}
                    className="rounded-lg border border-[color:var(--border)] px-3 py-2"
                    data-testid={`treasury-${net.toLowerCase()}`}
                  >
                    <div className="text-[9px] uppercase tracking-widest text-[color:var(--text-mute)]">
                      {info.label || net}
                    </div>
                    {info.error ? (
                      <div className="text-[10px] text-[color:var(--bad)] mt-0.5">RPC error</div>
                    ) : (
                      <>
                        <div className="text-[13px] font-bold text-[color:var(--text)]">
                          {Number(info.usdt).toFixed(2)} USDT
                        </div>
                        <div className="text-[10px] text-[color:var(--text-mute)]">
                          Gas: {Number(info.native).toFixed(4)} {info.native_symbol}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 rounded-lg bg-[var(--surface)] p-1">
          <button
            onClick={() => setTab("pending")}
            className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition ${
              tab === "pending"
                ? "bg-[color:var(--gold)] text-black"
                : "text-[color:var(--text-mute)]"
            }`}
            data-testid="tab-admin-pending"
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition ${
              tab === "history"
                ? "bg-[color:var(--gold)] text-black"
                : "text-[color:var(--text-mute)]"
            }`}
            data-testid="tab-admin-history"
          >
            History
          </button>
        </div>

        {/* Requests */}
        {visible.length === 0 ? (
          <div className="app-card p-6 text-center text-[12px] text-[color:var(--text-mute)]" data-testid="admin-empty-state">
            {tab === "pending" ? "No pending withdrawal requests." : "No resolved requests yet."}
          </div>
        ) : (
          <div className="space-y-2" data-testid="admin-requests-list">
            {visible.map((r) => (
              <div key={r.id} className="app-card p-3.5" data-testid="admin-request-row">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[color:var(--text)]">
                      {fmtUSD(r.amount)}{" "}
                      <span className="text-[10px] font-semibold text-[color:var(--text-mute)]">
                        (net {fmtUSD(r.net_amount)} · fee {fmtUSD(r.fee)})
                      </span>
                    </div>
                    <div className="text-[10px] text-[color:var(--text-mute)] truncate">{r.email}</div>
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      r.status === "pending"
                        ? "bg-[color:var(--gold)]/15 text-[color:var(--warn)]"
                        : r.status === "completed"
                        ? "bg-[color:var(--good)]/15 text-[color:var(--good)]"
                        : "bg-[color:var(--bad)]/15 text-[color:var(--bad)]"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="text-[10px] font-mono break-all text-[color:var(--text-soft)] mt-1.5">
                  {r.address} · <span className="font-sans font-semibold">{r.network}</span>
                </div>
                <div className="text-[9px] text-[color:var(--text-mute)] mt-0.5">{fmtTime(r.created_at)}</div>
                {r.tx_hash && (
                  <a
                    href={`${EXPLORERS[r.network] || ""}${r.tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-[color:var(--primary)] mt-1"
                    data-testid="admin-tx-link"
                  >
                    tx: {r.tx_hash.slice(0, 18)}… <ExternalLink size={10} />
                  </a>
                )}
                {r.reject_reason && (
                  <div className="text-[10px] text-[color:var(--bad)] mt-1">Reason: {r.reject_reason}</div>
                )}

                {r.status === "pending" && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      onClick={() => act(r.id, "approve", { manual: false })}
                      disabled={busy === r.id}
                      className="py-2 rounded-lg bg-[color:var(--good)] text-black text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-40"
                      data-testid="btn-admin-approve"
                    >
                      <CheckCircle2 size={12} /> Pay On-chain
                    </button>
                    <button
                      onClick={() => act(r.id, "approve", { manual: true })}
                      disabled={busy === r.id}
                      className="py-2 rounded-lg border border-[color:var(--warn)]/40 bg-[color:var(--gold)]/10 text-[color:var(--warn)] text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-40"
                      data-testid="btn-admin-manual"
                    >
                      <HandCoins size={12} /> Mark Paid
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt("Reject reason (optional):") || "";
                        act(r.id, "reject", { reason });
                      }}
                      disabled={busy === r.id}
                      className="py-2 rounded-lg border border-[color:var(--bad)]/40 bg-[color:var(--bad)]/10 text-[color:var(--bad)] text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-40"
                      data-testid="btn-admin-reject"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                )}
                {busy === r.id && (
                  <div className="flex items-center gap-1.5 text-[10px] text-[color:var(--text-mute)] mt-2">
                    <ShieldCheck size={11} className="animate-pulse" /> Processing on-chain transaction…
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
