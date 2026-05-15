import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSetPermanent, cacheDel } from "@/lib/redis";
import { findTrackOnDeezer, findArtistOnDeezer } from "@/lib/deezer";
import type { CountryData, Artist, Track } from "@/types";

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token");
  return token === process.env.ADMIN_PASSWORD;
}

function overrideKey(code: string) {
  return `override:country:v1:${code.toUpperCase()}`;
}

// ── GET — return current override (or null) ──────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await params;
  const data = await cacheGet<CountryData>(overrideKey(code));
  return NextResponse.json({ override: data });
}

// ── DELETE — clear override ───────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await params;
  await cacheDel(overrideKey(code));
  return NextResponse.json({ ok: true });
}

// ── POST — save override (enriches with Deezer) ───────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const countryCode = code.toUpperCase();

  const body = await req.json() as {
    countryName: string;
    tracks?: { title: string; artist: string }[];
    artists?: { name: string; genre: string }[];
  };

  try {
    // Enrich tracks with Deezer previews + art
    const topTracks: Track[] = [];
    if (body.tracks?.length) {
      const deezerResults = await Promise.all(
        body.tracks.map((t) => findTrackOnDeezer(t.title, t.artist))
      );
      body.tracks.forEach((t, i) => {
        topTracks.push({
          id: `${countryCode}-manual-${i}`,
          name: t.title,
          artistName: t.artist,
          albumImageUrl: deezerResults[i]?.albumImageUrl ?? "",
          previewUrl:    deezerResults[i]?.previewUrl ?? "",
          durationMs:    deezerResults[i]?.durationMs ?? 0,
          listeners:     0,
          lastfmUrl:     "",
          deezerUrl:     deezerResults[i]?.deezerUrl ?? "",
          rank: i + 1,
        });
      });
    }

    // Enrich artists with Deezer images
    const topArtists: Artist[] = [];
    if (body.artists?.length) {
      const deezerResults = await Promise.all(
        body.artists.map((a) => findArtistOnDeezer(a.name))
      );
      body.artists.forEach((a, i) => {
        topArtists.push({
          id:        encodeURIComponent(a.name),
          name:      a.name,
          imageUrl:  deezerResults[i]?.imageUrl ?? "",
          genres:    a.genre ? [a.genre] : [],
          listeners: 0,
          lastfmUrl: "",
          deezerUrl: deezerResults[i]?.deezerUrl ?? "",
        });
      });
    }

    const data: CountryData = {
      countryCode,
      countryName: body.countryName,
      topArtists,
      topTracks,
      cachedAt: Date.now(),
      source: "manual",
    };

    const saved = await cacheSetPermanent(overrideKey(countryCode), data);
    if (!saved) {
      return NextResponse.json(
        { error: "Redis not available — override not saved" },
        { status: 503 }
      );
    }

    // Bust the regular cache so the site picks up the override immediately
    await Promise.all([
      cacheDel(`country:v2:${countryCode}`),
      cacheDel(`country:groq:v1:${countryCode}`),
    ]);

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[admin/override]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
