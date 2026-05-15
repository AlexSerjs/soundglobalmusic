"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { isAvailable, COUNTRY_MAP } from "@/lib/playlists";

const AVAILABLE_CODES = Object.keys(COUNTRY_MAP);

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Full geo-name → alpha-2 mapping
// Last.fm countries (COUNTRY_MAP) + Groq-fallback countries
const NAME_TO_ALPHA2: Record<string, string> = {
  // ── Last.fm countries ────────────────────────────────────────────────────
  "Argentina": "AR",            "Australia": "AU",          "Austria": "AT",
  "Belgium": "BE",              "Brazil": "BR",             "Bulgaria": "BG",
  "Canada": "CA",               "Chile": "CL",              "Colombia": "CO",
  "Croatia": "HR",              "Czechia": "CZ",            "Denmark": "DK",
  "Ecuador": "EC",              "Egypt": "EG",              "Estonia": "EE",
  "Finland": "FI",              "France": "FR",             "Germany": "DE",
  "Greece": "GR",               "Hungary": "HU",            "India": "IN",
  "Indonesia": "ID",            "Ireland": "IE",            "Israel": "IL",
  "Italy": "IT",                "Japan": "JP",              "Latvia": "LV",
  "Lithuania": "LT",            "Malaysia": "MY",           "Mexico": "MX",
  "Netherlands": "NL",          "New Zealand": "NZ",        "Nigeria": "NG",
  "Norway": "NO",               "Pakistan": "PK",           "Peru": "PE",
  "Philippines": "PH",          "Poland": "PL",             "Portugal": "PT",
  "Romania": "RO",              "Russia": "RU",             "Saudi Arabia": "SA",
  "South Africa": "ZA",         "South Korea": "KR",        "Spain": "ES",
  "Sweden": "SE",               "Switzerland": "CH",        "Taiwan": "TW",
  "Thailand": "TH",             "Turkey": "TR",             "Ukraine": "UA",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States of America": "US",
  "Venezuela": "VE",            "Vietnam": "VN",

  // ── Groq-fallback countries ───────────────────────────────────────────────
  "Afghanistan": "AF",          "Albania": "AL",            "Algeria": "DZ",
  "Andorra": "AD",              "Angola": "AO",             "Azerbaijan": "AZ",
  "Bahrain": "BH",              "Bangladesh": "BD",         "Belarus": "BY",
  "Belize": "BZ",               "Benin": "BJ",              "Bhutan": "BT",
  "Bolivia": "BO",              "Bosnia and Herz.": "BA",   "Botswana": "BW",
  "Brunei": "BN",               "Burkina Faso": "BF",       "Burundi": "BI",
  "Cambodia": "KH",             "Cameroon": "CM",
  "Central African Rep.": "CF", "Chad": "TD",               "China": "CN",
  "Congo": "CG",                "Dem. Rep. Congo": "CD",
  "Costa Rica": "CR",           "Côte d'Ivoire": "CI",      "Cuba": "CU",
  "Cyprus": "CY",               "Djibouti": "DJ",
  "Dominican Rep.": "DO",       "El Salvador": "SV",
  "Eq. Guinea": "GQ",           "Eritrea": "ER",            "Ethiopia": "ET",
  "Fiji": "FJ",                 "Gabon": "GA",              "Gambia": "GM",
  "Georgia": "GE",              "Ghana": "GH",              "Guatemala": "GT",
  "Guinea": "GN",               "Guinea-Bissau": "GW",      "Haiti": "HT",
  "Honduras": "HN",             "Iceland": "IS",            "Iraq": "IQ",
  "Iran": "IR",                 "Jamaica": "JM",            "Jordan": "JO",
  "Kazakhstan": "KZ",           "Kenya": "KE",              "Kuwait": "KW",
  "Kyrgyzstan": "KG",           "Laos": "LA",               "Lebanon": "LB",
  "Lesotho": "LS",              "Liberia": "LR",            "Libya": "LY",
  "Liechtenstein": "LI",        "Luxembourg": "LU",         "Madagascar": "MG",
  "Malawi": "MW",               "Maldives": "MV",           "Mali": "ML",
  "Malta": "MT",                "Mauritania": "MR",         "Mauritius": "MU",
  "Moldova": "MD",              "Monaco": "MC",             "Mongolia": "MN",
  "Montenegro": "ME",           "Morocco": "MA",            "Mozambique": "MZ",
  "Myanmar": "MM",              "Namibia": "NA",            "Nepal": "NP",
  "Nicaragua": "NI",            "Niger": "NE",              "North Macedonia": "MK",
  "Oman": "OM",                 "Panama": "PA",
  "Papua New Guinea": "PG",     "Paraguay": "PY",           "Qatar": "QA",
  "Serbia": "RS",               "Senegal": "SN",            "Sierra Leone": "SL",
  "Slovakia": "SK",             "Slovenia": "SI",           "Somalia": "SO",
  "S. Sudan": "SS",             "Sri Lanka": "LK",          "Sudan": "SD",
  "Swaziland": "SZ",            "Syria": "SY",              "Tajikistan": "TJ",
  "Tanzania": "TZ",             "Timor-Leste": "TL",        "Togo": "TG",
  "Trinidad and Tobago": "TT",  "Tunisia": "TN",            "Turkmenistan": "TM",
  "Uganda": "UG",               "Uruguay": "UY",            "Uzbekistan": "UZ",
  "Yemen": "YE",                "Zambia": "ZM",             "Zimbabwe": "ZW",
};

// Countries handled by Groq (not in COUNTRY_MAP / Last.fm)
const GROQ_CODES = new Set([
  "AF","AL","DZ","AD","AO","AZ","BH","BD","BY","BZ","BJ","BT","BO","BA","BW",
  "BN","BF","BI","KH","CM","CF","TD","CN","CG","CD","CR","CI","CU","CY","DJ",
  "DO","SV","GQ","ER","ET","FJ","GA","GM","GE","GH","GT","GN","GW","HT","HN",
  "IS","IQ","IR","JM","JO","KZ","KE","KW","KG","LA","LB","LS","LR","LY","LI",
  "LU","MG","MW","MV","ML","MT","MR","MU","MD","MC","MN","ME","MA","MZ","MM",
  "NA","NP","NI","NE","MK","OM","PA","PG","PY","QA","RS","SN","SL","SK","SI",
  "SO","SS","LK","SD","SZ","SY","TJ","TZ","TL","TG","TT","TN","TM","UG","UY",
  "UZ","YE","ZM","ZW","AE",
]);

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
  const [glitchSet, setGlitchSet]       = useState<Set<string>>(new Set());
  const [glitchPhase, setGlitchPhase]   = useState(false);

  useEffect(() => {
    const id = setInterval(() => setGlitchPhase((p) => !p), 80);
    return () => clearInterval(id);
  }, []);

  // Glitch only Last.fm countries (bright blue ones)
  useEffect(() => {
    const trigger = () => {
      const count = 2 + Math.floor(Math.random() * 2);
      const shuffled = [...AVAILABLE_CODES].sort(() => Math.random() - 0.5);
      setGlitchSet(new Set(shuffled.slice(0, count)));
      setTimeout(() => setGlitchSet(new Set()), 400 + Math.random() * 250);
      setTimeout(trigger, 2500 + Math.random() * 3500);
    };
    const t = setTimeout(trigger, 1500 + Math.random() * 2000);
    return () => clearTimeout(t);
  }, []);

  const handleClick = useCallback(
    (geo: { properties: Record<string, string | number | undefined> }) => {
      const geoName = String(geo.properties.name ?? "");
      const alpha2  = NAME_TO_ALPHA2[geoName];
      if (!alpha2) return;

      const clickable = isAvailable(alpha2) || GROQ_CODES.has(alpha2);
      if (!clickable) return;

      const displayName = COUNTRY_MAP[alpha2]?.name ?? geoName;
      onCountryClick(alpha2, displayName);
    },
    [onCountryClick]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const zoomIn  = () => setZoom((z) => Math.min(z * 1.5, 8));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.5, 0.8));

  const hoveredName = hoveredCode
    ? (COUNTRY_MAP[hoveredCode]?.name ?? hoveredCode)
    : null;

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
        <ZoomableGroup zoom={zoom} minZoom={0.8} maxZoom={8}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName   = String(geo.properties.name ?? "");
                const alpha2    = NAME_TO_ALPHA2[geoName];
                const isLfm     = alpha2 ? isAvailable(alpha2) : false;
                const isGroq    = alpha2 ? GROQ_CODES.has(alpha2) : false;
                const clickable = isLfm || isGroq;
                const hovered   = hoveredCode === alpha2;
                const selected  = selectedCode === alpha2;
                const glitching = isLfm && alpha2 ? glitchSet.has(alpha2) : false;

                // Last.fm → bright blue  |  Groq → dim teal  |  none → dark
                let fill = "#162032";
                if (isLfm) {
                  if (selected)       fill = "#0ea5e9";
                  else if (glitching) fill = glitchPhase ? "#38bdf8" : "#e11d48";
                  else if (hovered)   fill = "#38bdf8";
                  else                fill = "#1e4d7b";
                } else if (isGroq) {
                  if (selected)     fill = "#0e7490";
                  else if (hovered) fill = "#1e6a7a";
                  else              fill = "#163d50";
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
                        cursor: clickable ? "pointer" : "default",
                        transition: "fill 0.15s ease",
                      },
                      hover: {
                        fill: isLfm ? "#38bdf8" : isGroq ? "#1e6a7a" : "#1c2e44",
                        stroke: "#0d1b2a",
                        strokeWidth: 0.6,
                        outline: "none",
                        cursor: clickable ? "pointer" : "default",
                      },
                      pressed: {
                        fill: isGroq ? "#0e7490" : "#0ea5e9",
                        outline: "none",
                      },
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
          {GROQ_CODES.has(hoveredCode) && (
            <span className="text-[10px] text-cyan-400/60 font-normal">· AI</span>
          )}
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
      <div className="absolute bottom-4 right-4 flex items-center gap-3 text-xs text-gray-400 bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#1e4d7b]" /> Last.fm
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#163d50]" /> Groq AI
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#162032]" /> Sin datos
        </span>
      </div>
    </div>
  );
}
