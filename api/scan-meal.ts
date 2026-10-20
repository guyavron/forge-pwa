/**
 * POST /api/scan-meal — server-side proxy to Google Gemini vision.
 *
 * Why this exists: the Gemini key used to live in a VITE_ env var, which Vite inlines into the
 * client bundle — anyone could open DevTools and copy it. The key now lives only in the server
 * environment (GEMINI_API_KEY, no VITE_ prefix), and the browser talks to this function instead.
 *
 * Abuse guard: the caller must send a valid Supabase session token. It's verified against
 * Supabase Auth before any Gemini call, so only signed-in Forge users can spend the quota.
 */

// Google retires pinned/dated Gemini model versions aggressively; only the rolling "-latest"
// alias has stayed reachable. If this 404s, list callable models with
// GET https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
const GEMINI_MODEL = "gemini-flash-latest";
const MAX_BASE64_CHARS = 4_000_000; // Vercel caps request bodies at 4.5 MB

const PROMPT = `You are a nutrition estimation assistant. Look at this photo of a meal or food item
and estimate its nutritional content as best you can from visual portion size.

Respond with ONLY a JSON object matching this exact shape, no markdown, no prose:
{
  "meal_name": string,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number
}

All numeric fields are your best estimate for the whole portion shown, in kcal for calories and
grams for protein/carbs/fat. If you genuinely cannot identify any food in the image, set
meal_name to "Unknown food" and all numeric fields to 0.`;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function isSignedIn(authHeader: string | null): Promise<boolean> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!authHeader?.startsWith("Bearer ") || !supabaseUrl || !anonKey) return false;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authHeader },
  });
  return res.ok;
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(500, { error: "Server is missing GEMINI_API_KEY." });

  if (!(await isSignedIn(request.headers.get("authorization")))) {
    return json(401, { error: "Please sign in to use AI meal scanning." });
  }

  let base64: unknown;
  let mimeType: unknown;
  try {
    ({ base64, mimeType } = await request.json());
  } catch {
    return json(400, { error: "Invalid request body." });
  }
  if (typeof base64 !== "string" || !base64 || typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
    return json(400, { error: "Expected { base64, mimeType } with an image." });
  }
  if (base64.length > MAX_BASE64_CHARS) {
    return json(413, { error: "Image is too large. Try a smaller photo." });
  }

  const gemini = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    }
  );

  if (!gemini.ok) {
    const detail = await gemini.text().catch(() => "");
    return json(502, { error: `Gemini request failed (${gemini.status}): ${detail.slice(0, 200)}` });
  }

  const payload = await gemini.json();
  const text: string | undefined = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return json(502, { error: "Gemini returned no content for this image." });

  // Defensive: strip markdown fences in case the model adds them despite the JSON mime type.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return json(502, { error: "Couldn't parse Gemini's response as JSON." });
  }

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return json(200, {
    meal_name:
      typeof parsed.meal_name === "string" && parsed.meal_name.trim() ? parsed.meal_name : "Scanned meal",
    calories: num(parsed.calories),
    protein: num(parsed.protein),
    carbs: num(parsed.carbs),
    fat: num(parsed.fat),
  });
}
