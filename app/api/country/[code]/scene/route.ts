import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getCountryInfo } from "@/lib/playlists";
import { GROQ_COUNTRY_NAMES } from "@/lib/countries";
import { getArtistsFromGroq } from "@/lib/groq";
import { findTrackOnDeezer, findArtistOnDeezer } from "@/lib/deezer";
import axios from "axios";

const CACHE_TTL      = 60 * 60 * 6;   // 6 h  (Wikidata results)
const GROQ_CACHE_TTL = 60 * 60 * 24;  // 24 h (AI results)
const LFM            = "https://ws.audioscrobbler.com/2.0/";
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const UA             = "SoundGlobal/1.0 (soundglobal@theserjs.es)";

function lfmKey() { return process.env.LASTFM_API_KEY!; }

async function lfmGet<T>(params: Record<string, string | number>): Promise<T> {
  const res = await axios.get<T>(LFM, {
    params: { ...params, api_key: lfmKey(), format: "json" },
    timeout: 7000,
  });
  return res.data;
}

// Wikidata: musicians who are citizens of countryCode (ISO alpha-2)
async function getArtistsFromWikidata(countryCode: string): Promise<string[]> {
  const sparql = `
    SELECT DISTINCT ?name WHERE {
      ?country wdt:P297 "${countryCode}" .
      ?artist wdt:P27 ?country ;
              wdt:P106 ?occ ;
              rdfs:label ?name .
      FILTER(LANG(?name) = "en")
      VALUES ?occ {
        wd:Q639669 wd:Q177220 wd:Q488205 wd:Q36834 wd:Q753110
        wd:Q134556 wd:Q2252262 wd:Q855091 wd:Q4220920 wd:Q183945
      }
    }
    LIMIT 60
  `;

  const res = await axios.get<{
    results: { bindings: { name: { value: string } }[] };
  }>(WIKIDATA_SPARQL, {
    params: { query: sparql, format: "json" },
    headers: { "User-Agent": UA, Accept: "application/sparql-results+json" },
    timeout: 15000,
  });

  return res.data.results.bindings.map((b) => b.name.value);
}

export interface SceneArtist {
  name: string;
  imageUrl: string;
  listeners: number;
  genres: string[];
  lastfmUrl: string;
  deezerUrl: string;
  source?: "wikidata" | "groq";
  topTrack: {
    name: string;
    albumImageUrl: string;
    previewUrl: string;
    deezerUrl: string;
    durationMs: number;
  } | null;
}

// Enrich a list of {name, topSong?} with Last.fm listeners + Deezer data
async function enrichWithDeezer(
  candidates: { name: string; topSong?: string; genre?: string }[],
  source: "wikidata" | "groq"
): Promise<SceneArtist[]> {
  // Get Last.fm listener counts in parallel
  const withListeners = await Promise.all(
    candidates.slice(0, 25).map(async (c) => {
      try {
        const data = await lfmGet<{
          artist?: {
            stats?: { listeners: string };
            tags?: { tag: { name: string }[] };
            url?: string;
          };
        }>({ method: "artist.getinfo", artist: c.name, autocorrect: 1 });
        return {
          name: c.name,
          topSong: c.topSong,
          genre: c.genre,
          listeners: parseInt(data.artist?.stats?.listeners ?? "0", 10),
          genres: data.artist?.tags?.tag?.slice(0, 3).map((t) => t.name) ?? [],
          lastfmUrl: data.artist?.url ?? `https://www.last.fm/music/${encodeURIComponent(c.name)}`,
        };
      } catch {
        return { name: c.name, topSong: c.topSong, genre: c.genre, listeners: 0, genres: c.genre ? [c.genre] : [], lastfmUrl: "" };
      }
    })
  );

  // Sort by listeners, take top 5
  const top5 = withListeners
    .filter((a) => a.listeners > 0)
    .sort((a, b) => b.listeners - a.listeners)
    .slice(0, 5);

  // Fallback: if Last.fm has no data, use original order
  const finalList = top5.length >= 2 ? top5 : withListeners.slice(0, 5);

  // Enrich with Deezer images + top track preview
  return Promise.all(
    finalList.map(async ({ name, topSong, listeners, genres, lastfmUrl }) => {
      // Get Deezer artist + top track in parallel
      const [topTrackNameResult, deezerArtist] = await Promise.allSettled([
        topSong
          ? Promise.resolve(topSong)                          // Groq already gave us the song
          : lfmGet<{ toptracks: { track: { name: string }[] } }>({
              method: "artist.gettoptracks",
              artist: name,
              autocorrect: 1,
              limit: 1,
            }).then((d) => d.toptracks?.track?.[0]?.name ?? null),
        findArtistOnDeezer(name),
      ]);

      const deezerArt    = deezerArtist.status === "fulfilled" ? deezerArtist.value : null;
      const topTrackName = topTrackNameResult.status === "fulfilled" ? topTrackNameResult.value : null;

      let topTrack: SceneArtist["topTrack"] = null;
      if (topTrackName) {
        const deezerTrack = await findTrackOnDeezer(topTrackName, name);
        topTrack = {
          name: topTrackName,
          albumImageUrl: deezerTrack?.albumImageUrl ?? deezerArt?.imageUrl ?? "",
          previewUrl:    deezerTrack?.previewUrl ?? "",
          deezerUrl:     deezerTrack?.deezerUrl ?? "",
          durationMs:    deezerTrack?.durationMs ?? 0,
        };
      }

      return {
        name,
        imageUrl:  deezerArt?.imageUrl ?? "",
        listeners,
        genres,
        lastfmUrl,
        deezerUrl: deezerArt?.deezerUrl ?? "",
        source,
        topTrack,
      } satisfies SceneArtist;
    })
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const countryCode = code.toUpperCase();

  // ── Manual override (admin panel) — highest priority ─────────────────────
  const sceneOverride = await cacheGet<{
    artists: (SceneArtist & { previewUrl?: string; albumImageUrl?: string; topSong?: string })[];
  }>(`override:scene:v1:${countryCode}`);
  if (sceneOverride) {
    // Normalize legacy flat format → SceneArtist (topTrack object)
    const artists: SceneArtist[] = (sceneOverride.artists ?? []).map((a) => ({
      name:      a.name,
      imageUrl:  a.imageUrl  ?? "",
      genres:    a.genres    ?? [],
      listeners: a.listeners ?? 0,
      lastfmUrl: a.lastfmUrl ?? "",
      deezerUrl: a.deezerUrl ?? "",
      source:    (a.source === "wikidata" || a.source === "groq") ? a.source : undefined,
      topTrack:  a.topTrack ?? (a.topSong ? {
        name:          a.topSong,
        albumImageUrl: a.albumImageUrl ?? "",
        previewUrl:    a.previewUrl    ?? "",
        deezerUrl:     (a as { deezerTrackUrl?: string }).deezerTrackUrl ?? "",
        durationMs:    0,
      } : null),
    }));
    return NextResponse.json({ artists }, {
      headers: { "X-Cache": "OVERRIDE", "Cache-Control": "no-store" },
    });
  }

  // Accept both Last.fm countries AND Groq countries (previously blocked Groq)
  const isKnown = getCountryInfo(countryCode) !== null || countryCode in GROQ_COUNTRY_NAMES;
  if (!isKnown) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cacheKey = `scene:v6:${countryCode}`;
  const cached = await cacheGet<SceneArtist[]>(cacheKey);
  if (cached) return NextResponse.json({ artists: cached }, { headers: { "X-Cache": "HIT" } });

  try {
    // ── 1. Try Wikidata first (works for any country with an ISO code) ────────
    let artists: SceneArtist[] = [];
    let usedGroqCache = false;

    try {
      const candidates = await getArtistsFromWikidata(countryCode);
      if (candidates.length > 0) {
        artists = await enrichWithDeezer(
          candidates.map((name) => ({ name })),
          "wikidata"
        );
      }
    } catch (wikidataErr) {
      console.warn(`[scene/${countryCode}] Wikidata failed:`, wikidataErr);
    }

    // ── 2. Groq fallback when Wikidata returned nothing ───────────────────────
    if (artists.length === 0) {
      const countryName = GROQ_COUNTRY_NAMES[countryCode]
        ?? getCountryInfo(countryCode)?.name;

      if (countryName) {
        const groqArtists = await getArtistsFromGroq(countryName);
        if (groqArtists.length > 0) {
          artists = await enrichWithDeezer(
            groqArtists.map((a) => ({ name: a.name, topSong: a.topSong, genre: a.genre })),
            "groq"
          );
          usedGroqCache = true;
        }
      }
    }

    const ttl = usedGroqCache ? GROQ_CACHE_TTL : CACHE_TTL;
    await cacheSet(cacheKey, artists, ttl);
    return NextResponse.json({ artists }, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    console.error(`[scene/${countryCode}]`, err);
    return NextResponse.json({ error: "Failed" }, { status: 502 });
  }
}
