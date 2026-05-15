import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSetPermanent, cacheDel } from "@/lib/redis";
import { findTrackOnDeezer, findArtistOnDeezer } from "@/lib/deezer";

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token");
  return token === process.env.ADMIN_PASSWORD;
}

function sceneKey(code: string) {
  return `override:scene:v1:${code.toUpperCase()}`;
}

// ── GET — return current scene override (or null) ─────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await params;
  const data = await cacheGet(sceneKey(code));
  return NextResponse.json({ override: data });
}

// ── DELETE — clear scene override ─────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await params;
  await cacheDel(sceneKey(code));
  return NextResponse.json({ ok: true });
}

// ── POST — save scene override (enriches with Deezer) ────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const countryCode = code.toUpperCase();

  const body = await req.json() as {
    countryName: string;
    artists: { name: string; topSong: string }[];
  };

  if (!body.artists?.length) {
    return NextResponse.json({ error: "No artists provided" }, { status: 400 });
  }

  try {
    const enriched = await Promise.all(
      body.artists.map(async (a) => {
        const [deezerArtist, deezerTrack] = await Promise.all([
          findArtistOnDeezer(a.name),
          a.topSong ? findTrackOnDeezer(a.topSong, a.name) : Promise.resolve(null),
        ]);

        return {
          name:      a.name,
          topSong:   a.topSong,
          imageUrl:  deezerArtist?.imageUrl  ?? "",
          deezerUrl: deezerArtist?.deezerUrl ?? "",
          previewUrl:    deezerTrack?.previewUrl    ?? "",
          albumImageUrl: deezerTrack?.albumImageUrl ?? deezerArtist?.imageUrl ?? "",
          deezerTrackUrl: deezerTrack?.deezerUrl ?? "",
        };
      })
    );

    const data = {
      countryCode,
      countryName: body.countryName,
      artists: enriched,
      cachedAt: Date.now(),
      source: "manual" as const,
    };

    const saved = await cacheSetPermanent(sceneKey(countryCode), data);
    if (!saved) {
      return NextResponse.json(
        { error: "Redis not available — scene override not saved" },
        { status: 503 }
      );
    }

    // Bust the scene cache so the site picks up the override immediately
    await cacheDel(`scene:v6:${countryCode}`);

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[admin/scene]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
