import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getCountryTopArtists, getCountryTopTracks } from "@/lib/lastfm";
import { findTrackOnDeezer, findArtistOnDeezer } from "@/lib/deezer";
import { getCountryInfo } from "@/lib/playlists";
import { getArtistsFromGroq } from "@/lib/groq";
import type { CountryData, Artist, Track } from "@/types";

// English names for countries NOT in COUNTRY_MAP (Last.fm has no data for these)
// Used to query Groq AI for artist recommendations
const GROQ_COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan",      AL: "Albania",          DZ: "Algeria",
  AD: "Andorra",          AO: "Angola",           AZ: "Azerbaijan",
  BH: "Bahrain",          BD: "Bangladesh",       BY: "Belarus",
  BZ: "Belize",           BJ: "Benin",            BT: "Bhutan",
  BO: "Bolivia",          BA: "Bosnia and Herzegovina",
  BW: "Botswana",         BN: "Brunei",           BF: "Burkina Faso",
  BI: "Burundi",          KH: "Cambodia",         CM: "Cameroon",
  CF: "Central African Republic",  TD: "Chad",    CN: "China",
  CG: "Republic of the Congo",     CD: "Democratic Republic of the Congo",
  CR: "Costa Rica",       CI: "Côte d'Ivoire",    CU: "Cuba",
  CY: "Cyprus",           DJ: "Djibouti",         DO: "Dominican Republic",
  SV: "El Salvador",      GQ: "Equatorial Guinea",ER: "Eritrea",
  ET: "Ethiopia",         FJ: "Fiji",             GA: "Gabon",
  GM: "Gambia",           GE: "Georgia",          GH: "Ghana",
  GT: "Guatemala",        GN: "Guinea",           GW: "Guinea-Bissau",
  HT: "Haiti",            HN: "Honduras",         IS: "Iceland",
  IQ: "Iraq",             IR: "Iran",             JM: "Jamaica",
  JO: "Jordan",           KZ: "Kazakhstan",       KE: "Kenya",
  KW: "Kuwait",           KG: "Kyrgyzstan",       LA: "Laos",
  LB: "Lebanon",          LS: "Lesotho",          LR: "Liberia",
  LY: "Libya",            LI: "Liechtenstein",    LU: "Luxembourg",
  MG: "Madagascar",       MW: "Malawi",           MV: "Maldives",
  ML: "Mali",             MT: "Malta",            MR: "Mauritania",
  MU: "Mauritius",        MD: "Moldova",          MC: "Monaco",
  MN: "Mongolia",         ME: "Montenegro",       MA: "Morocco",
  MZ: "Mozambique",       MM: "Myanmar",          NA: "Namibia",
  NP: "Nepal",            NI: "Nicaragua",        NE: "Niger",
  MK: "North Macedonia",  OM: "Oman",             PA: "Panama",
  PG: "Papua New Guinea", PY: "Paraguay",         QA: "Qatar",
  RS: "Serbia",           SN: "Senegal",          SL: "Sierra Leone",
  SK: "Slovakia",         SI: "Slovenia",         SO: "Somalia",
  SS: "South Sudan",      LK: "Sri Lanka",        SD: "Sudan",
  SZ: "Eswatini",         SY: "Syria",            TJ: "Tajikistan",
  TZ: "Tanzania",         TL: "Timor-Leste",      TG: "Togo",
  TT: "Trinidad and Tobago",       TN: "Tunisia", TM: "Turkmenistan",
  UG: "Uganda",           UY: "Uruguay",          UZ: "Uzbekistan",
  YE: "Yemen",            ZM: "Zambia",           ZW: "Zimbabwe",
  AE: "United Arab Emirates",
};

const LASTFM_TTL = 60 * 60 * 6;   // 6 h
const GROQ_TTL   = 60 * 60 * 24;  // 24 h

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const countryCode = code.toUpperCase();

  // ── Last.fm path (countries in COUNTRY_MAP) ──────────────────────────────
  const info = getCountryInfo(countryCode);
  if (info) {
    const cacheKey = `country:v2:${countryCode}`;
    const cached = await cacheGet<CountryData>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=3600" },
      });
    }

    try {
      const [lfmArtists, lfmTracks] = await Promise.all([
        getCountryTopArtists(info.lfmName, 5),
        getCountryTopTracks(info.lfmName, 10),
      ]);

      const [deezerTracks, deezerArtists] = await Promise.all([
        Promise.all(lfmTracks.map((t) => findTrackOnDeezer(t.name, t.artistName))),
        Promise.all(lfmArtists.map((a) => findArtistOnDeezer(a.name))),
      ]);

      const topArtists: Artist[] = lfmArtists.map((a, i) => ({
        id: encodeURIComponent(a.name),
        name: a.name,
        imageUrl: deezerArtists[i]?.imageUrl || a.imageUrl,
        genres: a.genres,
        listeners: a.listeners,
        lastfmUrl: a.url,
        deezerUrl: deezerArtists[i]?.deezerUrl ?? "",
      }));

      const topTracks: Track[] = lfmTracks.map((t, i) => ({
        id: `${countryCode}-${i}`,
        name: t.name,
        artistName: t.artistName,
        albumImageUrl: deezerTracks[i]?.albumImageUrl || t.imageUrl,
        previewUrl: deezerTracks[i]?.previewUrl ?? "",
        durationMs: deezerTracks[i]?.durationMs || t.durationMs,
        listeners: t.listeners,
        lastfmUrl: t.url,
        deezerUrl: deezerTracks[i]?.deezerUrl ?? "",
        rank: t.rank,
      }));

      const data: CountryData = {
        countryCode,
        countryName: info.name,
        topArtists,
        topTracks,
        cachedAt: Date.now(),
        source: "lastfm",
      };

      await cacheSet(cacheKey, data, LASTFM_TTL);
      return NextResponse.json(data, {
        headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=3600" },
      });
    } catch (err) {
      console.error(`[country/${countryCode}] Last.fm error`, err);
      return NextResponse.json({ error: "Failed to fetch music data" }, { status: 502 });
    }
  }

  // ── Groq fallback (countries NOT in COUNTRY_MAP) ─────────────────────────
  const countryName = GROQ_COUNTRY_NAMES[countryCode];
  if (!countryName) {
    return NextResponse.json(
      { error: "No data available for this country" },
      { status: 404 }
    );
  }

  const groqCacheKey = `country:groq:v1:${countryCode}`;
  const groqCached = await cacheGet<CountryData>(groqCacheKey);
  if (groqCached) {
    return NextResponse.json(groqCached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=3600" },
    });
  }

  try {
    const groqArtists = await getArtistsFromGroq(countryName);
    if (!groqArtists.length) {
      return NextResponse.json({ error: "No artists found" }, { status: 404 });
    }

    // Enrich in parallel: Deezer image for each artist + preview for their top song
    const enriched = await Promise.all(
      groqArtists.map(async (a, i) => {
        const [deezerArtist, deezerTrack] = await Promise.all([
          findArtistOnDeezer(a.name),
          findTrackOnDeezer(a.topSong, a.name),
        ]);

        const artist: Artist = {
          id: encodeURIComponent(a.name),
          name: a.name,
          imageUrl: deezerArtist?.imageUrl ?? "",
          genres: [a.genre],
          listeners: 0,
          lastfmUrl: "",
          deezerUrl: deezerArtist?.deezerUrl ?? "",
        };

        const track: Track = {
          id: `${countryCode}-groq-${i}`,
          name: a.topSong,
          artistName: a.name,
          albumImageUrl: deezerTrack?.albumImageUrl ?? deezerArtist?.imageUrl ?? "",
          previewUrl: deezerTrack?.previewUrl ?? "",
          durationMs: deezerTrack?.durationMs ?? 0,
          listeners: 0,
          lastfmUrl: "",
          deezerUrl: deezerTrack?.deezerUrl ?? "",
          rank: i + 1,
        };

        return { artist, track };
      })
    );

    const data: CountryData = {
      countryCode,
      countryName,
      topArtists: enriched.map((e) => e.artist),
      topTracks:  enriched.map((e) => e.track),
      cachedAt: Date.now(),
      source: "groq",
    };

    await cacheSet(groqCacheKey, data, GROQ_TTL);
    return NextResponse.json(data, {
      headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    console.error(`[country/${countryCode}] Groq error`, err);
    return NextResponse.json({ error: "Failed to fetch AI music data" }, { status: 502 });
  }
}
