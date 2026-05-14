"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ArtistCard from "./ArtistCard";
import TrackRow from "./TrackRow";
import ArtistWithTrack from "./ArtistWithTrack";
import type { CountryData } from "@/types";
import type { SceneArtist } from "@/app/api/country/[code]/scene/route";

type Tab = "artists" | "tracks" | "scene";

interface CountryModalProps {
  countryCode: string;
  countryName: string;
  onClose: () => void;
}

export default function CountryModal({ countryCode, countryName, onClose }: CountryModalProps) {
  const [activeTab, setActiveTab]       = useState<Tab>("artists");
  const [countryData, setCountryData]   = useState<CountryData | null>(null);
  const [sceneArtists, setSceneArtists] = useState<SceneArtist[] | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string>("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setCountryData(null);
    setSceneArtists(null);
    setCurrentlyPlaying("");
    setActiveTab("artists");

    fetch(`/api/country/${countryCode}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCountryData(d as CountryData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [countryCode]);

  // Lazy-load scene only when that tab is clicked
  useEffect(() => {
    if (activeTab !== "scene" || sceneArtists !== null) return;
    setSceneLoading(true);
    fetch(`/api/country/${countryCode}/scene`)
      .then((r) => r.json())
      .then((d) => setSceneArtists(d.artists ?? []))
      .catch(() => setSceneArtists([]))
      .finally(() => setSceneLoading(false));
  }, [activeTab, countryCode, sceneArtists]);

  const handlePlay = useCallback((id: string) => setCurrentlyPlaying(id), []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const flagEmoji = countryCode.toUpperCase().split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "artists", label: "Top Artistas",   icon: "🎤" },
    { id: "tracks",  label: "Lo más popular", icon: "🎵" },
    { id: "scene",   label: "Escena Local",   icon: "🏠" },
  ];

  const Spinner = () => (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <div className="w-8 h-8 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin"/>
      <p className="text-gray-500 text-sm">Cargando...</p>
    </div>
  );

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg bg-[#0e1f35] rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{flagEmoji}</span>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{countryName}</h2>
              <p className="text-gray-500 text-xs">Last.fm · Deezer · datos en tiempo real</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-2 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#38bdf8] text-[#38bdf8]"
                  : "border-transparent text-gray-500 hover:text-gray-200"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Top Artistas (Last.fm popularity in country) ─────────────── */}
          {activeTab === "artists" && (
            loading ? <Spinner /> : error ? (
              <p className="text-center text-gray-500 py-10 text-sm">{error}</p>
            ) : countryData ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">
                  Más escuchados en {countryName}
                </p>
                {countryData.topArtists.map((artist, i) => (
                  <ArtistCard key={artist.id} artist={artist} rank={i + 1} />
                ))}
              </div>
            ) : null
          )}

          {/* ── Top Tracks ───────────────────────────────────────────────── */}
          {activeTab === "tracks" && (
            loading ? <Spinner /> : error ? (
              <p className="text-center text-gray-500 py-10 text-sm">{error}</p>
            ) : countryData ? (
              <div className="space-y-1">
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">
                  Top 10 canciones · Preview via Deezer
                </p>
                {countryData.topTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    currentlyPlaying={currentlyPlaying}
                    onPlay={handlePlay}
                  />
                ))}
              </div>
            ) : null
          )}

          {/* ── Escena Local ─────────────────────────────────────────────── */}
          {activeTab === "scene" && (
            sceneLoading ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="w-8 h-8 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin"/>
                <p className="text-gray-500 text-sm">Buscando artistas de {countryName}...</p>
              </div>
            ) : sceneArtists !== null ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">
                  Artistas populares de {countryName} · Su canción más escuchada
                </p>
                {sceneArtists.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-10">
                    Sin datos para este país
                  </p>
                ) : (
                  sceneArtists.map((artist) => (
                    <ArtistWithTrack
                      key={artist.name}
                      artist={artist}
                      currentlyPlaying={currentlyPlaying}
                      onPlay={handlePlay}
                    />
                  ))
                )}
              </div>
            ) : null
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-white/10 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-700">Caché 6h · Previews via Deezer</p>
          {countryData && (
            <span className="text-xs text-gray-700">
              {new Date(countryData.cachedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
