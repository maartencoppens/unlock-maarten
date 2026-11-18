// Praat met een OpenAI-compatibele chat-API (zelfde setup als Ask Maarten op je portfolio).

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ModelAnswer = { reply: string; unlocked: unknown[] };

const MAX_TOKENS = 700; // denkmodellen tellen hun redenering hierin mee

export function isModelConfigured() {
  return Boolean(process.env.ASK_API_URL);
}

async function callApi(messages: object[], jsonMode: boolean, signal: AbortSignal) {
  const model = process.env.ASK_MODEL ?? "";
  return fetch(process.env.ASK_API_URL as string, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ASK_API_KEY ? { Authorization: `Bearer ${process.env.ASK_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(model.includes("gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
    }),
    signal,
  });
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

export async function askModel(
  system: string,
  history: ChatMessage[],
  signal: AbortSignal,
): Promise<ModelAnswer> {
  const messages = [{ role: "system", content: system }, ...history];

  let response = await callApi(messages, true, signal);
  // Niet elk model kent JSON-modus: dan opnieuw zonder (de prompt vraagt toch JSON)
  if (response.status === 400) response = await callApi(messages, false, signal);

  if (!response.ok) {
    console.error("Model error", response.status, (await response.text()).slice(0, 300));
    throw new Error("upstream");
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("empty");
  return parseAnswer(content);
}
