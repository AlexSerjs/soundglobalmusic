import { NextResponse } from "next/server";

// Returns a Deezer preview URL for Avicii - Waiting for Love
// Cached at the Next.js layer for 24h
export async function GET() {
  try {
    const res = await fetch(
      "https://api.deezer.com/search?q=avicii+waiting+for+love&limit=10",
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();

    // Pick first result that has a preview
    const track = (data.data as Array<{ title: string; preview: string; artist: { name: string } }> | undefined)
      ?.find((t) => t.preview && t.artist?.name?.toLowerCase().includes("avicii"));

    if (!track?.preview) {
      return NextResponse.json({ error: "no preview found" }, { status: 404 });
    }

    return NextResponse.json({
      preview: track.preview,
      title: track.title,
      artist: track.artist.name,
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
