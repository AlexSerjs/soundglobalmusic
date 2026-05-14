import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getGlobalTopTracks } from "@/lib/lastfm";
import { findTrackOnDeezer } from "@/lib/deezer";
import type { GlobalData, Track } from "@/types";

const CACHE_TTL = 60 * 60; // 1 hour

export async function GET() {
  const cacheKey = "global:v2:top50";
  const cached = await cacheGet<GlobalData>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=900" },
    });
  }

  try {
    const lfmTracks = await getGlobalTopTracks(50);

    // Enrich with Deezer previews in parallel
    const deezerTracks = await Promise.all(
      lfmTracks.map((t) => findTrackOnDeezer(t.name, t.artistName))
    );

    const topTracks: Track[] = lfmTracks.map((t, i) => ({
      id: `global-${i}`,
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

    const data: GlobalData = { topTracks, cachedAt: Date.now() };
    await cacheSet(cacheKey, data, CACHE_TTL);

    return NextResponse.json(data, {
      headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=900" },
    });
  } catch (err) {
    console.error("[global]", err);
    return NextResponse.json({ error: "Failed to fetch global chart" }, { status: 502 });
  }
}
