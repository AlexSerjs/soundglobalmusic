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

// ── Now-Playing pill ────────────────────────────────────────────────────────
const EQ_DELAYS = [0, 0.18, 0.32, 0.1];

function NowPlayingPill({
  isPlaying,
  onToggle,
  onNext,
  hasNext,
  title,
}: {
  isPlaying: boolean;
  onToggle: () => void;
  onNext: () => void;
  hasNext: boolean;
  title: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-[7px] rounded-xl bg-[#0a1628]/90 border border-white/15 backdrop-blur-sm select-none">
      {/* Animated equalizer bars */}
      <div className="flex items-end gap-[2px] h-3.5 flex-shrink-0">
        {EQ_DELAYS.map((delay, i) => (
          <div
            key={i}
            className="w-[2px] rounded-full bg-[#38bdf8]"
            style={{
              height: "100%",
              transformOrigin: "bottom",
              transform: isPlaying ? undefined : "scaleY(0.2)",
              opacity: isPlaying ? 1 : 0.35,
              animation: isPlaying
                ? `eq-bar 0.75s ease-in-out infinite ${delay}s`
                : "none",
            }}
          />
        ))}
      </div>

      {/* Track title */}
      <span className="text-[#38bdf8] text-[10px] font-semibold tracking-wide truncate max-w-[88px] leading-none">
        {title}
      </span>

      {/* Play / Pause */}
      <button
        onClick={onToggle}
        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors ml-0.5"
        title={isPlaying ? "Pausar" : "Reproducir"}
      >
        {isPlaying ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6"  y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Next track */}
      {hasNext && (
        <button
          onClick={onNext}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
          title="Siguiente canción"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Home() {
  const [selectedCountry, setSelectedCountry]     = useState<{ code: string; name: string } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen]     = useState(false);

  // Audio state
  const [audioReady, setAudioReady] = useState(false);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [trackTitle, setTrackTitle] = useState("Waiting for Love");
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const userPausedRef  = useRef(false);   // true only when user manually paused

  // Playlist state (refs so audio callbacks always see latest value)
  type IntroTrack = { title: string; artist: string; preview: string };
  const playlistRef    = useRef<IntroTrack[]>([]);
  const playIndexRef   = useRef(0);
  const [hasNext, setHasNext] = useState(false);

  // Swap the audio element to a new track URL and auto-play it
  const loadTrack = useCallback((track: IntroTrack, autoplay: boolean) => {
    const prev = audioRef.current;
    if (prev) { prev.pause(); prev.src = ""; }

    if (!track.preview) return;

    const audio = new Audio(track.preview);
    audio.volume = 1.0;
    audioRef.current = audio;

    setTrackTitle(track.title ?? track.artist ?? "");

    audio.addEventListener("play",  () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));
    // On end: just pause — user decides when to go next
    audio.addEventListener("ended", () => { setIsPlaying(false); });

    if (autoplay) {
      audio.muted = true;
      audio.play().then(() => { audio.muted = false; }).catch(() => {});
    }
  }, []);

  // Load intro playlist and wire up audio
  useEffect(() => {
    const setup = async () => {
      try {
        const res = await fetch("/api/intro-playlist-public");
        if (!res.ok) return;
        const { playlist, startIndex } = await res.json() as {
          playlist: IntroTrack[];
          startIndex: number;
        };
        if (!playlist?.length) return;

        playlistRef.current  = playlist;
        playIndexRef.current = startIndex;
        setHasNext(playlist.length > 1);
        setAudioReady(true);

        loadTrack(playlist[startIndex], true);
      } catch {
        // silent
      }
    };

    setup();

    // Mobile autoplay fallback: start on first user interaction if not manually paused
    const onInteract = () => {
      const audio = audioRef.current;
      if (audio && audio.paused && !userPausedRef.current) {
        audio.play().catch(() => {});
      }
      document.removeEventListener("click",      onInteract);
      document.removeEventListener("touchstart", onInteract);
    };
    document.addEventListener("click",      onInteract);
    document.addEventListener("touchstart", onInteract);

    return () => {
      audioRef.current?.pause();
      document.removeEventListener("click",      onInteract);
      document.removeEventListener("touchstart", onInteract);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      userPausedRef.current = false;
      if (audio.ended) audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      audio.pause();
    }
  }, []);

  const playNextTrack = useCallback(() => {
    const playlist = playlistRef.current;
    if (!playlist.length) return;
    const nextIndex = (playIndexRef.current + 1) % playlist.length;
    playIndexRef.current = nextIndex;
    userPausedRef.current = false;
    loadTrack(playlist[nextIndex], true);
  }, [loadTrack]);

  // FAB glitch refs (go on inner powered-logo divs, NOT the absolute wrapper)
  const fabSidebarRef = useRef<HTMLDivElement>(null);
  const fabPanelRef   = useRef<HTMLDivElement>(null);

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

  const handleClose    = useCallback(() => setSelectedCountry(null), []);
  const closeDrawers   = useCallback(() => {
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

      {/* Left sidebar */}
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

          {/* Left: logo + desktop now-playing */}
          <div className="flex items-center gap-2">
            <span className="text-xl">🎵</span>
            <span className="text-white font-bold text-lg tracking-tight">SoundGlobal</span>
            <span className="text-gray-500 text-xs hidden sm:block">by theserjs</span>
            {/* Desktop now-playing — hidden on mobile (mobile version is in map area) */}
            {audioReady && (
              <div className="hidden md:block ml-1">
                <NowPlayingPill
                  isPlaying={isPlaying}
                  onToggle={togglePlay}
                  onNext={playNextTrack}
                  hasNext={hasNext}
                  title={trackTitle}
                />
              </div>
            )}
          </div>

          <PoweredBy />
        </header>

        <div className="flex-1 relative">
          <WorldMap
            onCountryClick={handleCountryClick}
            selectedCode={selectedCountry?.code ?? null}
          />

          {/* Mobile top strip: [Países] [Now Playing]
              Outer div is the absolute positioner — inner powered-logo handles glitch.
              Separating them is critical: .powered-logo sets position:relative which
              would override Tailwind's absolute if they were on the same element. */}
          <div className="md:hidden absolute top-3 left-4 right-16 z-10 flex items-center gap-2">
            {/* Países FAB */}
            <div ref={fabSidebarRef} className="powered-logo flex-shrink-0">
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
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-sm font-medium pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                  </svg>
                  Países
                </button>
              </div>
              <div className="glitch-layer glitch-cyan" aria-hidden>
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-sm font-medium pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                  </svg>
                  Países
                </button>
              </div>
            </div>

            {/* Mobile now-playing — right of Países */}
            {audioReady && (
              <NowPlayingPill
                isPlaying={isPlaying}
                onToggle={togglePlay}
                onNext={playNextTrack}
                hasNext={hasNext}
                title={trackTitle}
              />
            )}
          </div>

          {/* Mobile bottom FAB: Top 50 Global */}
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

      {/* Right panel */}
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
