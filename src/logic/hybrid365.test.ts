import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify, FALLBACK_WEEK, weight, weightKey, DEFAULT_WEIGHTS, type Weights } from './training.ts';
import { intraAdvice } from './timing.ts';

test('the Hybrid365 week: strength days HIGH, threshold and long run MODERATE, Sunday recovery', () => {
  assert.deepEqual(FALLBACK_WEEK.map((d) => classify(d).demand), ['high', 'moderate', 'high', 'high', 'high', 'moderate', 'rest']);
  assert.match(classify(FALLBACK_WEEK[3]!).reason, /picioare/, 'Lower Body is the leg day');
});

test('runs weigh by their effort: threshold above long, long above Zone 2, the walk is a walk', () => {
  const s = (id: string) => FALLBACK_WEEK.flat().find((x) => x.id === id)!;
  assert.equal(weightKey(s('tue-thr')), 'thr');
  assert.equal(weightKey(s('sat-long')), 'long');
  assert.equal(weightKey(s('mon-run')), 'run');
  assert.equal(weightKey(s('sun-walk')), 'walk');
  assert.equal(weightKey(s('fri-emom')), 'amrap', 'the Power Finisher is an EMOM, not mobility');
  assert.ok(weight(s('tue-thr')) > weight(s('sat-long')) && weight(s('sat-long')) > weight(s('mon-run')));
});

test('a long run of 90 minutes is a HIGH day and asks for carbs during it', () => {
  const long = { ...FALLBACK_WEEK[5]![0]!, min: 90 };
  assert.equal(classify([long]).demand, 'high');
  assert.equal(intraAdvice([long], 'normal').level, 'advised');
});

test('weights saved before the new run kinds existed fall back to the defaults', () => {
  const { thr: _t, long: _l, ...old } = DEFAULT_WEIGHTS;
  assert.equal(weight(FALLBACK_WEEK[1]![1]!, old as Weights), DEFAULT_WEIGHTS.thr);
});
