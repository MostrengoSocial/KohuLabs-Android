import test from 'node:test';
import assert from 'node:assert/strict';
import { createWake } from './wake-core.js';

const seeded = (s = 11) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const fly = (w, speed, seconds) => { let x = 0; for (let i = 0; i < seconds * 30; i++) { x += speed / 30; w.emit(x, 0, speed, 0, 1 / 30); w.step(1 / 30); } return x; };

test('standing still leaves nothing; moving does, behind him', () => {
  const w = createWake({ random: seeded() });
  w.emit(0, 0, 10, 0, 1); assert.equal(w.bits.length, 0);
  const x = fly(w, 120, 2);
  assert.ok(w.bits.length > 10);
  assert.ok(w.bits.every((b) => b.x < x), 'all behind him');
});

test('even a stroll shows past his body, and it goes on being there', () => {
  const w = createWake({ size: 150, random: seeded() });
  const x = fly(w, 45, 4);
  assert.ok(w.bits.some((b) => x - b.x > 100), 'reaches beyond the disc behind him');
});

test('it fades away by itself, so the canvas can stop drawing', () => {
  const w = createWake({ random: seeded() }); fly(w, 300, 1);
  for (let i = 0; i < 4 * 30; i++) w.step(1 / 30);
  assert.equal(w.bits.length, 0);
});

test('a frantic drag stays near the ceiling', () => {
  const w = createWake({ random: seeded() }); fly(w, 6000, 3);
  assert.ok(w.bits.length < 600, String(w.bits.length));
});
