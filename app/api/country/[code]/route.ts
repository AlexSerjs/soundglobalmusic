import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getCountryTopArtists, getCountryTopTracks } from "@/lib/lastfm";
import { findTrackOnDeezer, findArtistOnDeezer } from "@/lib/deezer";
import { getCountryInfo } from "@/lib/playlists";
import type { CountryData, Artist, Track } from "@/types";

const CACHE_TTL = 60 * 60 * 6; // 6 hours

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const countryCode = code.toUpperCase();

  const cacheKey = `country:v2:${countryCode}`;
  const cached = await cacheGet<CountryData>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=3600" },
    });
  }

  const info = getCountryInfo(countryCode);
  if (!info) {
    return NextResponse.json(
      { error: "No data available for this country" },
      { status: 404 }
    );
  }

  try {
    // Fetch Last.fm artists + tracks in parallel
    const [lfmArtists, lfmTracks] = await Promise.all([
      getCountryTopArtists(info.lfmName, 5),
      getCountryTopTracks(info.lfmName, 10),
    ]);

    // Enrich tracks with Deezer previews + album art (parallel)
    const [deezerTracks, deezerArtists] = await Promise.all([
      Promise.all(
        lfmTracks.map((t) => findTrackOnDeezer(t.name, t.artistName))
      ),
      Promise.all(
        lfmArtists.map((a) => findArtistOnDeezer(a.name))
      ),
    ]);

    const topArtists: Artist[] = lfmArtists.map((a, i) => ({
      id: encodeURIComponent(a.name),
      name: a.name,
      // Prefer Deezer image (higher quality & more consistent), fallback to Last.fm
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
    };

    await cacheSet(cacheKey, data, CACHE_TTL);

    return NextResponse.json(data, {
      headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    console.error(`[country/${countryCode}]`, err);
    return NextResponse.json({ error: "Failed to fetch music data" }, { status: 502 });
  }
}
