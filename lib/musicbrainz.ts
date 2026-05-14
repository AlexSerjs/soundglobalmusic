import axios from "axios";

const MB_BASE = "https://musicbrainz.org/ws/2";
const MB_HEADERS = {
  "User-Agent": "SoundGlobal/1.0 (soundglobalbyspotify.theserjs.es)",
  Accept: "application/json",
};

export interface MBArtist {
  name: string;
  mbid: string;
  type: string;
  score: number;
}

interface MBSearchResult {
  artists: {
    id: string;
    name: string;
    type?: string;
    score: number;
    country?: string;
    tags?: { name: string; count: number }[];
  }[];
}

export async function getArtistsNativeToCountry(
  countryCode: string,
  limit = 8
): Promise<MBArtist[]> {
  // MusicBrainz query: artists whose country field = our ISO code
  const res = await axios.get<MBSearchResult>(`${MB_BASE}/artist`, {
    params: {
      query: `country:${countryCode} AND (type:person OR type:group)`,
      limit: limit * 3, // fetch more to filter
      fmt: "json",
    },
    headers: MB_HEADERS,
    timeout: 10000,
  });

  const artists = res.data.artists ?? [];

  return artists
    .filter(
      (a) =>
        a.score >= 60 &&
        // Prefer confirmed country match
        (a.country?.toUpperCase() === countryCode.toUpperCase() || a.score >= 90)
    )
    .slice(0, limit)
    .map((a) => ({
      name: a.name,
      mbid: a.id,
      type: a.type ?? "Unknown",
      score: a.score,
    }));
}
