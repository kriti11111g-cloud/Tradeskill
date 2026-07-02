import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import BindAPI from "@/pages/BindAPI";
import TradingPair from "@/pages/TradingPair";
import Wallet from "@/pages/Wallet";
import Transactions from "@/pages/Transactions";
import Trades from "@/pages/Trades";
import Revenue from "@/pages/Revenue";
import Referral from "@/pages/Referral";
import Rewards from "@/pages/Rewards";
import News from "@/pages/News";
import Guide from "@/pages/Guide";
import Profile from "@/pages/Profile";
import Market from "@/pages/Market";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#0F1524",
              color: "#fff",
              border: "1px solid rgba(0,240,255,0.2)",
              fontFamily: "Outfit, sans-serif",
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/market" element={<Market />} />
            <Route path="/bind-api" element={<BindAPI />} />
            <Route path="/pair/:symbol" element={<TradingPair />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/revenue" element={<Revenue />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/news" element={<News />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
