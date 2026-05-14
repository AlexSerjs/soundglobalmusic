"use client";

import { useState } from "react";
import Image from "next/image";
import type { Artist } from "@/types";

function formatListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface ArtistCardProps {
  artist: Artist;
  rank: number;
}

export default function ArtistCard({ artist, rank }: ArtistCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden cursor-pointer ${
        expanded
          ? "border-[#1DB954]/40 bg-[#1DB954]/5"
          : "border-white/10 bg-white/5 hover:border-white/20"
      }`}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-3 p-3">
        <span className="text-xs text-gray-500 font-mono w-4 text-center flex-shrink-0">
          {rank}
        </span>

        <div className="relative w-10 h-10 flex-shrink-0">
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1DB954]/40 to-[#1DB954]/10 flex items-center justify-center text-white font-bold text-sm">
              {artist.name[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{artist.name}</p>
          {artist.genres.length > 0 && (
            <p className="text-xs text-gray-400 truncate">{artist.genres[0]}</p>
          )}
        </div>

        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/10">
          <div className="flex gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              {artist.imageUrl && !imgError ? (
                <Image
                  src={artist.imageUrl}
                  alt={artist.name}
                  fill
                  className="rounded-lg object-cover"
                  unoptimized
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-[#1DB954]/40 to-[#1DB954]/10 flex items-center justify-center text-white font-bold text-2xl">
                  {artist.name[0]?.toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Oyentes</p>
                <p className="text-sm text-white font-semibold">{formatListeners(artist.listeners)}</p>
              </div>

              {artist.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {artist.genres.map((g) => (
                    <span key={g} className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="mt-3 flex gap-3">
            <a
              href={artist.lastfmUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm0 2c5.52 0 10 4.48 10 10S17.52 22 12 22 2 17.52 2 12 6.48 2 12 2zm-1 5v6l5 3-1 1.73-6-3.73V7h2z"/>
              </svg>
              Last.fm
            </a>
            {artist.deezerUrl && (
              <a
                href={artist.deezerUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-[#A238FF] hover:underline"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.944 17.294h3.388v-1.69h-3.388zm0-3.217h3.388v-1.69h-3.388zm0-3.216h3.388V9.17h-3.388zm-4.472 6.433h3.387v-1.69h-3.387zm0-3.217h3.387v-1.69h-3.387zm0-3.216h3.387V9.17h-3.387zm0-3.217h3.387V5.953h-3.387zM10 14.077h3.387v-1.69H10zm0-3.217h3.387V9.17H10zm0-3.216h3.387V5.953H10zm0-3.217h3.387V2.736H10zM5.528 17.294h3.387v-1.69H5.528zm0-3.217h3.387v-1.69H5.528zM1.057 17.294h3.387v-1.69H1.057z"/>
                </svg>
                Deezer
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
