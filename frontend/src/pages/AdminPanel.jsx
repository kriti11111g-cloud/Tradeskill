import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Menu, X, LayoutDashboard, Users, SlidersHorizontal, Coins, ArrowDownToLine,
  CircleDollarSign, Settings, Lock, ShieldCheck, UserPlus, TrendingUp, Wallet,
  RefreshCw, Search,
} from "lucide-react";
import api from "@/lib/api";
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
    } catch (e) { guard(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletToken, q]);

  useEffect(() => { loadSection(section); }, [section, walletToken]); // eslint-disable-line

  const submitAdjust = async () => {
    if (!adj.identifier || !adj.amount) return toast.error("Email/UID aur amount dalo");
    setAdjBusy(true);
    try {
      const { data } = await api.post("/admin/adjust", { ...adj, amount: parseFloat(adj.amount) }, cfg);
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

  if (!walletToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: "var(--bg-base)" }} data-testid="adminpanel-wallet-gate">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-5" style={{ background: BLUE_GRAD }}>
          <ShieldCheck size={38} />
        </div>
        <div className="font-display font-black text-[22px]" style={{ color: "var(--ink)" }}>Trade Skill Admin</div>
        <div className="text-[13px] font-semibold mt-2" style={{ color: "var(--text-mute)" }}>
          Admin panel sirf authorized wallet se khulta hai.
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
                placeholder="Search email / UID / name" className="flex-1 bg-transparent outline-none text-[13px] font-bold"
                style={{ color: "var(--ink)" }} data-testid="admin-user-search" />
              <button onClick={() => loadSection("users")} className="text-[11px] font-black px-3 py-1.5 rounded-lg text-white" style={{ background: BLUE_GRAD, touchAction: "manipulation" }}>GO</button>
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2.5" style={CARD} data-testid={`admin-user-${u.uid}`}>
                  <div className="min-w-0">
                    <div className="font-display font-black text-[13px] truncate" style={{ color: "var(--ink)" }}>{u.uid} · {u.name || u.email.split("@")[0]}</div>
                    <div className="text-[10px] font-semibold truncate" style={{ color: "var(--text-mute)" }}>{u.email} · {u.rank || "Level 1"}</div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <div className="font-display font-black text-[14px] tabular-nums" style={{ color: "var(--ink)" }}>{fmtUSD(u.balance)}</div>
                    <div className="text-[9px] font-black uppercase" style={{ color: u.activated ? "#16A34A" : "#DC2626" }}>{u.activated ? "● Active" : "● Inactive"}</div>
                  </div>
                </div>
              ))}
              {users.length === 0 && <div className="text-center text-[12px] py-6" style={{ color: "var(--text-mute)" }}>No users found</div>}
            </div>
          </div>
        )}

        {section === "adjustment" && (
          <div className="px-4 py-5 space-y-3" style={CARD} data-testid="admin-adjustment">
            <div className="font-display font-black text-[16px]" style={{ color: "var(--ink)" }}>Balance Adjustment</div>
            <div className="text-[11px] font-semibold" style={{ color: "var(--text-mute)" }}>User ke bot wallet me paisa add (+) ya minus (−) karo. Amount me minus sign use karo debit ke liye.</div>
            {[
              { k: "identifier", ph: "User Email ya UID (TSK100001)" },
              { k: "amount", ph: "Amount (e.g. 50 ya -20)" },
              { k: "note", ph: "Note (optional)" },
            ].map((f) => (
              <input key={f.k} value={adj[f.k]} onChange={(e) => setAdj({ ...adj, [f.k]: e.target.value })}
                placeholder={f.ph} inputMode={f.k === "amount" ? "text" : undefined}
                className="w-full rounded-xl px-3.5 py-3 text-[14px] font-bold outline-none"
                style={{ background: "var(--surface-3)", border: "1px solid rgba(37,99,235,0.25)", color: "var(--ink)" }}
                data-testid={`admin-adj-${f.k}`} />
            ))}
            <button onClick={submitAdjust} disabled={adjBusy}
              className="w-full rounded-xl py-3 text-white font-display font-black text-[15px] disabled:opacity-60"
              style={{ background: BLUE_GRAD, touchAction: "manipulation" }} data-testid="admin-adj-submit">
              {adjBusy ? "Processing…" : "Apply Adjustment"}
            </button>
          </div>
        )}

        {section === "deposits" && (
          <div className="space-y-2" data-testid="admin-deposits">
            {deposits.map((d, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5" style={CARD}>
                <div className="min-w-0">
                  <div className="font-display font-black text-[13px] truncate" style={{ color: "var(--ink)" }}>{d.email}</div>
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
          <div className="px-4 py-4 flex items-center justify-between" style={CARD} data-testid="admin-settings">
            <div>
              <div className="font-display font-black text-[15px]" style={{ color: "var(--ink)" }}>Auto Withdrawal</div>
              <div className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--text-mute)" }}>
                {settings.auto_withdraw ? "ON — withdrawals seconds me auto-pay hote hain" : "OFF — har withdrawal admin approval me jayega"}
              </div>
            </div>
            <button onClick={toggleAutoWd} className="w-14 h-8 rounded-full relative transition-colors"
              style={{ background: settings.auto_withdraw ? BLUE : "var(--toggle-off)", touchAction: "manipulation" }}
              data-testid="admin-autowd-toggle">
              <span className="absolute top-1 w-6 h-6 rounded-full bg-white transition-all" style={{ left: settings.auto_withdraw ? "30px" : "4px" }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
