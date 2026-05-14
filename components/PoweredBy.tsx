"use client";

import { useEffect, useRef } from "react";

// Wikidata logo (stylised "WD" with data bars)
function WikidataLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor">
      {/* Vertical bars — Wikidata's iconic mark */}
      <rect x="8"  y="20" width="10" height="60" rx="2"/>
      <rect x="22" y="10" width="10" height="80" rx="2"/>
      <rect x="36" y="30" width="10" height="50" rx="2"/>
      <rect x="50" y="15" width="10" height="70" rx="2"/>
      <rect x="64" y="35" width="10" height="45" rx="2"/>
      <rect x="78" y="25" width="10" height="55" rx="2"/>
    </svg>
  );
}

// MusicBrainz SVG logo (stylised orange "MB" mark)
function MusicBrainzLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor">
      {/* Outer ring */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="8"/>
      {/* Inner decorative ring */}
      <circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.4"/>
      {/* MB letters */}
      <text x="50" y="63" textAnchor="middle" fontSize="36" fontWeight="900" fontFamily="Arial,sans-serif" letterSpacing="-2">MB</text>
    </svg>
  );
}

// Deezer SVG logo (equalizer bars)
function DeezerLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 24 14" fill="currentColor">
      <rect x="0"  y="8"  width="3" height="6" rx="0.5"/>
      <rect x="4"  y="5"  width="3" height="9" rx="0.5"/>
      <rect x="8"  y="2"  width="3" height="12" rx="0.5"/>
      <rect x="12" y="0"  width="3" height="14" rx="0.5"/>
      <rect x="16" y="3"  width="3" height="11" rx="0.5"/>
      <rect x="20" y="6"  width="3" height="8" rx="0.5"/>
    </svg>
  );
}

// Last.fm SVG logo (scrobble waves)
function LastfmLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.65} viewBox="0 0 40 26" fill="currentColor">
      <path d="M17.5 13c0-3.6-2.9-6.5-6.5-6.5S4.5 9.4 4.5 13s2.9 6.5 6.5 6.5c2.1 0 4-.99 5.2-2.54l2.1 2.1A10.44 10.44 0 0 1 11 22C5.48 22 1 17.52 1 12S5.48 2 11 2c5.1 0 9.28 3.65 9.93 8.4l-.01.1H17.5V13zm4.6 8.6 2.4-3.2c1.1 1.5 2.8 2.4 4.7 2.4 1.6 0 2.7-.7 2.7-1.8 0-1-.8-1.5-2.9-2.1l-1.4-.4c-2.9-.8-4.4-2.4-4.4-4.7 0-2.9 2.4-4.8 5.9-4.8 2.3 0 4.3.8 5.7 2.3l-2.2 3c-1-1.1-2.2-1.7-3.5-1.7-1.3 0-2.1.6-2.1 1.5 0 .9.7 1.3 2.6 1.9l1.4.4c3.2.9 4.7 2.4 4.7 4.9 0 3.1-2.5 5.1-6.4 5.1-2.8 0-5.1-1-6.7-2.8z"/>
    </svg>
  );
}

export default function PoweredBy() {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);

  // Random glitch trigger
  useEffect(() => {
    const elements = [ref1.current, ref2.current, ref3.current, ref4.current].filter(Boolean) as HTMLDivElement[];

    const trigger = () => {
      const el = elements[Math.floor(Math.random() * elements.length)];
      if (el) {
        el.classList.add("glitching");
        setTimeout(() => el.classList.remove("glitching"), 600);
      }
      // Next glitch in 2-7 seconds
      setTimeout(trigger, 2000 + Math.random() * 5000);
    };

    const t = setTimeout(trigger, 1500 + Math.random() * 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Deezer */}
      <a
        href="https://www.deezer.com"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative"
        title="Previews via Deezer"
      >
        <div
          ref={ref1}
          className="powered-logo text-[#A238FF] group-hover:text-[#bf5fff] transition-colors"
        >
          <DeezerLogo size={32} />
          <span className="hidden sm:block text-[8px] text-center font-bold tracking-widest opacity-70 mt-0.5">DEEZER</span>
          {/* Glitch layers */}
          <div className="glitch-layer glitch-red" aria-hidden>
            <DeezerLogo size={32} />
          </div>
          <div className="glitch-layer glitch-cyan" aria-hidden>
            <DeezerLogo size={32} />
          </div>
        </div>
      </a>

      <span className="text-gray-700 text-xs">×</span>

      {/* Last.fm */}
      <a
        href="https://www.last.fm"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative"
        title="Charts via Last.fm"
      >
        <div
          ref={ref2}
          className="powered-logo text-[#d51007] group-hover:text-[#ff2010] transition-colors"
        >
          <LastfmLogo size={32} />
          <span className="hidden sm:block text-[8px] text-center font-bold tracking-widest opacity-70 mt-0.5">LAST.FM</span>
          <div className="glitch-layer glitch-red" aria-hidden>
            <LastfmLogo size={32} />
          </div>
          <div className="glitch-layer glitch-cyan" aria-hidden>
            <LastfmLogo size={32} />
          </div>
        </div>
      </a>

      <span className="text-gray-700 text-xs">×</span>

      {/* Wikidata */}
      <a
        href="https://www.wikidata.org"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative"
        title="Artist nationality via Wikidata"
      >
        <div
          ref={ref4}
          className="powered-logo text-[#006699] group-hover:text-[#0088cc] transition-colors"
        >
          <WikidataLogo size={28} />
          <span className="hidden sm:block text-[8px] text-center font-bold tracking-widest opacity-70 mt-0.5">WIKIDATA</span>
          <div className="glitch-layer glitch-red" aria-hidden>
            <WikidataLogo size={28} />
          </div>
          <div className="glitch-layer glitch-cyan" aria-hidden>
            <WikidataLogo size={28} />
          </div>
        </div>
      </a>

      <span className="text-gray-700 text-xs">×</span>

      {/* MusicBrainz */}
      <a
        href="https://musicbrainz.org"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative"
        title="Artist origins via MusicBrainz"
      >
        <div
          ref={ref3}
          className="powered-logo text-[#eb743b] group-hover:text-[#ff8c4f] transition-colors"
        >
          <MusicBrainzLogo size={28} />
          <span className="hidden sm:block text-[8px] text-center font-bold tracking-widest opacity-70 mt-0.5">MUSICBRAINZ</span>
          <div className="glitch-layer glitch-red" aria-hidden>
            <MusicBrainzLogo size={28} />
          </div>
          <div className="glitch-layer glitch-cyan" aria-hidden>
            <MusicBrainzLogo size={28} />
          </div>
        </div>
      </a>
    </div>
  );
}
