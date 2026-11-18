// Praat met een OpenAI-compatibele chat-API (zelfde setup als Ask Maarten op je portfolio).

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ModelAnswer = { reply: string; unlocked: unknown[] };

// Groq rekent max_tokens mee in de limiet per minuut: houd dit dus krap.
// Denkmodellen tellen hun redenering hierin mee, vandaar niet lager.
const MAX_TOKENS = 450;
/** Langer wachten dan dit doen we niet: dan liever een nette foutmelding. */
const MAX_WAIT_SECONDS = 12;

export function isModelConfigured() {
  return Boolean(process.env.ASK_API_URL);
}

/**
 * Modellen in volgorde van voorkeur. Bij Groq heeft elk model een eigen limiet per minuut,
 * dus als het eerste vol zit, kan het tweede vaak nog wel.
 */
function models(): string[] {
  const primary = process.env.ASK_MODEL ?? "";
  const fallback =
    process.env.ASK_FALLBACK_MODEL ??
    (process.env.ASK_API_URL?.includes("groq.com") ? "openai/gpt-oss-20b" : "");
  return [primary, fallback].filter((m, i, all) => m && all.indexOf(m) === i);
}

async function callApi(model: string, messages: object[], jsonMode: boolean, signal: AbortSignal) {
  return fetch(process.env.ASK_API_URL as string, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ASK_API_KEY ? { Authorization: `Bearer ${process.env.ASK_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0.5, // lager = minder verzinsels
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(model.includes("gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
    }),
    signal,
  });
}

/** Hoeveel seconden de API wil dat we wachten (header of "try again in 9.3s" in de foutmelding). */
function retryAfterSeconds(response: Response, body: string): number {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header;
  const match = body.match(/try again in ([\d.]+)s/i);
  return match?.[1] ? Number(match[1]) : MAX_WAIT_SECONDS + 1;
}

/** Haalt {reply, unlocked} uit het antwoord, ook als het model er tekst omheen zette. */
export function parseAnswer(content: string): ModelAnswer {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const data = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
      if (typeof data.reply === "string" && data.reply.trim()) {
        const unlocked = Array.isArray(data.unlocked)
          ? data.unlocked
          : typeof data.unlocked === "string"
            ? [data.unlocked]
            : [];
        return { reply: data.reply.trim(), unlocked };
      }
    } catch {
      // geen geldige JSON: val terug op de ruwe tekst
    }
  }
  return { reply: content.trim(), unlocked: [] };
}

async function tryModel(model: string, messages: object[], signal: AbortSignal) {
  let response = await callApi(model, messages, true, signal);
  // Niet elk model kent JSON-modus: dan opnieuw zonder (de prompt vraagt toch JSON)
  if (response.status === 400) response = await callApi(model, messages, false, signal);
  return response;
}

export async function askModel(
  system: string,
  history: ChatMessage[],
  signal: AbortSignal,
): Promise<ModelAnswer> {
  const messages = [{ role: "system", content: system }, ...history];
  const [primary, ...fallbacks] = models();
  if (!primary) throw new Error("no model");

  let response = await tryModel(primary, messages, signal);
  let waitFor = 0;

  // Limiet bereikt: eerst een ander model proberen, anders even wachten en opnieuw
  if (response.status === 429) {
    waitFor = retryAfterSeconds(response, await response.text());
    for (const model of fallbacks) {
      response = await tryModel(model, messages, signal);
      if (response.status !== 429) break;
      waitFor = Math.min(waitFor, retryAfterSeconds(response, await response.text()));
    }
    if (response.status === 429 && waitFor <= MAX_WAIT_SECONDS) {
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(waitFor * 1000) + 300));
      response = await tryModel(primary, messages, signal);
    }
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Model error", response.status, detail.slice(0, 300));
    throw new Error(response.status === 429 ? "busy" : "upstream");
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("empty");
  return parseAnswer(content);
}
