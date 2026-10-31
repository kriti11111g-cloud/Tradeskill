import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Menu, X, LayoutDashboard, Users, SlidersHorizontal, Coins, ArrowDownToLine,
  CircleDollarSign, Settings, Lock, ShieldCheck, UserPlus, TrendingUp, Wallet,
  RefreshCw, Search, ChevronRight, Calendar, Mail, Phone, Crown, Pencil, Ban, CheckCircle2,
  DatabaseBackup, KeyRound, Gift, Plus, Trash2, Zap, LogIn,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { fmtUSD, fmtTime } from "@/lib/format";

const BLUE = "#2563EB";
const BLUE_GRAD = "linear-gradient(135deg,#3B82F6,#2563EB)";
const CARD = { background: "var(--surface)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "14px" };

const MENU = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "users", label: "User Management", Icon: Users },
  { id: "adjustment", label: "Adjustment", Icon: SlidersHorizontal },
  { id: "deposits", label: "Deposits", Icon: Coins },
  { id: "withdrawals", label: "Withdrawals", Icon: ArrowDownToLine },
  { id: "pools", label: "Pools", Icon: CircleDollarSign },
  { id: "settings", label: "Settings", Icon: Settings },
  { id: "bonanza", label: "Bonanza Offer", Icon: Gift },
  { id: "lock", label: "Lock", Icon: Lock },
];

export default function AdminPanel() {
  const nav = useNavigate();
  const [walletToken, setWalletToken] = useState(() => localStorage.getItem("tgx_admin_wallet_token") || "");
  const [connecting, setConnecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, setSection] = useState("dashboard");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [deposits, setDeposits] = useState([]);
  const [finance, setFinance] = useState(null);
  const [settings, setSettings] = useState(null);
  const [adj, setAdj] = useState({ identifier: "", amount: "", note: "" });
  const [adjBusy, setAdjBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editWallets, setEditWallets] = useState({ bep20: null, polygon: null });
  const [detailBusy, setDetailBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [bonanza, setBonanza] = useState(null);
  const [bonanzaBusy, setBonanzaBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const [confirmAct, setConfirmAct] = useState(false);

  const openUser = (u) => {
    setDetail(u);
    setEditWallets({ bep20: null, polygon: null });
  };

  const impersonate = async () => {
    if (!detail) return;
    setDetailBusy(true);
    const t = toast.loading(`Logging in as ${detail.name || detail.uid}…`);
    try {
      const { data } = await api.post(`/admin/users/${detail.uid}/impersonate`, {}, cfg);
      localStorage.setItem("tgx_prev_token", localStorage.getItem("tgx_token") || "");
      localStorage.setItem("tgx_token", data.token);
      localStorage.setItem("tgx_impersonating", JSON.stringify(data.user));
      toast.success(`Opening ${data.user?.name || data.user?.uid}'s account`, { id: t });
      window.location.href = "/";
    } catch (e) {
      toast.error(formatApiError(e), { id: t });
      setDetailBusy(false);
    }
  };

  const saveWallets = async () => {
    setDetailBusy(true);
    try {
      await api.post(`/admin/users/${detail.uid}/wallets`, {
        bep20_address: editWallets.bep20 || null,
        polygon_address: editWallets.polygon || null,
      }, cfg);
      toast.success("Wallet address updated — user withdrawals will use it now");
      const wa = { ...(detail.withdrawal_addresses || {}) };
      if (editWallets.bep20) wa.BEP20 = editWallets.bep20;
      if (editWallets.polygon) wa.POLYGON = editWallets.polygon;
      setDetail({ ...detail, withdrawal_addresses: wa });
      setEditWallets({ bep20: null, polygon: null });
      loadSection("users");
    } catch (e) { guard(e); } finally { setDetailBusy(false); }
  };

  const blockToggle = async (block) => {
    setDetailBusy(true);
    try {
      await api.post(`/admin/users/${detail.uid}/${block ? "block" : "unblock"}`, {}, cfg);
      toast.success(block ? `${detail.uid} BLOCKED` : `${detail.uid} unblocked`);
      setDetail({ ...detail, blocked: block });
      loadSection("users");
    } catch (e) { guard(e); } finally { setDetailBusy(false); }
  };

  const activateBot = () => {
    if (detail.bot_activated) { toast.info("Is user ka bot already active hai"); return; }
    setConfirmAct(true);
  };

  const doActivateBot = async () => {
    setDetailBusy(true);
    try {
      await api.post(`/admin/users/${detail.uid}/activate-bot`, {}, cfg);
      toast.success(`${detail.uid} ka bot activate ho gaya ✅ (no payout)`);
      setDetail({ ...detail, bot_activated: true, activated: true });
      setConfirmAct(false);
      loadSection("users");
    } catch (e) { guard(e); } finally { setDetailBusy(false); }
  };

  const resetPassword = () => setEdit({
    type: "reset-password", title: "Reset Login Password",
    label: `New login password for ${detail.uid}`, placeholder: "Min 6 characters",
    value: "", isPassword: true, min: 6,
  });

  const changeName = () => setEdit({
    type: "name", title: "Change Name",
    label: `New name for ${detail.uid}`, placeholder: "Full name",
    value: detail.name || "", isPassword: false, min: 2,
  });

  const changeEmail = () => setEdit({
    type: "email", title: "Change Email (Gmail)",
    label: `New email for ${detail.uid}`, placeholder: "name@gmail.com",
    value: detail.email || "", isPassword: false, min: 3, isEmail: true,
  });

  const setTxnPassword = () => setEdit({
    type: "txn-password", title: "Reset Transaction Password",
    label: `New transaction password for ${detail.uid}`, placeholder: "Min 4 characters",
    value: "", isPassword: true, min: 4,
  });

  const submitEdit = async () => {
    if (!edit) return;
    const val = (edit.value || "").trim();
    if (val.length < (edit.min || 1)) { toast.error(`Minimum ${edit.min} characters required`); return; }
    if (edit.isEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val.toLowerCase())) { toast.error("Enter a valid email address"); return; }
    setDetailBusy(true);
    try {
      if (edit.type === "reset-password") {
        await api.post(`/admin/users/${detail.uid}/reset-password`, { new_password: val }, cfg);
        toast.success(`${detail.uid} ka login password reset ho gaya ✅`);
      } else if (edit.type === "txn-password") {
        await api.post(`/admin/users/${detail.uid}/txn-password`, { new_password: val }, cfg);
        toast.success(`${detail.uid} ka transaction password reset ho gaya ✅`);
      } else if (edit.type === "name") {
        const { data } = await api.post(`/admin/users/${detail.uid}/name`, { new_name: val }, cfg);
        setDetail({ ...detail, name: data.name });
        toast.success(`${detail.uid} ka name update ho gaya ✅`);
        loadSection("users");
      } else if (edit.type === "email") {
        const { data } = await api.post(`/admin/users/${detail.uid}/email`, { new_email: val.toLowerCase() }, cfg);
        setDetail({ ...detail, email: data.email });
        toast.success(`${detail.uid} ka email update ho gaya ✅`);
        loadSection("users");
      }
      setEdit(null);
    } catch (e) { guard(e); } finally { setDetailBusy(false); }
  };

  const cfg = { headers: { Authorization: `Bearer ${walletToken}` } };

  const disconnect = useCallback(() => {
    localStorage.removeItem("tgx_admin_wallet_token");
    setWalletToken("");
  }, []);

  const guard = (e) => {
    if (e?.response?.status === 401 || e?.response?.status === 403) disconnect();
    else toast.error(e?.response?.data?.detail || "Failed");
  };

  const connectWallet = async () => {
    if (!window.ethereum) { toast.error("Open this page inside MetaMask / Trust Wallet browser"); return; }
    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      const { data: n } = await api.post("/admin/wallet-nonce", { address: addr });
      const sig = await window.ethereum.request({ method: "personal_sign", params: [n.message, addr] });
      const { data: login } = await api.post("/admin/wallet-login", { address: addr, signature: sig });
      localStorage.setItem("tgx_admin_wallet_token", login.token);
      setWalletToken(login.token);
      toast.success("Admin wallet verified!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Wallet connect failed");
    } finally { setConnecting(false); }
  };

  const loadSection = useCallback(async (sec) => {
    if (!walletToken) return;
    try {
      if (sec === "dashboard") setOverview((await api.get("/admin/overview", cfg)).data);
      if (sec === "users") setUsers((await api.get(`/admin/users?q=${encodeURIComponent(q)}`, cfg)).data);
      if (sec === "deposits") setDeposits((await api.get("/admin/deposits", cfg)).data);
      if (sec === "pools") setFinance((await api.get("/admin/finance-summary", cfg)).data);
      if (sec === "settings") setSettings((await api.get("/admin/settings", cfg)).data);
      if (sec === "bonanza") setBonanza((await api.get("/admin/bonanza", cfg)).data);
    } catch (e) { guard(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletToken, q]);

  useEffect(() => { loadSection(section); }, [section, walletToken]); // eslint-disable-line

  const submitAdjust = async (sign) => {
    if (!adj.identifier || !adj.amount) return toast.error("Email/UID aur amount dalo");
    const amt = Math.abs(parseFloat(adj.amount)) * sign;
    if (!amt) return toast.error("Valid amount dalo");
    setAdjBusy(true);
    try {
      const { data } = await api.post("/admin/adjust", { identifier: adj.identifier, amount: amt, note: adj.note }, cfg);
      toast.success(`${data.email} → new balance $${data.balance}`);
      setAdj({ identifier: "", amount: "", note: "" });
    } catch (e) { guard(e); } finally { setAdjBusy(false); }
  };

  const toggleAutoWd = async () => {
    try {
      const { data } = await api.post("/admin/settings", { auto_withdraw: !settings.auto_withdraw }, cfg);
      setSettings({ auto_withdraw: data.auto_withdraw });
      toast.success(`Auto Withdrawal ${data.auto_withdraw ? "ON" : "OFF"}`);
    } catch (e) { guard(e); }
  };

  // Deadline is edited in IST wall-clock; stored as RFC3339 with +05:30 offset.
  const pad2 = (n) => String(n).padStart(2, "0");
  const toISTInput = (iso) => {
    if (!iso) return "";
    const ms = new Date(iso).getTime() + 330 * 60000;
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  };
  const fromISTInput = (val) => (val ? `${val}:00+05:30` : null);

  const setTier = (i, key, val) => {
    setBonanza((b) => {
      const tiers = b.tiers.map((t, idx) => (idx === i ? { ...t, [key]: val } : t));
      return { ...b, tiers };
    });
  };
  const addTier = () => setBonanza((b) => ({ ...b, tiers: [...b.tiers, { directs: "", reward: "" }] }));
  const removeTier = (i) => setBonanza((b) => ({ ...b, tiers: b.tiers.filter((_, idx) => idx !== i) }));

  const saveBonanza = async () => {
    const tiers = bonanza.tiers
      .map((t) => ({ directs: parseInt(t.directs, 10), reward: parseFloat(t.reward) }))
      .filter((t) => t.directs > 0 && t.reward > 0);
    if (!tiers.length) return toast.error("Kam se kam ek valid tier daalo (directs & reward > 0)");
    setBonanzaBusy(true);
    try {
      const { data } = await api.post("/admin/bonanza", {
        title: bonanza.title,
        subtitle: bonanza.subtitle,
        deadline: bonanza.deadline,
        tiers,
      }, cfg);
      setBonanza(data);
      toast.success("Bonanza offer updated ✅");
    } catch (e) { guard(e); }
    finally { setBonanzaBusy(false); }
  };

  const downloadBackup = async () => {
    setBackupBusy(true);
    try {
      const res = await api.get("/admin/backup/download", { ...cfg, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tradeskill_backup_${new Date().toISOString().slice(0, 19).replace(/[:T-]/g, "")}.gz`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup download ho gaya ✅");
    } catch (e) { guard(e); } finally { setBackupBusy(false); }
  };

  if (!walletToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: "var(--bg-base)" }} data-testid="adminpanel-wallet-gate">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-5" style={{ background: BLUE_GRAD }}>
          <ShieldCheck size={38} />
        </div>
        <div className="font-display font-black text-[22px]" style={{ color: "var(--ink)" }}>Trade Skill Admin</div>
        <div className="text-[13px] font-semibold mt-2" style={{ color: "var(--text-mute)" }}>
          Admin panel opens only from an authorized wallet.
        </div>
        <button onClick={connectWallet} disabled={connecting}
          className="mt-6 px-8 py-3.5 rounded-2xl text-white font-display font-black text-[16px] disabled:opacity-60"
          style={{ background: BLUE_GRAD, touchAction: "manipulation" }} data-testid="adminpanel-connect-btn">
          {connecting ? "Connecting…" : "Connect Wallet"}
        </button>
        <div className="text-[10.5px] font-semibold mt-4" style={{ color: "var(--text-mute)" }}>
          Mobile par: MetaMask / Trust Wallet ke browser me kholo
        </div>
      </div>
    );
  }

  const Stat = ({ Icon, label, value, accent }) => (
    <div className="flex flex-col gap-1.5 px-3.5 py-3.5" style={CARD}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: accent || BLUE_GRAD }}>
        <Icon size={17} />
      </div>
      <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>{label}</div>
      <div className="font-display font-black text-[20px] tabular-nums leading-none" style={{ color: "var(--ink)" }}>{value}</div>
    </div>
  );

  return (
    <div className="min-h-screen pb-10" style={{ background: "var(--bg-base)" }} data-testid="admin-panel">
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 text-white" style={{ background: BLUE_GRAD }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} data-testid="admin-menu-btn" style={{ touchAction: "manipulation" }}>
            <Menu size={24} />
          </button>
          <div>
            <div className="font-display font-black text-[17px] leading-none">Trade Skill Admin</div>
            <div className="text-[10px] font-bold text-white/75 mt-0.5 capitalize">{MENU.find((m) => m.id === section)?.label}</div>
          </div>
        </div>
        <button onClick={() => loadSection(section)} data-testid="admin-refresh" style={{ touchAction: "manipulation" }}>
          <RefreshCw size={19} />
        </button>
      </div>

      {/* Sidebar */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="w-[270px] h-full flex flex-col text-white" style={{ background: "linear-gradient(180deg,#1D4ED8,#0B2A5C)" }} data-testid="admin-sidebar">
            <div className="flex items-center justify-between px-5 py-5">
              <div className="font-display font-black text-[19px]">Trade Skill<br /><span className="text-[11px] font-bold text-white/70 tracking-widest">ADMIN PANEL</span></div>
              <button onClick={() => setMenuOpen(false)} data-testid="admin-menu-close" style={{ touchAction: "manipulation" }}><X size={22} /></button>
            </div>
            {MENU.map((m) => (
              <button key={m.id}
                onClick={() => {
                  setMenuOpen(false);
                  if (m.id === "lock") { disconnect(); return; }
                  if (m.id === "withdrawals") { nav("/admin/withdrawals"); return; }
                  setSection(m.id);
                }}
                className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-black text-left"
                style={{ background: section === m.id ? "rgba(255,255,255,0.14)" : "transparent", touchAction: "manipulation" }}
                data-testid={`admin-nav-${m.id}`}>
                <m.Icon size={18} /> {m.label}
              </button>
            ))}
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="px-4 pt-4">
        {section === "dashboard" && (
          <div className="grid grid-cols-2 gap-2.5" data-testid="admin-dashboard">
            <Stat Icon={UserPlus} label="Active Users" value={overview?.active_users ?? "…"} />
            <Stat Icon={ArrowDownToLine} label="Pending Payouts" value={overview?.pending_payouts ?? "…"} accent="linear-gradient(135deg,#F59E0B,#D97706)" />
            <Stat Icon={TrendingUp} label="Daily Earning" value={overview ? fmtUSD(overview.daily_earning) : "…"} accent="linear-gradient(135deg,#22C55E,#16A34A)" />
            <Stat Icon={Users} label="Total Users" value={overview?.total_users ?? "…"} />
            <Stat Icon={Wallet} label="Total Deposited" value={overview ? fmtUSD(overview.total_deposited) : "…"} accent="linear-gradient(135deg,#22C55E,#16A34A)" />
            <Stat Icon={ArrowDownToLine} label={`Auto WD ${overview?.auto_withdraw ? "ON" : "OFF"}`} value={overview ? fmtUSD(overview.pending_payout_amount) : "…"} accent={overview?.auto_withdraw ? BLUE_GRAD : "linear-gradient(135deg,#94A3B8,#64748B)"} />
          </div>
        )}

        {section === "users" && (
          <div data-testid="admin-users">
            <div className="flex items-center gap-2 px-3 py-2.5 mb-3" style={CARD}>
              <Search size={16} style={{ color: BLUE }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadSection("users")}
                placeholder="Search UID / email / name" className="flex-1 bg-transparent outline-none text-[13px] font-bold"
                style={{ color: "var(--ink)" }} data-testid="admin-user-search" />
              <button onClick={() => loadSection("users")} className="text-[11px] font-black px-3 py-1.5 rounded-lg text-white" style={{ background: BLUE_GRAD, touchAction: "manipulation" }}>GO</button>
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} onClick={() => openUser(u)} className="flex items-center gap-3 px-3 py-3 cursor-pointer" style={CARD} data-testid={`admin-user-${u.uid}`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,0.12)" }}>
                    <Users size={19} style={{ color: BLUE }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-black text-[15px]" style={{ color: "var(--ink)" }}>{u.uid}</div>
                    <div className="text-[12px] font-bold tabular-nums" style={{ color: "var(--text-mute)" }}>$ {Number(u.balance).toFixed(2)}</div>
                  </div>
                  <span className="text-[11px] font-black px-3 py-1 rounded-full shrink-0"
                    style={u.bot_activated
                      ? { background: "#DCFCE7", color: "#16A34A" }
                      : { background: "#FEE2E2", color: "#DC2626" }}
                    data-testid={`admin-user-status-${u.uid}`}>
                    {u.bot_activated ? "Active" : "Inactive"}
                  </span>
                  <ChevronRight size={18} style={{ color: BLUE }} className="shrink-0" />
                </div>
              ))}
              {users.length === 0 && <div className="text-center text-[12px] py-6" style={{ color: "var(--text-mute)" }}>No users found</div>}
            </div>
          </div>
        )}

        {/* ==== User Details modal ==== */}
        {detail && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55" onClick={() => setDetail(null)} data-testid="admin-user-detail">
            <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" style={{ background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 flex items-center justify-between px-5 py-4 text-white rounded-t-3xl" style={{ background: BLUE_GRAD }}>
                <div className="font-display font-black text-[19px]">User Details</div>
                <button onClick={() => setDetail(null)} data-testid="admin-detail-close" style={{ touchAction: "manipulation" }}><X size={22} /></button>
              </div>
              <div className="px-4 py-4 space-y-2">
                {[
                  { Icon: Calendar, label: "Joining Date", value: detail.created_at ? new Date(detail.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
                  { Icon: Users, label: "Full Name", value: detail.name || "—" },
                  { Icon: Mail, label: "Gmail", value: detail.email },
                  { Icon: Phone, label: "Phone Number", value: detail.mobile || "—" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-3 px-3.5 py-3" style={CARD}>
                    <r.Icon size={18} style={{ color: BLUE }} className="shrink-0" />
                    <div className="text-[12px] font-bold w-[105px] shrink-0" style={{ color: "var(--text-mute)" }}>{r.label}</div>
                    <div className="text-[13px] font-black truncate" style={{ color: "var(--ink)" }}>{r.value}</div>
                  </div>
                ))}
                <div className="flex items-center gap-3 px-3.5 py-3" style={CARD}>
                  <Crown size={18} style={{ color: BLUE }} className="shrink-0" />
                  <div className="text-[12px] font-bold w-[105px] shrink-0" style={{ color: "var(--text-mute)" }}>Current Rank</div>
                  <div className="text-[14px] font-black" style={{ color: BLUE }} data-testid="admin-detail-rank">{detail.rank || "Level 1"}</div>
                </div>

                {[
                  { net: "BEP20", key: "bep20" },
                  { net: "Polygon", key: "polygon" },
                ].map((w) => (
                  <div key={w.key} className="px-3.5 py-3" style={CARD}>
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet size={17} style={{ color: BLUE }} />
                      <span className="text-[13px] font-black" style={{ color: "var(--ink)" }}>{w.net} <span className="font-bold" style={{ color: "var(--text-mute)" }}>Withdrawal Wallet Address</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      {editWallets[w.key] !== null ? (
                        <input value={editWallets[w.key]} onChange={(e) => setEditWallets({ ...editWallets, [w.key]: e.target.value })}
                          placeholder="0x..." className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-[11px] font-mono font-bold outline-none"
                          style={{ background: "var(--surface-3)", border: `1px solid ${BLUE}`, color: "var(--ink)" }}
                          data-testid={`admin-wallet-input-${w.key}`} />
                      ) : (
                        <div className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-[10.5px] font-mono font-bold break-all"
                          style={{ background: "var(--surface-3)", color: "var(--ink)" }} data-testid={`admin-wallet-${w.key}`}>
                          {(detail.withdrawal_addresses || {})[w.net.toUpperCase() === "POLYGON" ? "POLYGON" : "BEP20"] || "Not set"}
                        </div>
                      )}
                      <button onClick={() => setEditWallets({ ...editWallets, [w.key]: editWallets[w.key] === null ? ((detail.withdrawal_addresses || {})[w.key === "polygon" ? "POLYGON" : "BEP20"] || "") : null })}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-black shrink-0"
                        style={{ border: `1.5px solid ${BLUE}`, color: BLUE, touchAction: "manipulation" }}
                        data-testid={`admin-wallet-edit-${w.key}`}>
                        <Pencil size={13} /> {editWallets[w.key] !== null ? "Cancel" : "Edit"}
                      </button>
                    </div>
                  </div>
                ))}

                <button onClick={saveWallets} disabled={detailBusy || (editWallets.bep20 === null && editWallets.polygon === null)}
                  className="w-full rounded-xl py-3.5 text-white font-display font-black text-[16px] disabled:opacity-50"
                  style={{ background: BLUE_GRAD, touchAction: "manipulation" }} data-testid="admin-update-changes">
                  {detailBusy ? "Saving…" : "Update Changes"}
                </button>

                <div className="grid grid-cols-2 gap-2 pb-2">
                  <button onClick={() => blockToggle(true)} disabled={detailBusy}
                    className="flex items-center justify-center gap-1.5 rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50"
                    style={{ border: "1.5px solid #DC2626", color: "#DC2626", touchAction: "manipulation" }} data-testid="admin-block-user">
                    <Ban size={16} /> Block User
                  </button>
                  <button onClick={() => blockToggle(false)} disabled={detailBusy}
                    className="flex items-center justify-center gap-1.5 rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50"
                    style={{ border: "1.5px solid #16A34A", color: "#16A34A", touchAction: "manipulation" }} data-testid="admin-unblock-user">
                    <CheckCircle2 size={16} /> Unblock User
                  </button>
                </div>
                <button onClick={activateBot} disabled={detailBusy || detail.bot_activated}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50 mb-2"
                  style={{ border: "1.5px solid #16A34A", color: detail.bot_activated ? "#16A34A" : "#16A34A", background: detail.bot_activated ? "rgba(22,163,74,0.08)" : "transparent", touchAction: "manipulation" }} data-testid="admin-activate-bot">
                  <Zap size={16} /> {detail.bot_activated ? "Bot Already Active ✓" : "Activate Bot (Free · No Payout)"}
                </button>
                <button onClick={resetPassword} disabled={detailBusy}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50 mb-2"
                  style={{ border: "1.5px solid #2563EB", color: "#2563EB", touchAction: "manipulation" }} data-testid="admin-reset-password">
                  <KeyRound size={16} /> Reset Login Password
                </button>
                <button onClick={changeName} disabled={detailBusy}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50 mb-2"
                  style={{ border: "1.5px solid #0891B2", color: "#0891B2", touchAction: "manipulation" }} data-testid="admin-change-name">
                  <Pencil size={16} /> Change Name
                </button>
                <button onClick={changeEmail} disabled={detailBusy}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50 mb-2"
                  style={{ border: "1.5px solid #7C3AED", color: "#7C3AED", touchAction: "manipulation" }} data-testid="admin-change-email">
                  <Mail size={16} /> Change Email (Gmail)
                </button>
                <button onClick={setTxnPassword} disabled={detailBusy}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50 mb-2"
                  style={{ border: "1.5px solid #EA580C", color: "#EA580C", touchAction: "manipulation" }} data-testid="admin-set-txn-password">
                  <Lock size={16} /> Reset Transaction Password
                </button>
                <button onClick={impersonate} disabled={detailBusy}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50 mb-2 text-white"
                  style={{ background: "linear-gradient(90deg,#B45309,#92400E)", touchAction: "manipulation" }} data-testid="admin-login-as-user">
                  <LogIn size={16} /> Login as this User
                </button>
                {detail.blocked && <div className="text-center text-[11px] font-black pb-3" style={{ color: "#DC2626" }}>⚠ This user is currently BLOCKED</div>}
              </div>
            </div>
          </div>
        )}

        {section === "adjustment" && (
          <div className="px-4 py-5 space-y-3" style={CARD} data-testid="admin-adjustment">
            <div className="font-display font-black text-[16px]" style={{ color: "var(--ink)" }}>Balance Adjustment</div>
            <div className="text-[11px] font-semibold" style={{ color: "var(--text-mute)" }}>Add (+) or deduct (−) money from the user's bot wallet. This adjustment will <b>not show</b> in the user's history.</div>
            {[
              { k: "identifier", ph: "User Email ya UID (TSK100001)" },
              { k: "amount", ph: "Amount (e.g. 50)" },
              { k: "note", ph: "Note (optional)" },
            ].map((f) => (
              <input key={f.k} value={adj[f.k]} onChange={(e) => setAdj({ ...adj, [f.k]: e.target.value })}
                placeholder={f.ph} inputMode={f.k === "amount" ? "decimal" : undefined}
                className="w-full rounded-xl px-3.5 py-3 text-[14px] font-bold outline-none"
                style={{ background: "var(--surface-3)", border: "1px solid rgba(37,99,235,0.25)", color: "var(--ink)" }}
                data-testid={`admin-adj-${f.k}`} />
            ))}
            <div className="flex gap-2.5">
              <button onClick={() => submitAdjust(1)} disabled={adjBusy}
                className="flex-1 rounded-xl py-3 text-white font-display font-black text-[15px] disabled:opacity-60"
                style={{ background: "#16A34A", touchAction: "manipulation" }} data-testid="admin-adj-add">
                {adjBusy ? "…" : "+ Add Fund"}
              </button>
              <button onClick={() => submitAdjust(-1)} disabled={adjBusy}
                className="flex-1 rounded-xl py-3 text-white font-display font-black text-[15px] disabled:opacity-60"
                style={{ background: "#DC2626", touchAction: "manipulation" }} data-testid="admin-adj-deduct">
                {adjBusy ? "…" : "− Deduct Fund"}
              </button>
            </div>
          </div>
        )}

        {section === "deposits" && (
          <div className="space-y-2" data-testid="admin-deposits">
            {deposits.map((d, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5" style={CARD}>
                <div className="min-w-0">
                  <div className="font-display font-black text-[13px] truncate" style={{ color: "var(--ink)" }} data-testid={`admin-deposit-name-${i}`}>{d.name || "—"}</div>
                  <div className="text-[10px] font-semibold truncate" style={{ color: "var(--text-mute)" }}>{d.email}</div>
                  <div className="text-[10px] font-semibold truncate" style={{ color: "var(--text-mute)" }}>{d.note} · {fmtTime(d.created_at)}</div>
                </div>
                <div className="font-display font-black text-[14px] tabular-nums shrink-0 pl-2" style={{ color: "#16A34A" }}>+{fmtUSD(d.amount)}</div>
              </div>
            ))}
            {deposits.length === 0 && <div className="text-center text-[12px] py-6" style={{ color: "var(--text-mute)" }}>No deposits yet</div>}
          </div>
        )}

        {section === "pools" && finance && (
          <div className="space-y-2.5" data-testid="admin-pools">
            {[
              ["Direct Bonus Paid", finance.direct_bonus_paid],
              ["Support Income Paid", finance.support_income_paid],
              ["Activation Royalty Pool", finance.activation_royalty_pool?.total],
              ["Trading Royalty Pool", finance.trading_royalty_pool?.total],
              ["Company Fee (5%)", finance.company_fee_5pct],
              ["Meeting Fee (1%)", finance.physical_meeting_1pct],
              ["Company Reserve", finance.company_reserve],
            ].filter(([, v]) => v !== undefined).map(([label, v]) => (
              <div key={label} className="flex items-center justify-between px-3.5 py-3" style={CARD}>
                <div className="text-[12px] font-black" style={{ color: "var(--ink)" }}>{label}</div>
                <div className="font-display font-black text-[15px] tabular-nums" style={{ color: BLUE }}>{fmtUSD(v || 0)}</div>
              </div>
            ))}
          </div>
        )}

        {section === "settings" && settings && (
          <>
          <div className="px-4 py-4 flex items-center justify-between" style={CARD} data-testid="admin-settings">
            <div>
              <div className="font-display font-black text-[15px]" style={{ color: "var(--ink)" }}>Auto Withdrawal</div>
              <div className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--text-mute)" }}>
                {settings.auto_withdraw ? "ON — withdrawals are auto-paid within seconds" : "OFF — every withdrawal goes for admin approval"}
              </div>
            </div>
            <button onClick={toggleAutoWd} className="w-14 h-8 rounded-full relative transition-colors"
              style={{ background: settings.auto_withdraw ? BLUE : "var(--toggle-off)", touchAction: "manipulation" }}
              data-testid="admin-autowd-toggle">
              <span className="absolute top-1 w-6 h-6 rounded-full bg-white transition-all" style={{ left: settings.auto_withdraw ? "30px" : "4px" }} />
            </button>
          </div>
          <div className="px-4 py-4 mt-3" style={CARD} data-testid="admin-backup-card">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: BLUE_GRAD }}>
                <DatabaseBackup size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-black text-[15px]" style={{ color: "var(--ink)" }}>Database Backup</div>
                <div className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--text-mute)" }}>
                  Download the entire database (users, balance, trades) in one file
                </div>
              </div>
            </div>
            <button onClick={downloadBackup} disabled={backupBusy}
              className="w-full mt-3 py-3 rounded-xl text-white font-display font-black text-[14px] disabled:opacity-60"
              style={{ background: BLUE_GRAD, touchAction: "manipulation" }} data-testid="admin-backup-download-btn">
              {backupBusy ? "Backup ban raha hai..." : "Download Backup"}
            </button>
          </div>
          </>
        )}

        {section === "bonanza" && bonanza && (
          <div className="space-y-3" data-testid="admin-bonanza">
            <div className="px-4 py-4" style={CARD}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg,#E8A804,#FF6F00)" }}>
                  <Gift size={17} />
                </div>
                <div className="font-display font-black text-[15px]" style={{ color: "var(--ink)" }}>Bonanza Offer</div>
              </div>

              <label className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>Title</label>
              <input value={bonanza.title || ""} onChange={(e) => setBonanza({ ...bonanza, title: e.target.value })}
                className="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl text-[13px] font-bold outline-none"
                style={{ background: "var(--bg-base)", border: "1px solid rgba(37,99,235,0.25)", color: "var(--ink)" }}
                data-testid="admin-bonanza-title" />

              <label className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>Subtitle</label>
              <input value={bonanza.subtitle || ""} onChange={(e) => setBonanza({ ...bonanza, subtitle: e.target.value })}
                className="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl text-[13px] font-bold outline-none"
                style={{ background: "var(--bg-base)", border: "1px solid rgba(37,99,235,0.25)", color: "var(--ink)" }}
                data-testid="admin-bonanza-subtitle" />

              <label className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>Deadline (IST)</label>
              <input type="datetime-local" value={toISTInput(bonanza.deadline)}
                onChange={(e) => setBonanza({ ...bonanza, deadline: fromISTInput(e.target.value) })}
                className="w-full mt-1 mb-1 px-3 py-2.5 rounded-xl text-[13px] font-bold outline-none"
                style={{ background: "var(--bg-base)", border: "1px solid rgba(37,99,235,0.25)", color: "var(--ink)" }}
                data-testid="admin-bonanza-deadline" />
              <div className="text-[10px] font-semibold mb-3" style={{ color: "var(--text-mute)" }}>
                Reward auto-credits to users' wallets after this time.
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>Reward Tiers (highest achieved only)</label>
                <button onClick={addTier} className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg text-white"
                  style={{ background: BLUE_GRAD }} data-testid="admin-bonanza-add-tier"><Plus size={12} /> Add</button>
              </div>
              <div className="space-y-2">
                {bonanza.tiers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2" data-testid={`admin-bonanza-tier-${i}`}>
                    <div className="flex-1">
                      <div className="text-[9px] font-bold mb-0.5" style={{ color: "var(--text-mute)" }}>Direct IDs</div>
                      <input type="number" value={t.directs} onChange={(e) => setTier(i, "directs", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-[13px] font-black outline-none"
                        style={{ background: "var(--bg-base)", border: "1px solid rgba(37,99,235,0.25)", color: "var(--ink)" }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[9px] font-bold mb-0.5" style={{ color: "var(--text-mute)" }}>Reward ($)</div>
                      <input type="number" value={t.reward} onChange={(e) => setTier(i, "reward", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-[13px] font-black outline-none"
                        style={{ background: "var(--bg-base)", border: "1px solid rgba(37,99,235,0.25)", color: "var(--ink)" }} />
                    </div>
                    <button onClick={() => removeTier(i)} className="mt-4 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "#FEE2E2", color: "#DC2626" }} data-testid={`admin-bonanza-remove-tier-${i}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={saveBonanza} disabled={bonanzaBusy}
                className="w-full mt-4 py-3 rounded-xl text-white font-display font-black text-[14px] disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#E8A804,#FF6F00)" }} data-testid="admin-bonanza-save-btn">
                {bonanzaBusy ? "Saving..." : "Save Offer"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal (mobile-safe replacement for window.prompt) */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
             style={{ background: "rgba(0,0,0,0.55)" }} data-testid="admin-edit-modal"
             onClick={() => !detailBusy && setEdit(null)}>
          <div className="w-full max-w-sm rounded-2xl p-4" style={{ background: "var(--card, #fff)" }}
               onClick={(e) => e.stopPropagation()}>
            <div className="font-display font-black text-[16px] mb-1" style={{ color: "var(--ink)" }}>{edit.title}</div>
            <div className="text-[11px] font-semibold mb-3" style={{ color: "var(--text-mute)" }}>{edit.label}</div>
            <input
              autoFocus
              type={edit.isPassword ? "text" : (edit.isEmail ? "email" : "text")}
              value={edit.value}
              placeholder={edit.placeholder}
              onChange={(e) => setEdit({ ...edit, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") submitEdit(); }}
              className="w-full px-3 py-3 rounded-xl text-[14px] font-bold outline-none mb-4"
              style={{ background: "var(--bg-base)", border: "1.5px solid rgba(37,99,235,0.3)", color: "var(--ink)" }}
              data-testid="admin-edit-input"
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setEdit(null)} disabled={detailBusy}
                className="rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)", color: "var(--text-mute)" }} data-testid="admin-edit-cancel">
                Cancel
              </button>
              <button onClick={submitEdit} disabled={detailBusy}
                className="rounded-xl py-3 font-display font-black text-[14px] text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }} data-testid="admin-edit-save">
                {detailBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmAct && detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
             style={{ background: "rgba(0,0,0,0.55)" }} data-testid="admin-activate-modal"
             onClick={() => !detailBusy && setConfirmAct(false)}>
          <div className="w-full max-w-sm rounded-2xl p-4" style={{ background: "var(--card, #fff)" }}
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={18} color="#16A34A" />
              <div className="font-display font-black text-[16px]" style={{ color: "var(--ink)" }}>Activate Bot (Free)</div>
            </div>
            <div className="text-[12px] font-semibold mb-4 leading-relaxed" style={{ color: "var(--text-mute)" }}>
              <b>{detail.uid}</b>'s bot — activate for FREE? No reward will be distributed — not direct, difference, support, or pool. The admin bears no loss.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmAct(false)} disabled={detailBusy}
                className="rounded-xl py-3 font-display font-black text-[14px] disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)", color: "var(--text-mute)" }} data-testid="admin-activate-cancel">
                Cancel
              </button>
              <button onClick={doActivateBot} disabled={detailBusy}
                className="rounded-xl py-3 font-display font-black text-[14px] text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#16A34A,#15803D)" }} data-testid="admin-activate-confirm">
                {detailBusy ? "Activating…" : "Activate Bot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
