"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import type { Track } from "@/types";

function formatDuration(ms: number): string {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface TrackRowProps {
  track: Track;
  currentlyPlaying: string | null;
  onPlay: (id: string) => void;
}

export default function TrackRow({ track, currentlyPlaying, onPlay }: TrackRowProps) {
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlaying = currentlyPlaying === track.id;

  // Stop audio when another track starts
  if (!isPlaying && audioRef.current && !audioRef.current.paused) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setProgress(0);
  }

  const handleToggle = useCallback(() => {
    if (!track.previewUrl) return;

    if (isPlaying) {
      audioRef.current?.pause();
      onPlay("");
    } else {
      if (!audioRef.current) {
        const audio = new Audio(track.previewUrl);
        audioRef.current = audio;
        audio.addEventListener("timeupdate", () => {
          setProgress((audio.currentTime / audio.duration) * 100);
        });
        audio.addEventListener("ended", () => {
          setProgress(0);
          onPlay("");
        });
      }
      audioRef.current.play();
      onPlay(track.id);
    }
  }, [isPlaying, track.previewUrl, track.id, onPlay]);

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
        isPlaying ? "bg-[#1DB954]/10 ring-1 ring-[#1DB954]/30" : "hover:bg-white/5"
      }`}
    >
      {/* Rank */}
      <span className="w-5 text-center text-xs text-gray-500 font-mono flex-shrink-0">
        {track.rank}
      </span>

      {/* Album art */}
      <div className="relative flex-shrink-0">
        {track.albumImageUrl ? (
          <Image
            src={track.albumImageUrl}
            alt={track.name}
            width={40}
            height={40}
            className="rounded-md object-cover"
            unoptimized
          />
        ) : (
          <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
        )}
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
            <div className="flex gap-0.5 items-end h-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-0.5 bg-[#1DB954] rounded-full animate-bounce"
                  style={{ height: "100%", animationDelay: `${i * 0.15}s`, animationDuration: "0.7s" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate font-medium">{track.name}</p>
        <p className="text-xs text-gray-400 truncate">{track.artistName}</p>
        {isPlaying && (
          <div className="mt-1 h-0.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1DB954] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {!isPlaying && track.listeners > 0 && (
          <p className="text-xs text-gray-600">{formatListeners(track.listeners)} oyentes</p>
        )}
      </div>

      {/* Duration + controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {track.durationMs > 0 && (
          <span className="text-xs text-gray-600 hidden sm:block">
            {formatDuration(track.durationMs)}
          </span>
        )}

        {/* Play preview (Deezer) */}
        {track.previewUrl ? (
          <button
            onClick={handleToggle}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              isPlaying
                ? "bg-[#1DB954] text-black"
                : "bg-white/10 text-white hover:bg-[#1DB954]/80 hover:text-black"
            }`}
            title={isPlaying ? "Pausar" : "Preview 30s"}
          >
            {isPlaying ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 text-gray-600" title="Sin preview">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" opacity="0.3"/>
            </svg>
          </div>
        )}

        {/* Open on Deezer */}
        {track.deezerUrl && (
          <a
            href={track.deezerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:bg-[#A238FF]/20 hover:text-[#A238FF] transition-colors"
            title="Abrir en Deezer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.944 17.294h3.388v-1.69h-3.388zm0-3.217h3.388v-1.69h-3.388zm0-3.216h3.388V9.17h-3.388zm-4.472 6.433h3.387v-1.69h-3.387zm0-3.217h3.387v-1.69h-3.387zm0-3.216h3.387V9.17h-3.387zm0-3.217h3.387V5.953h-3.387zM10 14.077h3.387v-1.69H10zm0-3.217h3.387V9.17H10zm0-3.216h3.387V5.953H10zm0-3.217h3.387V2.736H10zM5.528 17.294h3.387v-1.69H5.528zm0-3.217h3.387v-1.69H5.528zM1.057 17.294h3.387v-1.69H1.057z"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
