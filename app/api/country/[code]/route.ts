import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getCountryTopArtists, getCountryTopTracks } from "@/lib/lastfm";
import { findTrackOnDeezer, findArtistOnDeezer } from "@/lib/deezer";
import { getCountryInfo } from "@/lib/playlists";
import { getArtistsFromGroq, getLocalTracksFromGroq } from "@/lib/groq";
import { GROQ_COUNTRY_NAMES } from "@/lib/countries";
import type { CountryData, Artist, Track } from "@/types";

const LASTFM_TTL = 60 * 60 * 6;   // 6 h
const GROQ_TTL   = 60 * 60 * 24;  // 24 h

// Returns true when Last.fm top-track data looks skewed:
// same artist dominates (3+ songs) or too few unique artists (<4 of 10)
function tracksLookSkewed(tracks: { artistName: string }[]): boolean {
  if (tracks.length < 5) return true;
  const counts: Record<string, number> = {};
  for (const t of tracks) {
    counts[t.artistName] = (counts[t.artistName] ?? 0) + 1;
    if (counts[t.artistName] >= 3) return true;   // one artist dominates
  }
  return Object.keys(counts).length < 4;           // too few unique artists
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const countryCode = code.toUpperCase();

  // ── Manual override (admin panel) — highest priority ─────────────────────
  const override = await cacheGet<CountryData>(`override:country:v1:${countryCode}`);
  if (override) {
    return NextResponse.json(override, {
      headers: { "X-Cache": "OVERRIDE", "Cache-Control": "no-store" },
    });
  }

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

      const deezerArtists = await Promise.all(
        lfmArtists.map((a) => findArtistOnDeezer(a.name))
      );

      const topArtists: Artist[] = lfmArtists.map((a, i) => ({
        id: encodeURIComponent(a.name),
        name: a.name,
        imageUrl: deezerArtists[i]?.imageUrl || a.imageUrl,
        genres: a.genres,
        listeners: a.listeners,
        lastfmUrl: a.url,
        deezerUrl: deezerArtists[i]?.deezerUrl ?? "",
      }));

      // ── Top tracks: Last.fm if data looks good, Groq if skewed (e.g. BTS x8) ──
      let topTracks: Track[];
      let trackSource: "lastfm" | "groq" = "lastfm";

      if (!tracksLookSkewed(lfmTracks)) {
        // Last.fm data is diverse → use it
        const deezerTracks = await Promise.all(
          lfmTracks.map((t) => findTrackOnDeezer(t.name, t.artistName))
        );
        topTracks = lfmTracks.map((t, i) => ({
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
      } else {
        // Last.fm data is skewed → ask Groq for local tracks
        console.log(`[country/${countryCode}] Last.fm tracks skewed → using Groq`);
        trackSource = "groq";
        const groqTracks = await getLocalTracksFromGroq(info.name);
        const deezerTracks = await Promise.all(
          groqTracks.map((t) => findTrackOnDeezer(t.title, t.artist))
        );
        topTracks = groqTracks.map((t, i) => ({
          id: `${countryCode}-groq-${i}`,
          name: t.title,
          artistName: t.artist,
          albumImageUrl: deezerTracks[i]?.albumImageUrl ?? "",
          previewUrl: deezerTracks[i]?.previewUrl ?? "",
          durationMs: deezerTracks[i]?.durationMs ?? 0,
          listeners: 0,
          lastfmUrl: "",
          deezerUrl: deezerTracks[i]?.deezerUrl ?? "",
          rank: i + 1,
        }));
      }

      const data: CountryData = {
        countryCode,
        countryName: info.name,
        topArtists,
        topTracks,
        cachedAt: Date.now(),
        source: trackSource === "groq" ? "groq" : "lastfm",
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
