import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { exportFiles, isoDate, mealSlot, mergeMfp, num, parseCsv, readMfp, unzip } from './mfp.ts';
import { empty } from './store.ts';

const NUTRITION = [
  'Date,Meal,Calories,Fat (g),Saturated Fat,Polyunsaturated Fat,Monounsaturated Fat,Trans Fat,Cholesterol,Sodium (mg),Potassium,Carbohydrates (g),Fiber,Sugar,Protein (g),Note',
  '2026-11-02,Breakfast,820,18,5,2,6,0,40,600,700,95,12,10,62,',
  '2026-11-02,Lunch,950,22,6,3,7,0,80,900,900,110,9,6,70,"rice, chicken"',
  '2026-11-02,Snacks,300,8,2,1,3,0,0,100,200,35,3,20,15,',
  '2026-11-03,Breakfast,700,15,4,2,5,0,30,500,600,80,10,8,55,',
].join('\r\n');
const PROGRESS = 'Date,Weight\n2026-11-02,134.2\n2026-11-03,133.9\n';

test('mfp: csv, numbers and dates as an export writes them', () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\n'), [['a', 'b, c', 'say "hi"'], ['1', '2', '3']]);
  assert.deepEqual([num('1,234.5'), num('12,5'), num(' 820 '), num('')], [1234.5, 12.5, 820, 0]);
  assert.deepEqual([isoDate('2026-11-02'), isoDate('11/2/2026'), isoDate('02.11.2026'), isoDate('Total')], ['2026-11-02', '2026-11-02', '2026-11-02', null]);
  assert.deepEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Masa 5'].map((m) => mealSlot(m, ['Masa 5'])), [0, 1, 2, 3, 0]);
});

test('mfp: an export goes into the journal and the weights; importing again replaces only what it put there', () => {
  const d = readMfp([{ name: 'Nutrition-Summary.csv', text: NUTRITION }, { name: 'Progress-Summary.csv', text: PROGRESS }, { name: 'Exercise-Summary.csv', text: 'Date,Exercise,Exercise Calories\n2026-11-02,Rowing,400\n' }], 134);
  assert.equal(d.read, 2);
  assert.deepEqual(Object.keys(d.meals), ['2026-11-02', '2026-11-03']);
  assert.deepEqual(d.meals['2026-11-02']!.map((m) => [m.meal, m.kcal, m.p, m.c, m.f, m.fiber]), [['Breakfast', 820, 62, 95, 18, 12], ['Lunch', 950, 70, 110, 22, 9], ['Snacks', 300, 15, 35, 8, 3]]);
  assert.deepEqual(d.weights, { '2026-11-02': 134.2, '2026-11-03': 133.9 });
  const s = empty();
  s.days['2026-11-02'] = [[{ id: 'own', name: 'Banana', g: 120, kcal: 107, p: 1.3, c: 27, f: 0.4, fiber: 3 }], [], [], [], []];
  assert.deepEqual(mergeMfp(s, d), { days: 2, weighIns: 2 });
  assert.deepEqual(s.days['2026-11-02']!.map((m) => m.map((e) => e.name)), [['Banana', 'MyFitnessPal · Breakfast'], ['MyFitnessPal · Lunch'], [], ['MyFitnessPal · Snacks'], []]);
  mergeMfp(s, d);
  assert.equal(s.days['2026-11-02']!.flat().length, 4);
  assert.equal(s.weights['2026-11-03'], 133.9);
});

test('mfp: pounds are turned into kilograms', () => {
  assert.deepEqual(readMfp([{ name: 'p.csv', text: 'Date,Weight (lbs)\n2026-11-02,295.9\n' }]).weights, { '2026-11-02': 134.2 });
  assert.deepEqual(readMfp([{ name: 'p.csv', text: 'Date,Weight\n2026-11-02,295.9\n' }], 134).weights, { '2026-11-02': 134.2 });
});

/** A ZIP as MyFitnessPal sends it: deflated files, sizes in the central directory. */
function zip(files: [string, string][]): ArrayBuffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let off = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text), comp = deflateRawSync(data), nb = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    parts.push(lh, nb, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, nb);
    off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  const all = Buffer.concat([...parts, cd, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length) as ArrayBuffer;
}

test('mfp: the e-mailed ZIP is read whole, its CSV files picked out', async () => {
  const buf = zip([['File-Export/Nutrition-Summary.csv', NUTRITION], ['File-Export/Progress-Summary.csv', PROGRESS], ['File-Export/readme.txt', 'x']]);
  assert.deepEqual((await unzip(buf)).map((f) => f.name), ['File-Export/Nutrition-Summary.csv', 'File-Export/Progress-Summary.csv', 'File-Export/readme.txt']);
  const files = await exportFiles([{ name: 'export.zip', arrayBuffer: async () => buf }]);
  assert.equal(files.length, 2);
  const d = readMfp(files, 134);
  assert.equal(d.meals['2026-11-03']![0]!.kcal, 700);
  assert.equal(d.weights['2026-11-02'], 134.2);
});
