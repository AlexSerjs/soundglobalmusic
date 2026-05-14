import axios from "axios";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await axios.post(
    SPOTIFY_TOKEN_URL,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  cachedToken = {
    value: res.data.access_token,
    expiresAt: Date.now() + (res.data.expires_in - 60) * 1000,
  };

  return cachedToken.value;
}

async function spotifyGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await axios.get<T>(`${SPOTIFY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; width: number; height: number }[];
  genres: string[];
  followers: { total: number };
  popularity: number;
  external_urls: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  preview_url: string | null;
  duration_ms: number;
  popularity: number;
  external_urls: { spotify: string };
  artists: { id: string; name: string }[];
  album: {
    name: string;
    images: { url: string }[];
    release_date: string;
  };
}

interface PlaylistTracksResponse {
  items: { track: SpotifyTrack }[];
}

interface ArtistResponse {
  artists: SpotifyArtist[];
}

export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const data = await spotifyGet<PlaylistTracksResponse>(
    `/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,preview_url,duration_ms,popularity,external_urls,artists,album))`
  );
  return data.items.map((i) => i.track).filter(Boolean);
}

export async function getArtistsByIds(ids: string[]): Promise<SpotifyArtist[]> {
  if (ids.length === 0) return [];
  const data = await spotifyGet<ArtistResponse>(`/artists?ids=${ids.slice(0, 50).join(",")}`);
  return data.artists;
}

// Extract unique top artists from a playlist's tracks
export function extractTopArtistsFromTracks(
  tracks: SpotifyTrack[],
  limit = 5
): { id: string; name: string; count: number }[] {
  const artistCounts = new Map<string, { id: string; name: string; count: number }>();

  for (const track of tracks) {
    for (const artist of track.artists) {
      const existing = artistCounts.get(artist.id);
      if (existing) {
        existing.count++;
      } else {
        artistCounts.set(artist.id, { id: artist.id, name: artist.name, count: 1 });
      }
    }
  }

  return Array.from(artistCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
