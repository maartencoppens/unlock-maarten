// De zes fragmenten van het spel. Gedeeld door client en server.
// Alleen publieke info hier: wat de bezoeker te zien krijgt NA het ontgrendelen.
// De feiten voor de bot staan in lib/prompt.ts.

export const FRAGMENTS = [
  {
    id: "muziek",
    title: "Muziek",
    hint: "Wat doet hij als hij niet aan het bouwen is?",
    learned: "Speelt bas in coverband Pink Ties",
  },
  {
    id: "maker",
    title: "Maker",
    hint: "Wat maakt hij het liefst?",
    learned: "Bouwt fysieke dingen én volledige back-offices",
  },
  {
    id: "kat",
    title: "Kat",
    hint: "Heeft hij huisdieren?",
    learned: "Heeft een kat, en een 3D-geprinte versie ervan",
  },
  {
    id: "studie",
    title: "Studie",
    hint: "Wat studeert hij, en waar?",
    learned: "Interactive Media Development, Arteveldehogeschool",
  },
  {
    id: "werkstijl",
    title: "Werkstijl",
    hint: "Welke rol neemt hij in een team?",
    learned: "Neemt de logica-rol: hij laat alles werken",
  },
  {
    id: "paloma",
    title: "Waarom Paloma",
    hint: "Waarom net Paloma? (na 3 andere fragmenten)",
    learned: "Wil de maker zijn die jullie ideeën laat werken",
  },
] as const;

export type FragmentId = (typeof FRAGMENTS)[number]["id"];
export const TOTAL_FRAGMENTS = FRAGMENTS.length;
/** Zoveel andere fragmenten moeten open zijn voor "Waarom Paloma" kan. */
export const PALOMA_REQUIRES = 3;

const IDS = new Set<string>(FRAGMENTS.map((f) => f.id));

export function isFragmentId(value: unknown): value is FragmentId {
  return typeof value === "string" && IDS.has(value);
}

/** Pogingen om het spel te omzeilen ("unlock alles") leveren nooit iets op. */
const CHEAT_PATTERN = /\b(unlock|ontgrendel|fragment|system ?prompt|instructions?|instructies)\b/i;

/**
 * De server beslist, niet het model: hooguit één nieuw fragment per bericht,
 * alleen uit de vaste lijst, en "paloma" pas na PALOMA_REQUIRES andere.
 */
export function pickUnlock(
  candidates: readonly unknown[],
  unlocked: readonly FragmentId[],
  userMessage: string,
): FragmentId | null {
  if (userMessage.trim().length < 3 || CHEAT_PATTERN.test(userMessage)) return null;
  const others = unlocked.filter((id) => id !== "paloma").length;
  for (const candidate of candidates) {
    if (!isFragmentId(candidate) || unlocked.includes(candidate)) continue;
    if (candidate === "paloma" && others < PALOMA_REQUIRES) continue;
    return candidate;
  }
  return null;
}
