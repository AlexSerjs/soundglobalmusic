"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import type { SceneArtist } from "@/app/api/country/[code]/scene/route";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M oyentes`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K oyentes`;
  return `${n} oyentes`;
}

interface Props {
  artist: SceneArtist;
  currentlyPlaying: string | null;
  onPlay: (id: string) => void;
}

export default function ArtistWithTrack({ artist, currentlyPlaying, onPlay }: Props) {
  const [imgError, setImgError] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const trackId = `scene-${artist.name}`;
  const isPlaying = currentlyPlaying === trackId;

  // Stop when another track starts
  if (!isPlaying && audioRef.current && !audioRef.current.paused) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setProgress(0);
  }

  const handleToggle = () => {
    if (!artist.topTrack?.previewUrl) return;
    if (isPlaying) {
      audioRef.current?.pause();
      onPlay("");
    } else {
      if (!audioRef.current) {
        const a = new Audio(artist.topTrack.previewUrl);
        audioRef.current = a;
        a.addEventListener("timeupdate", () =>
          setProgress((a.currentTime / a.duration) * 100)
        );
        a.addEventListener("ended", () => { setProgress(0); onPlay(""); });
      }
      audioRef.current.play();
      onPlay(trackId);
    }
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isPlaying ? "border-[#38bdf8]/40 bg-[#38bdf8]/5" : "border-white/10 bg-white/5"
    }`}>
      <div className="flex items-center gap-3 p-3">
        {/* Artist photo */}
        <div className="relative w-12 h-12 flex-shrink-0">
          {artist.imageUrl && !imgError ? (
            <Image
              src={artist.imageUrl}
              alt={artist.name}
              fill
              className="rounded-full object-cover"
              unoptimized
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#38bdf8]/30 to-[#38bdf8]/10 flex items-center justify-center text-white font-bold text-lg">
              {artist.name[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Artist info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-semibold truncate">{artist.name}</p>
          <p className="text-xs text-gray-500">{fmt(artist.listeners)}</p>
          {artist.genres.length > 0 && (
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {artist.genres.slice(0, 2).map((g) => (
                <span key={g} className="text-xs bg-white/10 text-gray-400 px-1.5 py-0.5 rounded-full">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="flex gap-1 flex-shrink-0">
          {artist.deezerUrl && (
            <a href={artist.deezerUrl} target="_blank" rel="noopener noreferrer"
              className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-[#A238FF] transition-colors"
              title="Ver en Deezer"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 14" fill="currentColor">
                <rect x="0" y="8" width="3" height="6" rx="0.5"/>
                <rect x="4" y="5" width="3" height="9" rx="0.5"/>
                <rect x="8" y="2" width="3" height="12" rx="0.5"/>
                <rect x="12" y="0" width="3" height="14" rx="0.5"/>
                <rect x="16" y="3" width="3" height="11" rx="0.5"/>
                <rect x="20" y="6" width="3" height="8" rx="0.5"/>
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Top song row */}
      {artist.topTrack && (
        <div className={`flex items-center gap-3 px-3 pb-3 pt-1 border-t border-white/5`}>
          {/* Album art */}
          <div className="relative w-8 h-8 flex-shrink-0">
            {artist.topTrack.albumImageUrl ? (
              <Image
                src={artist.topTrack.albumImageUrl}
                alt={artist.topTrack.name}
                fill
                className="rounded object-cover"
                unoptimized
              />
            ) : (
              <div className="w-8 h-8 rounded bg-white/10" />
            )}
          </div>

          {/* Song name + progress */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-300 truncate">
              🎵 {artist.topTrack.name}
            </p>
            {isPlaying && (
              <div className="mt-1 h-0.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#38bdf8] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {/* Play button */}
          {artist.topTrack.previewUrl ? (
            <button
              onClick={handleToggle}
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                isPlaying
                  ? "bg-[#38bdf8] text-[#0d1b2a]"
                  : "bg-white/10 text-gray-400 hover:bg-[#38bdf8]/80 hover:text-white"
              }`}
              title={isPlaying ? "Pausar" : "Escuchar 30s"}
            >
              {isPlaying ? (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
              ) : (
                <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              )}
            </button>
          ) : (
            artist.topTrack.deezerUrl ? (
              <a
                href={artist.topTrack.deezerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-[#A238FF] transition-colors"
                title="Ver en Deezer"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
