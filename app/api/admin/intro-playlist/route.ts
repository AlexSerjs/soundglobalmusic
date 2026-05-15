import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSetPermanent } from "@/lib/redis";
import type { IntroTrack } from "@/app/api/intro-track/route";

function checkAuth(req: NextRequest): boolean {
  return req.headers.get("x-admin-token") === process.env.ADMIN_PASSWORD;
}

// GET — return current playlist
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const playlist = await cacheGet<IntroTrack[]>("intro:playlist:v1") ?? [];
  return NextResponse.json({ playlist });
}

// POST — save full playlist
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { playlist } = await req.json() as { playlist: IntroTrack[] };
  if (!Array.isArray(playlist)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const saved = await cacheSetPermanent("intro:playlist:v1", playlist);
  if (!saved) return NextResponse.json({ error: "Redis unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, count: playlist.length });
}
