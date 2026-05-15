// Groq AI — fast LLaMA 3.3 70B, free tier
// Used for: artist recommendations + local top tracks per country

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

function groqKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  return key;
}

async function groqJSON<T>(prompt: string, maxTokens = 700): Promise<T> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        {
          role: "system",
          content: "You are a music expert. Always respond with valid JSON only, no markdown, no explanation.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);

  const data  = await res.json();
  const raw   = (data.choices?.[0]?.message?.content ?? "{}") as string;
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as T;
}

// ── Artists ──────────────────────────────────────────────────────────────────

export interface GroqArtist {
  name: string;
  genre: string;
  topSong: string;
}

export async function getArtistsFromGroq(countryName: string): Promise<GroqArtist[]> {
  const result = await groqJSON<{ artists?: GroqArtist[] }>(
    `List the 5 most internationally recognized music artists who are FROM ${countryName} ` +
    `(born or raised there, nationals of ${countryName}). ` +
    `For each artist include their most famous song. ` +
    `Respond ONLY with this JSON: {"artists":[{"name":"string","genre":"string","topSong":"string"}]}`
  );
  return result.artists ?? [];
}

// ── Local top tracks ──────────────────────────────────────────────────────────

export interface GroqTrack {
  title: string;
  artist: string;
}

export async function getLocalTracksFromGroq(countryName: string): Promise<GroqTrack[]> {
  const result = await groqJSON<{ tracks?: GroqTrack[] }>(
    `List 10 iconic or popular songs by music artists who are FROM ${countryName} ` +
    `(the artist must be a national of ${countryName}, not just popular there). ` +
    `Include a mix of classic hits and recent songs. ` +
    `Respond ONLY with this JSON: {"tracks":[{"title":"string","artist":"string"}]}`,
    800
  );
  return result.tracks ?? [];
}
