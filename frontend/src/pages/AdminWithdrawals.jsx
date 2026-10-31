import { useEffect, useState, useCallback } from "react";
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

const EXPLORERS = {
  BEP20: "https://bscscan.com/tx/",
  POLYGON: "https://polygonscan.com/tx/",
};

export default function AdminWithdrawals() {
  const [requests, setRequests] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [busy, setBusy] = useState(null); // request id being processed
  const [tab, setTab] = useState("pending");
  const [walletToken, setWalletToken] = useState(() => localStorage.getItem("tgx_admin_wallet_token") || "");
  const [connecting, setConnecting] = useState(false);

  const wcfg = { headers: { Authorization: `Bearer ${walletToken}` } };

  const disconnect = useCallback(() => {
    localStorage.removeItem("tgx_admin_wallet_token");
    setWalletToken("");
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error("No wallet found — open this page inside MetaMask / Trust Wallet browser");
      return;
    }
    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      const { data: n } = await api.post("/admin/wallet-nonce", { address: addr });
      const sig = await window.ethereum.request({ method: "personal_sign", params: [n.message, addr] });
      const { data: login } = await api.post("/admin/wallet-login", { address: addr, signature: sig });
      localStorage.setItem("tgx_admin_wallet_token", login.token);
      setWalletToken(login.token);
      toast.success("Admin wallet verified — welcome!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Wallet connect failed");
    } finally {
      setConnecting(false);
    }
  };

  const load = useCallback(async () => {
    if (!walletToken) return;
    try {
      const { data } = await api.get("/admin/withdrawals", { headers: { Authorization: `Bearer ${walletToken}` } });
      setRequests(data || []);
    } catch (e) {
      if (e?.response?.status === 401 || e?.response?.status === 403) disconnect();
      else toast.error(formatApiError(e));
    }
  }, [walletToken, disconnect]);

  const loadTreasury = useCallback(async () => {
    if (!walletToken) return;
    try {
      const { data } = await api.get("/admin/treasury", { headers: { Authorization: `Bearer ${walletToken}` } });
      setTreasury(data);
    } catch {
      /* ignore */
    }
  }, [walletToken]);

  useEffect(() => {
    load();
    loadTreasury();
  }, [load, loadTreasury]);

  const act = async (id, action, payload = {}) => {
    setBusy(id);
    try {
      const { data } = await api.post(`/admin/withdrawals/${id}/${action}`, payload, wcfg);
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

  if (!walletToken) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-8 text-center" data-testid="admin-wallet-gate">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-5"
          style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
          <ShieldCheck size={38} />
        </div>
        <div className="font-display font-black text-[22px]" style={{ color: "var(--ink)" }}>Admin Access</div>
        <div className="text-[13px] font-semibold mt-2 leading-relaxed" style={{ color: "var(--text-mute)" }}>
          Admin panel opens only from an authorized wallet.<br />
          Connect your admin wallet and sign the message.
        </div>
        <button onClick={connectWallet} disabled={connecting}
          className="mt-6 px-8 py-3.5 rounded-2xl text-white font-display font-black text-[16px] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)", touchAction: "manipulation" }}
          data-testid="admin-connect-wallet-btn">
          {connecting ? "Connecting…" : "Connect Wallet"}
        </button>
        <div className="text-[10.5px] font-semibold mt-4" style={{ color: "var(--text-mute)" }}>
          Mobile par: is page ko MetaMask / Trust Wallet ke browser me kholo
        </div>
      </div>
    );
  }

  return (
    <div className="pb-40" data-testid="admin-withdrawals-page">
      <PageHeader title="Withdrawals Admin" subtitle="Approval Queue · Treasury" />
      <div className="px-4 -mt-1 mb-2 flex justify-end">
        <button onClick={disconnect} className="text-[11px] font-black uppercase tracking-wider"
          style={{ color: "var(--bad)" }} data-testid="admin-disconnect-wallet">
          Disconnect Wallet
        </button>
      </div>

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
                    <div className="text-[11px] font-bold text-[color:var(--text)] truncate" data-testid="admin-wd-name">{r.name || "—"}</div>
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
