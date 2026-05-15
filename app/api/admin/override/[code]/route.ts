import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSetPermanent, cacheDel } from "@/lib/redis";
import { findTrackOnDeezer, findArtistOnDeezer } from "@/lib/deezer";
import type { Artist, Track } from "@/types";

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token");
  return token === process.env.ADMIN_PASSWORD;
}

// ── GET — return current per-section overrides ────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await params;
  const countryCode = code.toUpperCase();

  const [tracks, artists] = await Promise.all([
    cacheGet<Track[]>(`override:tracks:v1:${countryCode}`),
    cacheGet<Artist[]>(`override:artists:v1:${countryCode}`),
  ]);

  return NextResponse.json({ tracks, artists });
}

// ── DELETE — clear override (section-specific or all) ────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await params;
  const countryCode = code.toUpperCase();

  const section = req.nextUrl.searchParams.get("section");
  if (section === "tracks") {
    await cacheDel(`override:tracks:v1:${countryCode}`);
  } else if (section === "artists") {
    await cacheDel(`override:artists:v1:${countryCode}`);
  } else {
    // Delete all (including legacy key)
    await Promise.all([
      cacheDel(`override:tracks:v1:${countryCode}`),
      cacheDel(`override:artists:v1:${countryCode}`),
      cacheDel(`override:country:v1:${countryCode}`),
    ]);
  }

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
    section?: "tracks" | "artists" | "both";
    tracks?: { title: string; artist: string }[];
    artists?: { name: string; genre: string }[];
  };

  const section = body.section ?? "both";

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

    // Save to per-section keys
    const saves: Promise<boolean>[] = [];
    if ((section === "tracks" || section === "both") && topTracks.length) {
      saves.push(cacheSetPermanent(`override:tracks:v1:${countryCode}`, topTracks));
    }
    if ((section === "artists" || section === "both") && topArtists.length) {
      saves.push(cacheSetPermanent(`override:artists:v1:${countryCode}`, topArtists));
    }

    if (saves.length === 0) {
      return NextResponse.json({ error: "No data to save" }, { status: 400 });
    }

    const results = await Promise.all(saves);
    if (results.some((r) => !r)) {
      return NextResponse.json(
        { error: "Redis not available — override not saved" },
        { status: 503 }
      );
    }

    // Bust the regular cache + legacy key so the site picks up overrides immediately
    await Promise.all([
      cacheDel(`country:v2:${countryCode}`),
      cacheDel(`country:groq:v1:${countryCode}`),
      cacheDel(`override:country:v1:${countryCode}`),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/override]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
