import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

/* Remove all USER-SCOPED cached data from localStorage so that switching
   accounts on the same device never shows the previous user's data. Keeps
   device-level prefs (theme) and global content (banners). */
function clearUserCaches() {
  try {
    const exact = [
      "tgx_trade_cache", "tgx_wallet_cache", "tgx_revenue_cache",
      "tgx_market_cache", "hubx-rank-level", "tgx_admin_wallet_token",
    ];
    exact.forEach((k) => localStorage.removeItem(k));
    // Prefix-based caches (useCachedState -> tgx_cache_*, per-user avatars -> ts_avatar_*)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("tgx_cache_") || key.startsWith("ts_avatar_"))) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    clearUserCaches();
    localStorage.setItem("tgx_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    clearUserCaches();
    localStorage.setItem("tgx_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    clearUserCaches();
    localStorage.removeItem("tgx_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
