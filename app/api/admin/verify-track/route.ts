import { NextRequest, NextResponse } from "next/server";

function checkAuth(req: NextRequest): boolean {
  return req.headers.get("x-admin-token") === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/verify-track?title=...&artist=...
// Searches Deezer and returns the best matching track with preview
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const title  = searchParams.get("title")?.trim() ?? "";
  const artist = searchParams.get("artist")?.trim() ?? "";

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const q = encodeURIComponent(`${artist} ${title}`.trim());
  const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=15`);
  if (!res.ok) return NextResponse.json({ error: "Deezer error" }, { status: 502 });

  const data = await res.json();
  const results = data.data as Array<{
    id: number;
    title: string;
    preview: string;
    link: string;
    artist: { name: string };
    album: { title: string; cover_medium: string };
    duration: number;
  }> | undefined;

  if (!results?.length) return NextResponse.json({ found: false });

  // Prefer tracks with preview; rank by title similarity
  const withPreview = results.filter((t) => t.preview);
  const best = withPreview[0] ?? results[0];

  return NextResponse.json({
    found: !!best.preview,
    title: best.title,
    artist: best.artist.name,
    album: best.album.title,
    preview: best.preview ?? "",
    albumImageUrl: best.album.cover_medium ?? "",
    deezerUrl: best.link ?? "",
    durationMs: (best.duration ?? 0) * 1000,
  });
}
