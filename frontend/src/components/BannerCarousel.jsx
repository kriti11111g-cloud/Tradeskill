import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

/* Home top banner slider — admin-managed images, 5s auto-slide.
   Durga Puja Bonanza slide auto-appears while the offer is live and
   auto-removes once the countdown deadline passes. Tapping it opens /bonanza. */
export const BannerCarousel = () => {
  const nav = useNavigate();
  const [banners, setBanners] = useState([]);
  const [bonanzaActive, setBonanzaActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("tgx_banners_cache") || "null");
      if (Array.isArray(c) && c.length) setBanners(c);
    } catch {}
    api.get("/banners").then(({ data }) => {
      const b = data.banners || [];
      if (b.length) {
        setBanners(b);
        try { localStorage.setItem("tgx_banners_cache", JSON.stringify(b)); } catch {}
      }
    }).catch(() => {});
    api.get("/bonanza").then(({ data }) => setBonanzaActive(!data.ended)).catch(() => {});
  }, []);

  const slides = [
    ...(bonanzaActive
      ? [{ id: "bonanza-slide", image_url: "/durga-puja-slide.png", to: "/bonanza" }]
      : []),
    ...banners,
  ];

  useEffect(() => {
    if (slides.length < 2) return;
    timer.current = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(timer.current);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <div className="relative rounded-2xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }} data-testid="home-banner-carousel">
      {/* Live indicator — blinking green dot */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full"
           style={{ background: "rgba(0,0,0,0.42)", backdropFilter: "blur(4px)" }} data-testid="banner-live-badge">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#22C55E", animation: "tgxBlink 1.2s ease-in-out infinite" }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#22C55E" }} />
        </span>
        <span className="text-[8px] font-black uppercase tracking-wider text-white">Live</span>
      </div>
      <style>{`@keyframes tgxBlink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}`}</style>
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {slides.map((b) => (
          <img
            key={b.id}
            src={b.image_url}
            alt="banner"
            onClick={() => b.to && nav(b.to)}
            className="w-full shrink-0 object-cover"
            style={{ aspectRatio: "1952 / 806", cursor: b.to ? "pointer" : "default" }}
            data-testid={`home-banner-${b.id}`}
          />
        ))}
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5" data-testid="banner-dots">
          {slides.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setIdx(i)}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 18 : 6, height: 6,
                background: i === idx ? "#16A34A" : "rgba(255,255,255,0.75)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              }}
              data-testid={`banner-dot-${i}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
