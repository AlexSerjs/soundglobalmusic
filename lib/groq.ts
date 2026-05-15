// Groq AI — used as fallback for countries without Last.fm data
// Free tier, very fast (LLaMA 3.3 70B)

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

export interface GroqArtist {
  name: string;
  genre: string;
  topSong: string;
}

export async function getArtistsFromGroq(countryName: string): Promise<GroqArtist[]> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are a music expert. Always respond with valid JSON only, no markdown, no explanation.",
        },
        {
          role: "user",
          content: `List the 5 most internationally recognized music artists who are FROM ${countryName} ` +
            `(born or raised there, nationals of ${countryName}). ` +
            `For each artist include their most famous song. ` +
            `Respond ONLY with this exact JSON structure:\n` +
            `{"artists":[{"name":"string","genre":"string","topSong":"string"}]}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);

  const data = await res.json();
  const raw  = (data.choices?.[0]?.message?.content ?? "{}") as string;

  // Strip any accidental markdown fences
  const clean = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean) as { artists?: GroqArtist[] };
  return parsed.artists ?? [];
}
