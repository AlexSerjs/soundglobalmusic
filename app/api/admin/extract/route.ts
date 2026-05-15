import { NextRequest, NextResponse } from "next/server";

const GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token");
  return token === process.env.ADMIN_PASSWORD;
}

const PROMPTS: Record<string, string> = {
  tracks:
    "This is a music chart or playlist screenshot. Extract every visible song. " +
    "Return ONLY valid JSON: {\"tracks\":[{\"rank\":1,\"title\":\"song title\",\"artist\":\"artist name\"}]}. " +
    "Use the exact text visible in the image for titles and artist names.",

  artists:
    "This is a music chart or artist list screenshot. Extract every visible artist. " +
    "Return ONLY valid JSON: {\"artists\":[{\"name\":\"artist name\",\"genre\":\"music genre if visible\"}]}.",

  scene:
    "This is a music list or chart screenshot. Extract every visible artist/band. " +
    "Also extract their most famous song if shown. " +
    "Return ONLY valid JSON: {\"artists\":[{\"name\":\"artist name\",\"topSong\":\"song title or empty string\"}]}.",
};

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  try {
    const form    = await req.formData();
    const section = (form.get("section") as string) ?? "tracks";
    const file    = form.get("image") as File | null;

    if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 });

    // Convert image to base64
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mime   = file.type || "image/jpeg";

    const prompt = PROMPTS[section] ?? PROMPTS.tracks;

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0.1,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${base64}` },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Groq Vision error: ${err}` }, { status: 502 });
    }

    const data  = await res.json();
    const raw   = (data.choices?.[0]?.message?.content ?? "{}") as string;
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({ section, data: parsed });
  } catch (err) {
    console.error("[admin/extract]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
