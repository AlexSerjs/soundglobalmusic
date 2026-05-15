"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import CountryModal from "@/components/CountryModal";
import CountrySidebar from "@/components/CountrySidebar";
import GlobalPanel from "@/components/GlobalPanel";
import PoweredBy from "@/components/PoweredBy";

const WorldMap = dynamic(() => import("@/components/WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#0d1b2a" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [selectedCountry, setSelectedCountry]   = useState<{ code: string; name: string } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen]     = useState(false);
  const [musicPlaying, setMusicPlaying]           = useState(false);
  const [musicMuted, setMusicMuted]               = useState(false);

  // FAB glitch refs — note: these go on INNER divs, not the absolute wrapper
  const fabSidebarRef = useRef<HTMLDivElement>(null);
  const fabPanelRef   = useRef<HTMLDivElement>(null);

  // Intro music
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let played = false;
    let fadeIn: ReturnType<typeof setInterval>;
    let fadeOut: ReturnType<typeof setInterval>;
    let stopTimer: ReturnType<typeof setTimeout>;

    const startMusic = async () => {
      if (played) return;
      played = true;
      try {
        const res = await fetch("/api/intro-track");
        if (!res.ok) return;
        const { preview } = await res.json();
        if (!preview) return;

        const audio = new Audio(preview);
        audioRef.current = audio;
        audio.volume = 0;

        await audio.play();
        setMusicPlaying(true);

        // Fade in to 0.22 over ~2s
        let vol = 0;
        fadeIn = setInterval(() => {
          vol = Math.min(vol + 0.02, 0.22);
          if (audioRef.current) audioRef.current.volume = vol;
          if (vol >= 0.22) clearInterval(fadeIn);
        }, 90);

        // Start fade-out after 20s
        stopTimer = setTimeout(() => {
          let v = audioRef.current?.volume ?? 0.22;
          fadeOut = setInterval(() => {
            v = Math.max(v - 0.015, 0);
            if (audioRef.current) audioRef.current.volume = v;
            if (v <= 0) {
              clearInterval(fadeOut);
              audioRef.current?.pause();
              setMusicPlaying(false);
            }
          }, 90);
        }, 20000);
      } catch {
        // autoplay blocked or network error — silent fail
      }
    };

    // Try autoplay immediately
    startMusic();

    // Fallback: trigger on first user interaction (mobile autoplay policy)
    const onInteract = () => {
      startMusic();
      document.removeEventListener("click", onInteract);
      document.removeEventListener("touchstart", onInteract);
    };
    document.addEventListener("click", onInteract);
    document.addEventListener("touchstart", onInteract);

    return () => {
      clearInterval(fadeIn);
      clearInterval(fadeOut);
      clearTimeout(stopTimer);
      audioRef.current?.pause();
      document.removeEventListener("click", onInteract);
      document.removeEventListener("touchstart", onInteract);
    };
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const next = !musicMuted;
    audioRef.current.muted = next;
    setMusicMuted(next);
  }, [musicMuted]);

  // Random glitch on FAB buttons
  useEffect(() => {
    const refs = [fabSidebarRef, fabPanelRef];
    const trigger = () => {
      const ref = refs[Math.floor(Math.random() * refs.length)];
      if (ref.current) {
        ref.current.classList.add("glitching");
        setTimeout(() => ref.current?.classList.remove("glitching"), 600);
      }
      setTimeout(trigger, 2000 + Math.random() * 5000);
    };
    const t = setTimeout(trigger, 1000 + Math.random() * 3000);
    return () => clearTimeout(t);
  }, []);

  const handleCountryClick = useCallback((code: string, name: string) => {
    setSelectedCountry({ code, name });
    setMobileSidebarOpen(false);
  }, []);

  const handleClose = useCallback(() => setSelectedCountry(null), []);
  const closeDrawers = useCallback(() => {
    setMobileSidebarOpen(false);
    setMobilePanelOpen(false);
  }, []);

  return (
    <main className="flex w-screen h-screen overflow-hidden" style={{ background: "#0d1b2a" }}>

      {/* Mobile backdrop */}
      {(mobileSidebarOpen || mobilePanelOpen) && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
          onClick={closeDrawers}
        />
      )}

      {/* Left sidebar — desktop always visible, mobile slide-in drawer */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-40
        transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <CountrySidebar
          onCountryClick={handleCountryClick}
          selectedCode={selectedCountry?.code ?? null}
        />
      </div>

      {/* Center: header + map */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 py-2.5 bg-[#0a1628]/80 backdrop-blur-sm border-b border-white/10 flex-shrink-0 z-20 relative">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎵</span>
            <span className="text-white font-bold text-lg tracking-tight">SoundGlobal</span>
            <span className="text-gray-500 text-xs hidden sm:block">by theserjs</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <PoweredBy />
            {/* Music toggle — only shows while audio is active */}
            {musicPlaying && (
              <button
                onClick={toggleMute}
                title={musicMuted ? "Activar música" : "Silenciar música"}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                {musicMuted ? (
                  // Speaker off
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
                  </svg>
                ) : (
                  // Speaker on with waves
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-4-4H5a1 1 0 01-1-1v-2a1 1 0 011-1h3l4-4z"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 relative">
          <WorldMap
            onCountryClick={handleCountryClick}
            selectedCode={selectedCountry?.code ?? null}
          />

          {/* Mobile FAB — top strip: open countries sidebar
              IMPORTANT: absolute wrapper is separate from powered-logo wrapper
              to avoid position:relative in .powered-logo overriding position:absolute */}
          <div className="md:hidden absolute top-3 left-4 z-10">
            <div ref={fabSidebarRef} className="powered-logo">
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-gray-300 hover:text-white text-sm font-medium backdrop-blur-sm transition-colors"
                onClick={() => { setMobileSidebarOpen(true); setMobilePanelOpen(false); }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
                Países
              </button>
              <div className="glitch-layer glitch-red" aria-hidden>
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-sm font-medium whitespace-nowrap pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                  </svg>
                  Países
                </button>
              </div>
              <div className="glitch-layer glitch-cyan" aria-hidden>
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-sm font-medium whitespace-nowrap pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                  </svg>
                  Países
                </button>
              </div>
            </div>
          </div>

          {/* Mobile FAB — bottom strip: open global panel */}
          <div className="md:hidden absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
            <div ref={fabPanelRef} className="powered-logo">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-gray-300 hover:text-white text-sm font-medium backdrop-blur-sm transition-colors whitespace-nowrap"
                onClick={() => { setMobilePanelOpen(true); setMobileSidebarOpen(false); }}
              >
                <span>🌍</span>
                Top 50 Global
              </button>
              <div className="glitch-layer glitch-red" aria-hidden>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-sm font-medium whitespace-nowrap pointer-events-none">
                  <span>🌍</span>
                  Top 50 Global
                </button>
              </div>
              <div className="glitch-layer glitch-cyan" aria-hidden>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-sm font-medium whitespace-nowrap pointer-events-none">
                  <span>🌍</span>
                  Top 50 Global
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — desktop always visible, mobile slide-in drawer */}
      <div className={`
        fixed md:relative inset-y-0 right-0 z-40
        transition-transform duration-300 ease-in-out
        ${mobilePanelOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}>
        <GlobalPanel />
      </div>

      {/* Modal */}
      {selectedCountry && (
        <CountryModal
          countryCode={selectedCountry.code}
          countryName={selectedCountry.name}
          onClose={handleClose}
        />
      )}
    </main>
  );
}
