import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttention, perchFor } from './attention.js';

test('he follows the mouse for a few seconds, and is curious when it comes close', () => {
  const a = createAttention();
  assert.equal(a.now(0, 0, 0).what, 'nothing');
  a.mouseMoved(1000, 500, 100);
  assert.deepEqual(a.now(200, 0, 0), { what: 'mouse', point: { x: 1000, y: 500 } });
  assert.equal(a.now(200, 900, 450).what, 'mouse-near');
  assert.equal(a.now(5000, 0, 0).what, 'nothing');
});

test('typing wins over the mouse, and he looks at the text cursor when he knows it', () => {
  const a = createAttention(); a.mouseMoved(10, 10, 0);
  a.keyPressed({ x: 400, y: 300, exact: true }, 100);
  const r = a.now(200, 0, 0);
  assert.equal(r.what, 'typing'); assert.deepEqual(r.point, { x: 400, y: 300 }); assert.equal(r.perch, false);
});

test('he only moves closer after a long stretch of typing, and only with an exact cursor', () => {
  const a = createAttention();
  for (let t = 0; t <= 6000; t += 500) a.keyPressed({ x: 1, y: 1, exact: true }, t);
  assert.equal(a.now(6100, 0, 0).perch, true);
  const b = createAttention();
  for (let t = 0; t <= 6000; t += 500) b.keyPressed({ x: 1, y: 1, exact: false }, t);
  assert.equal(b.now(6100, 0, 0).perch, false);
  const c = createAttention(); c.keyPressed({ x: 1, y: 1, exact: true }, 0); c.keyPressed({ x: 1, y: 1, exact: true }, 6000); // a pause starts again
  assert.equal(c.now(6100, 0, 0).perch, false);
});

test('a window you switch to gets a glance, unless you are typing', () => {
  const a = createAttention(); a.windowChanged({ x: 5, y: 6 }, 0);
  assert.equal(a.now(500, 0, 0).what, 'window');
  assert.equal(a.now(2000, 0, 0).what, 'nothing');
  a.windowChanged({ x: 5, y: 6 }, 3000); a.keyPressed({ x: 1, y: 1 }, 3000);
  assert.equal(a.now(3100, 0, 0).what, 'typing');
});

test('his perch never covers the text cursor, and stays on the display', () => {
  const area = { w: 1920, h: 1040 }, far = { x: 1600, y: 700 };
  const clear = (p, c) => c.x < p.x || c.x > p.x + 240 || c.y < p.y || c.y > p.y + 260;
  for (const caret of [{ x: 300, y: 200 }, { x: 1800, y: 40 }, { x: 960, y: 1030 }]) {
    const p = perchFor(caret, caret.x > 960 ? { x: 0, y: 0 } : far, area);
    assert.ok(p && clear(p, caret), JSON.stringify(p));
    assert.ok(p.x >= 0 && p.x + 240 <= 1920 && p.y >= 0 && p.y + 260 <= 1040);
  }
  assert.equal(perchFor({ x: 1600, y: 700 }, { x: 1500, y: 600 }, area), null, 'already close');
  assert.equal(perchFor({ x: 3000, y: 100 }, far, area), null, 'another display');
  assert.equal(perchFor({ x: 200, y: 100 }, { x: 900, y: 500 }, { w: 500, h: 400 }), null, 'no room');
});
