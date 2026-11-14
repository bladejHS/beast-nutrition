/* AI meal logging (2026-11-14): a photo or a description of a meal becomes a list of foods with grams, which the user
   confirms before anything is logged. This file is the part without a screen: the key, the request and the cleaning of
   the answer. The call itself is made by the Anthropic SDK from the phone, with the user's own key (src/screens/ai.ts).

   The key lives in its own localStorage entry, never in the app's state, so it is in no backup and never leaves the
   phone except as the credential of the request. Calories and targets stay with calc.ts: the model only names foods. */
import type Anthropic from '@anthropic-ai/sdk';

const KEY = 'beast-nutrition:ai-key';
export const MODEL = 'claude-opus-5-5';

export const aiKey = (): string => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
export function setAiKey(k: string): boolean {
  try {
    if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY);
    return true;
  } catch { return false; }
}
/** Anthropic API keys start with "sk-ant-"; anything else is a paste gone wrong. */
export const looksLikeKey = (k: string): boolean => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim());

/** One food the model saw, per 100 g, with the grams it thinks were eaten. */
export interface AiItem { name: string; g: number; kcal: number; p: number; c: number; f: number; fiber: number; sure: 'low' | 'medium' | 'high' }
export interface AiMeal { items: AiItem[]; note: string }

const num = { type: 'number' } as const;
/** Structured output: the answer is this JSON and nothing else. */
export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'note'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal_100g', 'protein_100g', 'carbs_100g', 'fat_100g', 'fiber_100g', 'confidence'],
        properties: {
          name: { type: 'string' }, grams: num, kcal_100g: num, protein_100g: num, carbs_100g: num, fat_100g: num, fiber_100g: num,
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    note: { type: 'string' },
  },
} as const;

export const SYSTEM = `You turn a meal into a food log for a Romanian nutrition app. The user sends a photo of a plate, a short description, or both.

List every distinct food or drink with calories as one item:
- name: in Romanian, specific, as cooked ("piept de pui la grătar", "orez alb fiert", "ulei de măsline"). No brand unless the user gave one.
- grams: the amount eaten. When the user states an amount, use it exactly. From a photo, estimate from plate size, cutlery and typical portions. For drinks, grams = millilitres.
- kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g: standard values per 100 g of the food as cooked or as served, from food composition tables.
- confidence: "high" when the user stated the amount, "medium" for a clear photo of a simple food, "low" when the amount or the food is a guess.

Count cooking fat and sauces as their own items when they are visible or implied (fried food, dressed salad). Do not list water, black coffee, plain tea or anything with no calories.
note: one short sentence in Romanian saying what is most uncertain, or an empty string. If there is no food to log (the photo shows none, the text describes none), return an empty items list and say so in note.`;

export interface Photo { data: string; type: 'image/jpeg' | 'image/png' | 'image/webp' }

/** The request, the same for the app and for a test run: one user turn with the photo first, then the words. */
export function buildRequest(text: string, photo: Photo | null): Anthropic.Beta.MessageCreateParamsNonStreaming {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (photo) content.push({ type: 'image', source: { type: 'base64', media_type: photo.type, data: photo.data } });
  content.push({ type: 'text', text: text.trim() || 'Ce e în farfurie? Estimează cantitățile.' });
  return {
    model: MODEL,
    max_tokens: 16000,
    // a short extraction: low effort keeps the wait on the phone short (thinking stays adaptive)
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    // a request the model's safeguards decline by mistake is re-run on the fallback model in the same call
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  };
}

const fin = (v: unknown, max: number): number => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };

/** The model's JSON, made safe to log: numbers within what food can be, names trimmed, nonsense rows dropped. */
export function cleanMeal(raw: unknown): AiMeal {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const items: AiItem[] = [];
  for (const x of Array.isArray(o['items']) ? (o['items'] as Record<string, unknown>[]) : []) {
    if (!x || typeof x !== 'object') continue;
    const name = String(x['name'] ?? '').trim().slice(0, 80);
    const g = Math.round(fin(x['grams'], 3000));
    const p = fin(x['protein_100g'], 100), c = fin(x['carbs_100g'], 100), f = fin(x['fat_100g'], 100);
    // calories can't be far from what the macros add up to: when they are, the macros win
    const fromMacros = 4 * p + 4 * c + 9 * f;
    let kcal = fin(x['kcal_100g'], 900);
    if (fromMacros > 0 && (kcal < fromMacros * 0.7 || kcal > fromMacros * 1.4 + 30)) kcal = Math.min(900, Math.round(fromMacros));
    if (!name || !g || !kcal) continue;
    const sure = x['confidence'] === 'high' || x['confidence'] === 'medium' ? x['confidence'] : 'low';
    items.push({ name: name[0]!.toUpperCase() + name.slice(1), g, kcal: Math.round(kcal), p, c, f, fiber: fin(x['fiber_100g'], 60), sure });
  }
  return { items: items.slice(0, 20), note: String(o['note'] ?? '').trim().slice(0, 240) };
}

/** The text of the answer, parsed; throws when the reply was cut off or declined. */
export function readAnswer(msg: Pick<Anthropic.Beta.BetaMessage, 'stop_reason' | 'content'>): AiMeal {
  if (msg.stop_reason === 'refusal') throw new Error('refusal');
  if (msg.stop_reason === 'max_tokens') throw new Error('cut');
  const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
  return cleanMeal(JSON.parse(text));
}
