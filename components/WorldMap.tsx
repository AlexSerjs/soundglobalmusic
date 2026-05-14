"use client";

import { useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { isAvailable } from "@/lib/playlists";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// topojson name → ISO alpha-2
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

interface WorldMapProps {
  onCountryClick: (code: string, name: string) => void;
  selectedCode: string | null;
}

export default function WorldMap({ onCountryClick, selectedCode }: WorldMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const handleClick = useCallback(
    (geo: { properties: Record<string, string | number | undefined> }) => {
      const geoName = String(geo.properties.name ?? "");
      const alpha2 = NAME_TO_ALPHA2[geoName];
      if (alpha2 && isAvailable(alpha2)) {
        onCountryClick(alpha2, geoName);
      }
    },
    [onCountryClick]
  );

  return (
    <div className="w-full h-full select-none" style={{ background: "#0d1b2a" }}>
      <ComposableMap
        projection="geoNaturalEarth1"
        style={{ width: "100%", height: "100%" }}
        projectionConfig={{ scale: 160 }}
      >
        <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={8}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = String(geo.properties.name ?? "");
                const alpha2 = NAME_TO_ALPHA2[geoName];
                const available = alpha2 ? isAvailable(alpha2) : false;
                const hovered = hoveredCountry === alpha2;
                const selected = selectedCode === alpha2;

                let fill = "#162032";
                if (available) {
                  if (selected) fill = "#0ea5e9";
                  else if (hovered) fill = "#38bdf8";
                  else fill = "#1e4d7b";
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => handleClick(geo)}
                    onMouseEnter={() => alpha2 && setHoveredCountry(alpha2)}
                    onMouseLeave={() => setHoveredCountry(null)}
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
