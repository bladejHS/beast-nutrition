import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRequest, cleanMeal, looksLikeKey, MODEL, readAnswer, SCHEMA } from './ai.ts';
import { entryFrom } from './store.ts';

test('the request: photo first, then the words, structured output, the fallback on', () => {
  const r = buildRequest('  200 g pui  ', { type: 'image/jpeg', data: 'AAAA' });
  assert.equal(r.model, MODEL);
  assert.equal(r.model, 'claude-opus-5-5');
  const content = r.messages[0]!.content as Array<{ type: string; text?: string }>;
  assert.deepEqual(content.map((b) => b.type), ['image', 'text']);
  assert.equal(content[1]!.text, '200 g pui');
  assert.deepEqual(r.output_config?.format, { type: 'json_schema', schema: SCHEMA });
  assert.equal(r.fallbacks, 'default');
  assert.deepEqual(r.betas, ['server-side-fallback-2026-07-01']);
  // thinking is left to the model (adaptive): no budget, no sampling parameters
  assert.ok(!('thinking' in r) && !('temperature' in r));
  // words only: one text block; nothing typed with a photo: a default question
  assert.equal((buildRequest('orez', null).messages[0]!.content as unknown[]).length, 1);
  assert.match((buildRequest('', { type: 'image/jpeg', data: 'AAAA' }).messages[0]!.content as Array<{ text?: string }>)[1]!.text!, /farfurie/);
});

test('the schema is strict: every object closed, every field required', () => {
  const item = SCHEMA.properties.items.items;
  assert.equal(SCHEMA.additionalProperties, false);
  assert.equal(item.additionalProperties, false);
  assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort());
});

test('the answer is cleaned before anything is logged', () => {
  const meal = cleanMeal({
    note: ' Uleiul e estimat. ',
    items: [
      { name: 'piept de pui la grătar', grams: 200, kcal_100g: 165, protein_100g: 31, carbs_100g: 0, fat_100g: 3.6, fiber_100g: 0, confidence: 'high' },
      { name: 'orez alb fiert', grams: 180.4, kcal_100g: 13000, protein_100g: 2.7, carbs_100g: 28, fat_100g: 0.3, fiber_100g: 0.4, confidence: 'medium' },
      { name: '', grams: 50, kcal_100g: 100, protein_100g: 1, carbs_100g: 1, fat_100g: 1, fiber_100g: 0, confidence: 'low' },
      { name: 'apă', grams: 500, kcal_100g: 0, protein_100g: 0, carbs_100g: 0, fat_100g: 0, fiber_100g: 0, confidence: 'high' },
      { name: 'ulei', grams: -5, kcal_100g: 884, protein_100g: 0, carbs_100g: 0, fat_100g: 100, fiber_100g: 0, confidence: 'weird' },
    ],
  });
  assert.deepEqual(meal.items.map((i) => i.name), ['Piept de pui la grătar', 'Orez alb fiert']);
  assert.equal(meal.items[1]!.g, 180);
  // 13.000 kcal per 100 g is impossible: the macros decide (2.7 × 4 + 28 × 4 + 0.3 × 9 ≈ 126)
  assert.equal(meal.items[1]!.kcal, 126);
  assert.equal(meal.note, 'Uleiul e estimat.');
  const e = entryFrom(meal.items[0]!, meal.items[0]!.g);
  assert.deepEqual([e.kcal, e.p], [330, 62]);
  assert.deepEqual(cleanMeal(null), { items: [], note: '' });
  assert.deepEqual(cleanMeal({ items: 'x' }).items, []);
});

test('a declined or cut-off reply is an error, not an empty meal', () => {
  const text = JSON.stringify({ items: [{ name: 'ou fiert', grams: 100, kcal_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11, fiber_100g: 0, confidence: 'high' }], note: '' });
  const ok = readAnswer({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text, citations: null }] } as never);
  assert.equal(ok.items[0]!.name, 'Ou fiert');
  assert.throws(() => readAnswer({ stop_reason: 'refusal', content: [] } as never), /refusal/);
  assert.throws(() => readAnswer({ stop_reason: 'max_tokens', content: [] } as never), /cut/);
});

test('a key has to look like an Anthropic key', () => {
  assert.ok(looksLikeKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz_0123-AA'));
  assert.ok(!looksLikeKey('parola mea'));
  assert.ok(!looksLikeKey('sk-proj-abcdefghijklmnopqrstuvwxyz'));
});
