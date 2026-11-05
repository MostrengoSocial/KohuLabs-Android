import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoamer, BEHAVIOURS } from './roam.js';

const seeded = (s = 7) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const make = (o = {}) => createRoamer({ width: 1920, height: 1040, size: 240, random: seeded(), ...o });

test('he stays around the screen for hours, and tries every behaviour', () => {
  const r = make(), seen = new Set();
  for (let i = 0; i < 2 * 3600 * 30; i++) {
    r.step(1 / 30); seen.add(r.behaviour);
    assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y));
    assert.ok(r.x >= -160 && r.x <= 1920 - 240 + 160, `x ${r.x} during ${r.behaviour}`);
    assert.ok(r.y >= -40 && r.y <= 1040 - 240 + 40, `y ${r.y} during ${r.behaviour}`);
  }
  assert.deepEqual([...seen].sort(), Object.keys(BEHAVIOURS).sort());
});

test('swoops and loops stay on the screen and really fly', () => {
  const r = make(); let fastest = 0, px = r.x, py = r.y, swoops = 0, was = '';
  for (let i = 0; i < 3600 * 30; i++) {
    r.step(1 / 30);
    if (r.behaviour === 'swoop' || r.behaviour === 'loop') {
      assert.ok(r.x >= -90 && r.x <= 1770 && r.y >= -10 && r.y <= 810, `${r.behaviour} at ${r.x}, ${r.y}`); // he may set off from a peek, half past the edge
      fastest = Math.max(fastest, Math.hypot(r.x - px, r.y - py) * 30);
    }
    if (r.behaviour === 'swoop' && was !== 'swoop') swoops++;
    was = r.behaviour; px = r.x; py = r.y;
  }
  assert.ok(fastest > 300, String(fastest));
  assert.ok(swoops > 20, String(swoops));
});

test('he stays on a screen smaller than usual, and after the screen shrinks', () => {
  const r = make({ width: 300, height: 280 });
  for (let i = 0; i < 3000; i++) r.step(1 / 30);
  r.resize(260, 260); r.step(1 / 30);
  assert.ok(r.x < 260 + 240 && r.y <= 40);
});

test('hold stops him; letting go starts him again', () => {
  const r = make(); r.step(0.1);
  r.hold(true); const { x, y } = r;
  for (let i = 0; i < 100; i++) r.step(1 / 30);
  assert.deepEqual([r.x, r.y], [x, y]);
  r.hold(false); for (let i = 0; i < 30; i++) r.step(1 / 30);
  assert.ok(r.x !== x || r.y !== y);
});

test('a drop places him; a call brings him to the spot and keeps him there until released', () => {
  const r = make(); r.place(10, 20); assert.deepEqual([r.x, r.y], [10, 20]);
  r.call(1600, 700); assert.ok(r.called);
  for (let i = 0; i < 300; i++) r.step(1 / 30);
  assert.deepEqual([r.x, r.y], [1600, 700]);
  r.release(); assert.ok(!r.called);
  for (let i = 0; i < 60; i++) r.step(1 / 30);
  assert.ok(r.x !== 1600 || r.y !== 700);
});

test('a call beyond the screen stays on the screen', () => {
  const r = make(); r.call(99999, 99999);
  for (let i = 0; i < 400; i++) r.step(1 / 30);
  assert.deepEqual([r.x, r.y], [1680, 800]);
});
