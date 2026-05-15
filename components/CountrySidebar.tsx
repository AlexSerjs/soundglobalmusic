"use client";

import { useState, useMemo } from "react";
import { COUNTRY_MAP } from "@/lib/playlists";
import { GROQ_COUNTRY_NAMES } from "@/lib/countries";

function flag(code: string): string {
  return code.toUpperCase().split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
}

// Merge Last.fm countries + Groq countries into one sorted list
const COUNTRIES = [
  ...Object.entries(COUNTRY_MAP).map(([code, info]) => ({
    code,
    name: info.name,
    isGroq: false,
  })),
  ...Object.entries(GROQ_COUNTRY_NAMES).map(([code, name]) => ({
    code,
    name,
    isGroq: true,
  })),
].sort((a, b) => a.name.localeCompare(b.name));

interface CountrySidebarProps {
  onCountryClick: (code: string, name: string) => void;
  selectedCode: string | null;
}

export default function CountrySidebar({ onCountryClick, selectedCode }: CountrySidebarProps) {
  const [query, setQuery]       = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const filtered = useMemo(
    () =>
      query.trim()
        ? COUNTRIES.filter((c) =>
            c.name.toLowerCase().includes(query.toLowerCase())
          )
        : COUNTRIES,
    [query]
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 w-10 bg-[#0a1628]/90 backdrop-blur-sm border-r border-white/10 h-full">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-400 hover:text-white transition-colors"
          title="Abrir lista de países"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 flex-shrink-0 bg-[#0a1628]/90 backdrop-blur-sm border-r border-white/10 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">
          Países ({COUNTRIES.length})
        </p>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-500 hover:text-gray-200 transition-colors"
          title="Colapsar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="relative">
          <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar país..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#38bdf8]/50 focus:bg-white/8 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-2.5 text-gray-500 hover:text-gray-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-8">Sin resultados</p>
        ) : (
          filtered.map((country) => {
            const isSelected = selectedCode === country.code;
            return (
              <button
                key={country.code}
                onClick={() => onCountryClick(country.code, country.name)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors mb-0.5 ${
                  isSelected
                    ? "bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-base leading-none flex-shrink-0">{flag(country.code)}</span>
                <span className="text-sm truncate flex-1">{country.name}</span>
                {country.isGroq && !isSelected && (
                  <span className="text-[9px] text-cyan-500/50 flex-shrink-0 font-medium">AI</span>
                )}
                {isSelected && (
                  <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
