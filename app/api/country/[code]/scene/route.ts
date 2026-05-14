import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getCountryInfo } from "@/lib/playlists";
import { findTrackOnDeezer, findArtistOnDeezer } from "@/lib/deezer";
import axios from "axios";

const CACHE_TTL = 60 * 60 * 6; // 6h
const LFM = "https://ws.audioscrobbler.com/2.0/";
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const UA = "SoundGlobal/1.0 (soundglobal@theserjs.es)";

function lfmKey() {
  return process.env.LASTFM_API_KEY!;
}

async function lfmGet<T>(params: Record<string, string | number>): Promise<T> {
  const res = await axios.get<T>(LFM, {
    params: { ...params, api_key: lfmKey(), format: "json" },
    timeout: 7000,
  });
  return res.data;
}

// Wikidata: musicians who are citizens of the given country (ISO alpha-2)
// Returns names sorted by Wikipedia sitelinks count (proxy for fame)
async function getArtistsFromWikidata(countryCode: string): Promise<string[]> {
  const sparql = `
    SELECT DISTINCT ?name (MAX(?sl) AS ?sitelinks) WHERE {
      ?country wdt:P297 "${countryCode}" .
      ?artist wdt:P27 ?country ;
              wdt:P106 ?occ ;
              wikibase:sitelinks ?sl ;
              rdfs:label ?name .
      FILTER(LANG(?name) = "en")
      VALUES ?occ {
        wd:Q639669 wd:Q177220 wd:Q488205 wd:Q36834 wd:Q753110
        wd:Q134556 wd:Q2252262 wd:Q855091 wd:Q4220920 wd:Q183945
      }
    }
    GROUP BY ?name
    ORDER BY DESC(?sitelinks)
    LIMIT 40
  `;

  const res = await axios.get<{
    results: { bindings: { name: { value: string }; sitelinks: { value: string } }[] };
  }>(WIKIDATA_SPARQL, {
    params: { query: sparql, format: "json" },
    headers: { "User-Agent": UA, Accept: "application/sparql-results+json" },
    timeout: 12000,
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
  topTrack: {
    name: string;
    albumImageUrl: string;
    previewUrl: string;
    deezerUrl: string;
    durationMs: number;
  } | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const countryCode = code.toUpperCase();

  const info = getCountryInfo(countryCode);
  if (!info) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cacheKey = `scene:v5:${countryCode}`;
  const cached = await cacheGet<SceneArtist[]>(cacheKey);
  if (cached) return NextResponse.json({ artists: cached }, { headers: { "X-Cache": "HIT" } });

  try {
    // 1. Get musicians FROM this country via Wikidata (sorted by Wikipedia notability)
    const candidates = await getArtistsFromWikidata(countryCode);

    if (candidates.length === 0) {
      return NextResponse.json({ artists: [] });
    }

    // 2. Get Last.fm listener counts for all candidates in parallel (first 25)
    const withListeners = await Promise.all(
      candidates.slice(0, 25).map(async (name) => {
        try {
          const data = await lfmGet<{
            artist?: {
              stats?: { listeners: string };
              tags?: { tag: { name: string }[] };
              url?: string;
            };
          }>({ method: "artist.getinfo", artist: name, autocorrect: 1 });
          return {
            name,
            listeners: parseInt(data.artist?.stats?.listeners ?? "0", 10),
            genres: data.artist?.tags?.tag?.slice(0, 3).map((t) => t.name) ?? [],
            lastfmUrl: data.artist?.url ?? `https://www.last.fm/music/${encodeURIComponent(name)}`,
          };
        } catch {
          return { name, listeners: 0, genres: [], lastfmUrl: "" };
        }
      })
    );

    // 3. Sort by Last.fm listeners, take top 5
    const top5 = withListeners
      .filter((a) => a.listeners > 0)
      .sort((a, b) => b.listeners - a.listeners)
      .slice(0, 5);

    // If Last.fm has no data for these artists, fall back to Wikidata order
    const finalList = top5.length >= 2
      ? top5
      : withListeners.slice(0, 5);

    // 4. Enrich with Deezer images + top track preview
    const enriched = await Promise.all(
      finalList.map(async ({ name, listeners, genres, lastfmUrl }) => {
        const [topTrackData, deezerArtist] = await Promise.allSettled([
          lfmGet<{ toptracks: { track: { name: string }[] } }>({
            method: "artist.gettoptracks",
            artist: name,
            autocorrect: 1,
            limit: 1,
          }),
          findArtistOnDeezer(name),
        ]);

        const deezerArt = deezerArtist.status === "fulfilled" ? deezerArtist.value : null;

        let topTrack: SceneArtist["topTrack"] = null;
        if (topTrackData.status === "fulfilled") {
          const track = topTrackData.value.toptracks?.track?.[0];
          if (track) {
            const deezerTrack = await findTrackOnDeezer(track.name, name);
            topTrack = deezerTrack
              ? {
                  name: track.name,
                  albumImageUrl: deezerTrack.albumImageUrl,
                  previewUrl: deezerTrack.previewUrl,
                  deezerUrl: deezerTrack.deezerUrl,
                  durationMs: deezerTrack.durationMs,
                }
              : { name: track.name, albumImageUrl: "", previewUrl: "", deezerUrl: "", durationMs: 0 };
          }
        }

        return {
          name,
          imageUrl: deezerArt?.imageUrl ?? "",
          listeners,
          genres,
          lastfmUrl,
          deezerUrl: deezerArt?.deezerUrl ?? "",
          topTrack,
        } satisfies SceneArtist;
      })
    );

    await cacheSet(cacheKey, enriched, CACHE_TTL);
    return NextResponse.json({ artists: enriched }, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    console.error(`[scene/${countryCode}]`, err);
    return NextResponse.json({ error: "Failed" }, { status: 502 });
  }
}
