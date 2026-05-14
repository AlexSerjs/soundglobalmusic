"use client";

import { useState, useCallback } from "react";
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
          <PoweredBy />
        </header>

        <div className="flex-1 relative">
          <WorldMap
            onCountryClick={handleCountryClick}
            selectedCode={selectedCountry?.code ?? null}
          />

          {/* Mobile FAB — top strip: open countries sidebar */}
          <button
            className="md:hidden absolute top-3 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-gray-300 hover:text-white text-sm font-medium backdrop-blur-sm transition-colors"
            onClick={() => { setMobileSidebarOpen(true); setMobilePanelOpen(false); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
            Países
          </button>

          {/* Mobile FAB — bottom strip: open global panel */}
          <button
            className="md:hidden absolute bottom-14 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0a1628]/90 border border-white/15 text-gray-300 hover:text-white text-sm font-medium backdrop-blur-sm transition-colors whitespace-nowrap"
            onClick={() => { setMobilePanelOpen(true); setMobileSidebarOpen(false); }}
          >
            <span>🌍</span>
            Top 50 Global
          </button>
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
