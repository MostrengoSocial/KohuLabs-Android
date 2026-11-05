// How Kō moves around the desktop. Pure logic (no DOM, no Tauri), the same behaviours as his home on the phone
// (web/founders/founders.js), so it is tested on its own: `node --test desktop/ui/roam.test.mjs`.
// Positions are CSS pixels inside the screen's work area, for the top-left corner of Kō's window.

// behaviour: [mood, state, seconds, how likely]. Roaming stays calm: the 'thinking' and 'speaking' states make his
// glyphs race, and are kept for when he is really working on an answer.
export const BEHAVIOURS = {
  stroll: ['happy', 'idle', 6, 3],
  dash: ['happy', 'idle', 2.6, 1],
  wander: ['curious', 'idle', 7, 3],
  peek: ['curious', 'listening', 5, 2],
  nap: ['sleepy', 'idle', 6, 2],
  ponder: ['neutral', 'idle', 5, 2],
  hum: ['happy', 'idle', 3.5, 2],
  swoop: ['happy', 'idle', 0, 5],    // a long curved flight across the screen; how long depends on how far
  loop: ['happy', 'idle', 0, 2], // a wide loop-the-loop
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CALL_SPEED = 420; // px/s when he comes to you
const SWOOP_SPEED = 380, LOOP_SPIN = 2.1; // px/s, rad/s
const ease = (t) => t * t * (3 - 2 * t);

export function createRoamer({ width, height, size, x, y, random = Math.random }) {
  let W = width, H = height;
  const k = { x: x ?? (W - size) / 2, y: y ?? (H - size) / 2, vx: 0, vy: 0, a: 0, t: 0, dur: 0, baseY: 0, cx: 0, cy: 0, tx: 0, beh: 'stroll', turn: false };
  let held = false, target = null;
  const bounds = () => ({ minX: 0, maxX: Math.max(0, W - size), minY: 0, maxY: Math.max(0, H - size) });

  function enter(b) {
    k.beh = b; k.t = 0; k.dur = BEHAVIOURS[b][2] * (0.8 + random() * 0.4);
    const dir = random() < 0.5 ? -1 : 1;
    if (b === 'stroll') { k.vx = dir * 45; k.baseY = k.y; k.turn = false; }
    if (b === 'dash') { k.vx = dir * 260; k.vy = (random() - 0.5) * 60; }
    if (b === 'wander') k.a = random() * Math.PI * 2;
    if (b === 'peek') k.tx = dir < 0 ? -size * 0.35 : Math.max(0, W - size) + size * 0.35; // half hidden at a screen edge
    if (b === 'nap') k.vx = dir * 20;
    if (b === 'ponder') { k.a = 0; k.cx = k.x - 28; k.cy = k.y; }
    if (b === 'hum') k.baseY = k.y;
    if (b === 'swoop') {
      const { minX, maxX, minY, maxY } = bounds(), to = { x: minX + random() * (maxX - minX), y: minY + random() * (maxY - minY) };
      const dx = to.x - k.x, dy = to.y - k.y, d = Math.hypot(dx, dy) || 1, bend = (random() < 0.5 ? -1 : 1) * d * (0.25 + random() * 0.3);
      // the curve's control point sits to one side, kept on screen so the whole flight is
      k.sw = { x0: k.x, y0: k.y, x1: to.x, y1: to.y, cx: clamp((k.x + to.x) / 2 - (dy / d) * bend, minX, maxX), cy: clamp((k.y + to.y) / 2 + (dx / d) * bend, minY, maxY) };
      k.dur = clamp(d / SWOOP_SPEED, 1.2, 6);
    }
    if (b === 'loop') {
      const { minX, maxX, minY, maxY } = bounds(), R = Math.min(130, (maxX - minX) / 3, (maxY - minY) / 3);
      k.lr = R; k.cx = clamp(k.x, minX + R, Math.max(minX + R, maxX - R)); k.cy = clamp(k.y - R, minY + R, Math.max(minY + R, maxY - R));
      k.a = Math.atan2(k.y - k.cy, k.x - k.cx); k.dur = (Math.PI * 2) / LOOP_SPIN;
    }
  }

  function pick() {
    const keys = Object.keys(BEHAVIOURS).filter((b) => b !== k.beh);
    let r = random() * keys.reduce((n, b) => n + BEHAVIOURS[b][3], 0);
    for (const b of keys) { r -= BEHAVIOURS[b][3]; if (r <= 0) return enter(b); }
    enter(keys[keys.length - 1]);
  }

  enter('stroll');

  return {
    get x() { return k.x; },
    get y() { return k.y; },
    get behaviour() { return k.beh; },
    get held() { return held; },
    get called() { return !!target; },
    /** The screen changed (another display, the taskbar moved). */
    resize(w, h) { W = w; H = h; if (!target) { const b = bounds(); k.x = clamp(k.x, b.minX - size, b.maxX + size); k.y = clamp(k.y, b.minY, b.maxY); k.baseY = k.y; k.cx = k.x; k.cy = k.y; } },
    /** Stops him where he is: the pointer is on him, he is being dragged, or you have stepped away. */
    hold(v) { const was = held; held = !!v; if (was && !held && !target) enter('stroll'); },
    /** Where a drag dropped him. */
    place(x, y) { k.x = x; k.y = y; k.baseY = y; k.cx = x; k.cy = y; },
    /** Something needs you: he goes to this spot and stays until release(). */
    call(x, y, speed = CALL_SPEED) { const b = bounds(); target = { x: clamp(x, b.minX, b.maxX), y: clamp(y, b.minY, b.maxY), speed }; },
    release() { if (target) { target = null; if (!held) enter('stroll'); } },
    step(dt) {
      if (!(dt > 0)) return;
      if (target) {
        const dx = target.x - k.x, dy = target.y - k.y, d = Math.hypot(dx, dy), move = target.speed * dt;
        if (d <= move) { k.x = target.x; k.y = target.y; } else { k.x += (dx / d) * move; k.y += (dy / d) * move; }
        return;
      }
      if (held) return;
      const { minX, maxX, minY, maxY } = bounds(), b = k.beh, e = Math.min(1, dt * 2), M = 60;
      k.t += dt;
      if (b === 'stroll') {
        const near = (k.vx > 0 && k.x > maxX - M) || (k.vx < 0 && k.x < minX + M);
        if (near) k.turn = true;
        if (k.turn) { const goal = (k.x > (minX + maxX) / 2 ? -1 : 1) * 45; k.vx += (goal - k.vx) * Math.min(1, dt * 1.1); if (Math.abs(k.vx - goal) < 2) k.turn = false; }
        k.x += k.vx * dt; k.baseY += (clamp(k.baseY, minY + 14, Math.max(minY + 14, maxY - 14)) - k.baseY) * e;
        k.y = k.baseY + Math.sin(k.t * 1.6) * 8;
      } else if (b === 'dash') {
        k.x += k.vx * dt; k.y += k.vy * dt;
        if (k.x < minX || k.x > maxX) { k.vx = -k.vx; k.x = clamp(k.x, minX, maxX); }
        if (k.y < minY || k.y > maxY) { k.vy = -k.vy; k.y = clamp(k.y, minY, maxY); }
      } else if (b === 'wander') {
        k.a += (random() - 0.5) * dt * 3;
        if (k.x < minX + M || k.x > maxX - M || k.y < minY + M || k.y > maxY - M) {
          const to = Math.atan2((minY + maxY) / 2 - k.y, (minX + maxX) / 2 - k.x), d = Math.atan2(Math.sin(to - k.a), Math.cos(to - k.a));
          k.a += d * Math.min(1, dt * 2.5);
        }
        k.x += Math.cos(k.a) * 55 * dt; k.y += Math.sin(k.a) * 55 * dt;
      } else if (b === 'peek') {
        k.x += (k.tx - k.x) * Math.min(1, dt * 1.6);
      } else if (b === 'nap') {
        k.x += k.vx * dt; k.vx *= Math.max(0, 1 - dt * 1.5); k.y += 3 * dt;
      } else if (b === 'ponder') {
        k.cx = clamp(k.cx, minX + 30, Math.max(minX + 30, maxX - 30)); k.cy = clamp(k.cy, minY + 20, Math.max(minY + 20, maxY - 20));
        k.a += dt * 1.3; k.x = k.cx + Math.cos(k.a) * 28; k.y = k.cy + Math.sin(k.a) * 18;
      } else if (b === 'hum') {
        k.baseY = clamp(k.baseY, minY + 14, Math.max(minY + 14, maxY)); k.y = k.baseY - Math.abs(Math.sin(k.t * 5)) * 12;
      } else if (b === 'swoop') {
        const t = ease(Math.min(1, k.t / k.dur)), u = 1 - t, q = k.sw;
        k.x = u * u * q.x0 + 2 * u * t * q.cx + t * t * q.x1; k.y = u * u * q.y0 + 2 * u * t * q.cy + t * t * q.y1;
      } else if (b === 'loop') {
        k.a += LOOP_SPIN * dt; k.x = k.cx + Math.cos(k.a) * k.lr; k.y = k.cy + Math.sin(k.a) * k.lr;
      }
      if (b !== 'peek') { // anything else that drifted past the edge eases back (peek ends by returning too)
        if (k.x < minX) k.x += (minX - k.x) * e; else if (k.x > maxX) k.x += (maxX - k.x) * e;
        if (k.y < minY) k.y += (minY - k.y) * e; else if (k.y > maxY) k.y += (maxY - k.y) * e;
      }
      if (k.t > k.dur) pick();
    },
  };
}
