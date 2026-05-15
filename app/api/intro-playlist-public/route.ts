import { NextResponse } from "next/server";
import { cacheGet } from "@/lib/redis";
import type { IntroTrack } from "@/app/api/intro-track/route";

// Public endpoint — returns full playlist so frontend can cycle tracks
// Falls back to Avicii if no playlist configured
export async function GET() {
  try {
    const playlist = await cacheGet<IntroTrack[]>("intro:playlist:v1");
    if (playlist && playlist.length > 0) {
      const startIndex = Math.floor(Date.now() / 3_600_000) % playlist.length;
      return NextResponse.json({ playlist, startIndex });
    }

    // Fallback: fetch Avicii from Deezer
    const res = await fetch(
      "https://api.deezer.com/search?q=avicii+waiting+for+love&limit=10"
    );
    const data = await res.json();
    const track = (data.data as Array<{
      title: string; preview: string;
      artist: { name: string };
      album: { cover_medium: string };
      link: string;
    }>)?.find((t) => t.preview && t.artist?.name?.toLowerCase().includes("avicii"));

    const fallback: IntroTrack = track
      ? { title: track.title, artist: track.artist.name, preview: track.preview,
          albumImageUrl: track.album?.cover_medium ?? "", deezerUrl: track.link ?? "" }
      : { title: "Waiting For Love", artist: "Avicii", preview: "", albumImageUrl: "", deezerUrl: "" };

    return NextResponse.json({ playlist: [fallback], startIndex: 0 });
  } catch {
    return NextResponse.json({ playlist: [], startIndex: 0 });
  }
}
