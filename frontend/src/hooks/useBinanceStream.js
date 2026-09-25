import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";

/**
 * Subscribes to Binance's official public WebSocket ticker stream and returns the
 * real-time last price + 24h change % for a symbol. Falls back to REST polling
 * if the WebSocket fails.
 *
 * Public streams are free, unauthenticated, and served directly to the browser
 * by Binance — so the price shown here is exactly the same price traders see on
 * binance.com, updated with sub-second latency.
 */
export default function useBinanceStream(symbol, initialPrice = 0) {
  const [price, setPrice] = useState(initialPrice);
  const [change, setChange] = useState(0);
  const [high, setHigh] = useState(0);
  const [low, setLow] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!symbol) return;
    const sym = symbol.toLowerCase();

    const connect = () => {
      try {
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@ticker`);
        wsRef.current = ws;

        ws.onopen = () => { connectedRef.current = true; setConnected(true); };
        ws.onmessage = (evt) => {
          try {
            const d = JSON.parse(evt.data);
            if (d.c) setPrice(parseFloat(d.c));   // c = close/last price
            if (d.P !== undefined) setChange(parseFloat(d.P));
            if (d.h) setHigh(parseFloat(d.h));
            if (d.l) setLow(parseFloat(d.l));
          } catch {}
        };
        ws.onclose = () => {
          connectedRef.current = false;
          setConnected(false);
          // Auto-reconnect with a small backoff
          if (reconnectRef.current) clearTimeout(reconnectRef.current);
          reconnectRef.current = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
      } catch {
        setConnected(false);
      }
    };

    connect();

    // REST fallback: WS blocked/na chale to backend stats se price + 24h change
    const pollStats = async () => {
      if (connectedRef.current) return;
      try {
        const { data } = await api.get(`/market/stats/${symbol.toUpperCase()}`);
        const p = parseFloat(data.lastPrice || data.price || 0);
        const c = parseFloat(data.priceChangePercent ?? data.change_pct ?? 0);
        if (p > 0) setPrice(p);
        if (!Number.isNaN(c)) setChange(c);
        if (data.highPrice) setHigh(parseFloat(data.highPrice));
        if (data.lowPrice) setLow(parseFloat(data.lowPrice));
      } catch {}
    };
    const fallbackTimer = setTimeout(pollStats, 2500);
    const fallbackInterval = setInterval(pollStats, 15000);

    return () => {
      clearTimeout(fallbackTimer);
      clearInterval(fallbackInterval);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch {}
      }
    };
  }, [symbol]);

  return { price, change, high, low, connected };
}
