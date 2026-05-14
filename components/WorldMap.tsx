"use client";

import { useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { isAvailable } from "@/lib/playlists";
import { COUNTRY_MAP } from "@/lib/playlists";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const NAME_TO_ALPHA2: Record<string, string> = {
  "Argentina": "AR", "Australia": "AU", "Austria": "AT", "Belgium": "BE",
  "Brazil": "BR", "Bulgaria": "BG", "Canada": "CA", "Chile": "CL",
  "Colombia": "CO", "Croatia": "HR", "Czechia": "CZ", "Denmark": "DK",
  "Ecuador": "EC", "Egypt": "EG", "Estonia": "EE", "Finland": "FI", "France": "FR",
  "Germany": "DE", "Greece": "GR", "Hungary": "HU", "India": "IN",
  "Indonesia": "ID", "Ireland": "IE", "Israel": "IL", "Italy": "IT",
  "Japan": "JP", "Latvia": "LV", "Lithuania": "LT", "Malaysia": "MY",
  "Mexico": "MX", "Netherlands": "NL", "New Zealand": "NZ", "Nigeria": "NG",
  "Norway": "NO", "Pakistan": "PK", "Peru": "PE", "Philippines": "PH",
  "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Russia": "RU",
  "Saudi Arabia": "SA", "South Africa": "ZA", "South Korea": "KR",
  "Spain": "ES", "Sweden": "SE", "Switzerland": "CH", "Taiwan": "TW",
  "Thailand": "TH", "Turkey": "TR", "Ukraine": "UA",
  "United Arab Emirates": "AE", "United Kingdom": "GB",
  "United States of America": "US", "Venezuela": "VE", "Vietnam": "VN",
};

function flagEmoji(code: string) {
  return code.toUpperCase().split("").map((c) =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  ).join("");
}

interface WorldMapProps {
  onCountryClick: (code: string, name: string) => void;
  selectedCode: string | null;
}

export default function WorldMap({ onCountryClick, selectedCode }: WorldMapProps) {
  const [hoveredCode, setHoveredCode]   = useState<string | null>(null);
  const [tooltip, setTooltip]           = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom]                 = useState(1);

  const handleClick = useCallback(
    (geo: { properties: Record<string, string | number | undefined> }) => {
      const geoName = String(geo.properties.name ?? "");
      const alpha2 = NAME_TO_ALPHA2[geoName];
      if (alpha2 && isAvailable(alpha2)) {
        onCountryClick(alpha2, COUNTRY_MAP[alpha2]?.name ?? geoName);
      }
    },
    [onCountryClick]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const zoomIn  = () => setZoom((z) => Math.min(z * 1.5, 8));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.5, 0.8));

  const hoveredName = hoveredCode ? (COUNTRY_MAP[hoveredCode]?.name ?? hoveredCode) : null;

  return (
    <div
      className="w-full h-full select-none relative"
      style={{ background: "#0d1b2a" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setHoveredCode(null); setTooltip(null); }}
    >
      <ComposableMap
        projection="geoNaturalEarth1"
        style={{ width: "100%", height: "100%" }}
        projectionConfig={{ scale: 160 }}
      >
        <ZoomableGroup zoom={zoom} minZoom={0.8} maxZoom={8}
          onMoveEnd={({ zoom: z }) => setZoom(z)}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = String(geo.properties.name ?? "");
                const alpha2  = NAME_TO_ALPHA2[geoName];
                const available = alpha2 ? isAvailable(alpha2) : false;
                const hovered   = hoveredCode === alpha2;
                const selected  = selectedCode === alpha2;

                let fill = "#162032";
                if (available) {
                  if (selected)    fill = "#0ea5e9";
                  else if (hovered) fill = "#38bdf8";
                  else              fill = "#1e4d7b";
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => handleClick(geo)}
                    onMouseEnter={() => alpha2 && setHoveredCode(alpha2)}
                    onMouseLeave={() => setHoveredCode(null)}
                    style={{
                      default: {
                        fill,
                        stroke: "#0d1b2a",
                        strokeWidth: 0.6,
                        outline: "none",
                        cursor: available ? "pointer" : "default",
                        transition: "fill 0.15s ease",
                      },
                      hover: {
                        fill: available ? "#38bdf8" : "#1c2e44",
                        stroke: "#0d1b2a",
                        strokeWidth: 0.6,
                        outline: "none",
                        cursor: available ? "pointer" : "default",
                      },
                      pressed: { fill: "#0ea5e9", outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Hover tooltip */}
      {hoveredCode && hoveredName && tooltip && (
        <div
          className="pointer-events-none absolute z-20 px-3 py-1.5 rounded-lg bg-[#0a1628]/95 border border-white/10 shadow-xl text-sm text-white font-medium flex items-center gap-2 whitespace-nowrap"
          style={{ left: tooltip.x + 14, top: tooltip.y - 36 }}
        >
          <span className="text-base leading-none">{flagEmoji(hoveredCode)}</span>
          {hoveredName}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
        <button
          onClick={zoomIn}
          className="w-8 h-8 rounded-lg bg-[#0a1628]/90 border border-white/10 text-gray-300 hover:text-white hover:border-white/30 flex items-center justify-center text-lg font-bold transition-colors"
          title="Acercar"
        >+</button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 rounded-lg bg-[#0a1628]/90 border border-white/10 text-gray-300 hover:text-white hover:border-white/30 flex items-center justify-center text-lg font-bold transition-colors"
          title="Alejar"
        >−</button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 flex items-center gap-4 text-xs text-gray-400 bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#1e4d7b]" /> Con datos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#162032]" /> Sin datos
        </span>
      </div>
    </div>
  );
}
