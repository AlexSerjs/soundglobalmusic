import axios from "axios";

const BASE = "https://ws.audioscrobbler.com/2.0/";

function apiKey() {
  return process.env.LASTFM_API_KEY!;
}

async function lfmGet<T>(params: Record<string, string | number>): Promise<T> {
  const res = await axios.get<T>(BASE, {
    params: { ...params, api_key: apiKey(), format: "json" },
    timeout: 8000,
  });
  return res.data;
}

interface LfmImage {
  "#text": string;
  size: string;
}

interface LfmArtistRaw {
  name: string;
  listeners: string;
  url: string;
  image: LfmImage[];
}

interface LfmTrackRaw {
  name: string;
  duration: string;
  listeners: string;
  url: string;
  artist: { name: string; url: string };
  image: LfmImage[];
  "@attr"?: { rank: string };
}

interface LfmArtistInfo {
  name: string;
  url: string;
  image: LfmImage[];
  stats: { listeners: string; playcount: string };
  tags?: { tag: { name: string }[] };
}

export interface LfmArtistResult {
  name: string;
  listeners: number;
  url: string;
  imageUrl: string;
  genres: string[];
}

export interface LfmTrackResult {
  name: string;
  artistName: string;
  listeners: number;
  url: string;
  imageUrl: string;
  durationMs: number;
  rank: number;
}

// Last.fm default blank image hash — treat as "no image"
const LFM_BLANK = "2a96cbd8b46e442fc41c2b86b821562f";

function bestImage(images: LfmImage[]): string {
  for (const size of ["extralarge", "large", "medium", "small"]) {
    const img = images.find((i) => i.size === size);
    if (img?.["#text"] && !img["#text"].includes(LFM_BLANK)) return img["#text"];
  }
  return "";
}

export async function getCountryTopArtists(
  countryName: string,
  limit = 5
): Promise<LfmArtistResult[]> {
  const data = await lfmGet<{ topartists: { artist: LfmArtistRaw[] } }>({
    method: "geo.gettopartists",
    country: countryName,
    limit,
  });

  const artists = Array.isArray(data.topartists?.artist)
    ? data.topartists.artist
    : [];

  // Enrich with tags (genres) and better images via artist.getInfo
  const enriched = await Promise.allSettled(
    artists.map((a) =>
      lfmGet<{ artist: LfmArtistInfo }>({
        method: "artist.getinfo",
        artist: a.name,
        autocorrect: 1,
      })
    )
  );

  return artists.map((a, i) => {
    const info =
      enriched[i].status === "fulfilled"
        ? enriched[i].value.artist
        : null;
    const genres = info?.tags?.tag?.slice(0, 3).map((t) => t.name) ?? [];
    const imageUrl = bestImage(info?.image ?? []) || bestImage(a.image);
    return {
      name: a.name,
      listeners: parseInt(a.listeners, 10) || 0,
      url: a.url,
      imageUrl,
      genres,
    };
  });
}

export async function getCountryTopTracks(
  countryName: string,
  limit = 10
): Promise<LfmTrackResult[]> {
  const data = await lfmGet<{ tracks: { track: LfmTrackRaw[] } }>({
    method: "geo.gettoptracks",
    country: countryName,
    limit,
  });

  const tracks = Array.isArray(data.tracks?.track)
    ? data.tracks.track
    : [];

  return tracks.map((t, i) => ({
    name: t.name,
    artistName: t.artist.name,
    listeners: parseInt(t.listeners, 10) || 0,
    url: t.url,
    imageUrl: bestImage(t.image),
    durationMs: (parseInt(t.duration, 10) || 0) * 1000,
    rank: parseInt(t["@attr"]?.rank ?? String(i + 1), 10),
  }));
}

export async function getGlobalTopTracks(limit = 5): Promise<LfmTrackResult[]> {
  const data = await lfmGet<{ tracks: { track: LfmTrackRaw[] } }>({
    method: "chart.gettoptracks",
    limit,
  });

  const tracks = Array.isArray(data.tracks?.track)
    ? data.tracks.track
    : [];

  return tracks.map((t, i) => ({
    name: t.name,
    artistName: t.artist.name,
    listeners: parseInt(t.listeners, 10) || 0,
    url: t.url,
    imageUrl: bestImage(t.image),
    durationMs: (parseInt(t.duration, 10) || 0) * 1000,
    rank: i + 1,
  }));
}
