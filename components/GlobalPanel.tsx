"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import type { GlobalData, Track } from "@/types";

function formatListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function GlobalPanel() {
  const [data, setData]       = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/global")
      .then((r) => r.json())
      .then((d) => setData(d as GlobalData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePlay = (track: Track) => {
    if (!track.previewUrl) return;

    if (playing === track.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }

    audioRef.current?.pause();
    const a = new Audio(track.previewUrl);
    audioRef.current = a;
    a.addEventListener("timeupdate", () => {
      setProgress((p) => ({ ...p, [track.id]: (a.currentTime / a.duration) * 100 }));
    });
    a.addEventListener("ended", () => setPlaying(null));
    a.play();
    setPlaying(track.id);
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center pt-4 gap-3 w-10 bg-[#0a1628]/90 backdrop-blur-sm border-l border-white/10 h-full flex-shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-400 hover:text-white transition-colors"
          title="Top Global 50"
        >
          <span className="text-lg">🌍</span>
        </button>
        <div className="flex flex-col gap-1 items-center">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-[#38bdf8]/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-80 flex-shrink-0 bg-[#0a1628]/90 backdrop-blur-sm border-l border-white/10 h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌍</span>
          <div>
            <p className="text-sm font-bold text-white">Top 50 Global</p>
            <p className="text-xs text-gray-500">Actualizado cada hora · Last.fm</p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-500 hover:text-gray-200 transition-colors"
          title="Colapsar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin"/>
          </div>
        )}

        {!loading && data?.topTracks.map((track, i) => {
          const isPlaying = playing === track.id;
          const prog = progress[track.id] ?? 0;

          return (
            <div
              key={track.id}
              className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg transition-colors group ${
                isPlaying ? "bg-[#38bdf8]/10 ring-1 ring-[#38bdf8]/20" : "hover:bg-white/5"
              }`}
            >
              {/* Rank */}
              <span className={`w-5 text-center text-xs font-mono flex-shrink-0 ${
                i < 3 ? "text-[#38bdf8] font-bold" : "text-gray-600"
              }`}>
                {i + 1}
              </span>

              {/* Album art */}
              <div className="relative flex-shrink-0 w-9 h-9">
                {track.albumImageUrl ? (
                  <Image
                    src={track.albumImageUrl}
                    alt={track.name}
                    fill
                    className="rounded object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute inset-0 flex items-end justify-center bg-black/40 rounded pb-1 gap-0.5">
                    {[0,1,2].map((j) => (
                      <div key={j} className="w-0.5 bg-[#38bdf8] rounded-full animate-bounce"
                        style={{ height: "8px", animationDelay: `${j * 0.15}s`, animationDuration: "0.6s" }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">{track.name}</p>
                <p className="text-xs text-gray-500 truncate">{track.artistName}</p>
                {isPlaying ? (
                  <div className="mt-1 h-0.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-[#38bdf8] transition-all duration-200" style={{ width: `${prog}%` }}/>
                  </div>
                ) : (
                  track.listeners > 0 && (
                    <p className="text-xs text-gray-700">{formatListeners(track.listeners)}</p>
                  )
                )}
              </div>

              {/* Duration + play */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!isPlaying && track.durationMs > 0 && (
                  <span className="text-xs text-gray-700 hidden group-hover:block">
                    {formatDuration(track.durationMs)}
                  </span>
                )}
                {track.previewUrl ? (
                  <button
                    onClick={() => handlePlay(track)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      isPlaying
                        ? "bg-[#38bdf8] text-[#0d1b2a]"
                        : "bg-white/0 group-hover:bg-white/10 text-gray-500 group-hover:text-white"
                    }`}
                  >
                    {isPlaying ? (
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                      </svg>
                    ) : (
                      <svg className="w-2.5 h-2.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <polygon points="5,3 19,12 5,21"/>
                      </svg>
                    )}
                  </button>
                ) : (
                  track.deezerUrl && (
                    <a
                      href={track.deezerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-gray-700 hover:text-[#A238FF] transition-colors opacity-0 group-hover:opacity-100"
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
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-white/10 flex-shrink-0">
        <p className="text-xs text-gray-700 text-center">
          {data ? `${data.topTracks.length} canciones · Previews via Deezer` : "Cargando..."}
        </p>
      </div>
    </div>
  );
}
