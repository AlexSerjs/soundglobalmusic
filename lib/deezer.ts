import axios from "axios";

const BASE = "https://api.deezer.com";

// Deezer doesn't require an API key for public search endpoints

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  preview: string;          // 30-second preview URL
  link: string;
  artist: { name: string; picture_medium: string };
  album: { title: string; cover_medium: string; cover_xl: string };
}

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium: string;
  picture_xl: string;
  link: string;
  nb_fan: number;
}

interface DeezerSearchResponse<T> {
  data: T[];
  total: number;
}

export interface DeezerTrackResult {
  previewUrl: string;
  albumImageUrl: string;
  deezerUrl: string;
  durationMs: number;
}

export interface DeezerArtistResult {
  imageUrl: string;
  deezerUrl: string;
  fans: number;
}

// Extract the first/main artist from a collaboration string like "A & B & C" or "A feat. B"
function primaryArtist(name: string): string {
  return name.split(/\s*[&,]\s*|\s+feat\.?\s+/i)[0].trim();
}

export async function findTrackOnDeezer(
  trackName: string,
  artistName: string
): Promise<DeezerTrackResult | null> {
  // Build a list of queries to try in order — most specific first
  const mainArtist = primaryArtist(artistName);
  const queries = [
    `track:"${trackName}" artist:"${artistName}"`,          // exact collab
    ...(mainArtist !== artistName
      ? [`track:"${trackName}" artist:"${mainArtist}"`]     // main artist only
      : []),
    `"${mainArtist}" "${trackName}"`,                       // loose keyword
  ];

  for (const q of queries) {
    try {
      const res = await axios.get<DeezerSearchResponse<DeezerTrack>>(
        `${BASE}/search`,
        { params: { q, limit: 5 }, timeout: 5000 }
      );
      // Prefer results that have a preview URL
      const withPreview = res.data.data?.filter((t) => t.preview);
      const track = withPreview?.[0] ?? res.data.data?.[0];
      if (track) {
        return {
          previewUrl: track.preview,
          albumImageUrl: track.album.cover_medium || track.album.cover_xl,
          deezerUrl: track.link,
          durationMs: track.duration * 1000,
        };
      }
    } catch {
      // try next query
    }
  }
  return null;
}

export async function findArtistOnDeezer(
  artistName: string
): Promise<DeezerArtistResult | null> {
  try {
    const res = await axios.get<DeezerSearchResponse<DeezerArtist>>(
      `${BASE}/search/artist`,
      { params: { q: artistName, limit: 1 }, timeout: 5000 }
    );

    const artist = res.data.data?.[0];
    if (!artist) return null;

    return {
      imageUrl: artist.picture_xl || artist.picture_medium,
      deezerUrl: artist.link,
      fans: artist.nb_fan,
    };
  } catch {
    return null;
  }
}
