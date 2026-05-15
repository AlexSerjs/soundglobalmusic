export interface Artist {
  id: string;            // last.fm URL slug used as id
  name: string;
  imageUrl: string;      // Deezer picture (best quality), fallback to Last.fm
  genres: string[];
  listeners: number;
  lastfmUrl: string;
  deezerUrl: string;
}

export interface Track {
  id: string;
  name: string;
  artistName: string;
  albumImageUrl: string; // Deezer album cover
  previewUrl: string;    // Deezer 30s preview (empty string if not found)
  durationMs: number;
  listeners: number;
  lastfmUrl: string;
  deezerUrl: string;
  rank: number;
}

export interface CountryData {
  countryCode: string;
  countryName: string;
  topArtists: Artist[];
  topTracks: Track[];
  cachedAt: number;
  source?: "lastfm" | "groq";   // "groq" = AI fallback, no Last.fm data available
}

export interface GlobalData {
  topTracks: Track[];
  cachedAt: number;
}
