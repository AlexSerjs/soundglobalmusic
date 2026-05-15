import { NextResponse } from "next/server";
import { cacheGet } from "@/lib/redis";

export interface IntroTrack {
  title: string;
  artist: string;
  preview: string;
  albumImageUrl: string;
  deezerUrl: string;
}

const FALLBACK: IntroTrack = {
  title: "Waiting For Love",
  artist: "Avicii",
  preview: "",
  albumImageUrl: "",
  deezerUrl: "",
};

// Fetch fallback (Avicii) from Deezer
async function fetchFallback(): Promise<IntroTrack> {
  try {
    const res  = await fetch("https://api.deezer.com/search?q=avicii+waiting+for+love&limit=10");
    const data = await res.json();
    const track = (data.data as Array<{
      title: string; preview: string;
      artist: { name: string };
      album: { cover_medium: string };
      link: string;
    }>)?.find((t) => t.preview && t.artist?.name?.toLowerCase().includes("avicii"));
    if (!track) return FALLBACK;
    return {
      title: track.title,
      artist: track.artist.name,
      preview: track.preview,
      albumImageUrl: track.album?.cover_medium ?? "",
      deezerUrl: track.link ?? "",
    };
  } catch {
    return FALLBACK;
  }
}

export async function GET() {
  try {
    // Load admin-managed playlist from Redis
    const playlist = await cacheGet<IntroTrack[]>("intro:playlist:v1");

    if (playlist && playlist.length > 0) {
      // Rotate by hour: index = floor(unix_hours) % length
      const hourIndex = Math.floor(Date.now() / 3_600_000) % playlist.length;
      return NextResponse.json(playlist[hourIndex]);
    }

    // No playlist configured → use Avicii fallback
    const fallback = await fetchFallback();
    return NextResponse.json(fallback);
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
