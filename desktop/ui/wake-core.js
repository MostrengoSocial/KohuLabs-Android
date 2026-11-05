// Kō's wake: the glyphs he leaves behind so he reads as flying, not as a ball sliding across the screen. The same idea
// as the homepage intro (site/js/intro.js in the KohuLabs repository), tuned for his gentler speeds on the desktop:
// glyphs start at his back edge and last longer, or a slow Kō would outlive none of them.
// Pure logic, tested with `node --test desktop/ui/wake-core.test.mjs`.

export const POOL = '0101010101.:·+*=<>[]{}/\\|~-;'; // his glyphs, weighted towards 0 and 1 like the cloud
export const STREAKS = ['--', '---', '- -', '~~', '==', '=-=', '·-·'];
const MAX_BITS = 420, MIN_SPEED = 30, SPACING = 3.5;

export function createWake({ size = 150, random = Math.random } = {}) {
  const bits = [];
  const pick = (s) => s[(random() * s.length) | 0];
  let carry = 0;
  return {
    bits,
    /** He moved to (x, y) at (vx, vy) px/s, over dt seconds. */
    emit(x, y, vx, vy, dt) {
      const speed = Math.hypot(vx, vy);
      if (speed < MIN_SPEED) return;
      const ux = vx / speed, uy = vy / speed, r = size * 0.36, slow = 1 - Math.min(1, speed / 300);
      carry += (speed * dt) / SPACING;
      if (bits.length > MAX_BITS) carry = Math.min(carry, 1); // a ceiling, for a hard drag
      for (; carry >= 1; carry--) {
        const off = (random() - 0.5) * 2 * r, back = size * (0.34 + random() * 0.26), along = random() * speed * dt, c = random();
        bits.push({ x: x - ux * (back + along) - uy * off, y: y - uy * (back + along) + ux * off,
          vx: -ux * speed * 0.06 + (random() - 0.5) * 40, vy: -uy * speed * 0.06 + (random() - 0.5) * 40 + 8,
          age: 0, life: (0.55 + random() * 0.8) * (1 + slow * 0.9), g: pick(POOL), size: 12 + random() * 8, col: c < 0.22 ? 'accent' : c > 0.975 ? 'acid' : 'ink', streak: false });
      }
      if (random() < (speed * dt) / 60) { // speed lines along the direction of travel
        const off = (random() - 0.5) * size * 0.5, back = size * 0.5;
        bits.push({ x: x - ux * back - uy * off, y: y - uy * back + ux * off, vx: -ux * speed * 0.15, vy: -uy * speed * 0.15,
          age: 0, life: 0.35 + random() * 0.3, g: pick(STREAKS), size: 12 + random() * 6, col: random() < 0.3 ? 'accent' : 'ink', streak: Math.atan2(uy, ux) });
      }
    },
    /** Ages and moves the glyphs, and drops the dead ones. Returns how many are left. */
    step(dt) {
      const drag = Math.exp(-2.2 * dt);
      let n = 0;
      for (let i = 0; i < bits.length; i++) {
        const b = bits[i];
        b.age += dt;
        if (b.age >= b.life) continue;
        bits[n++] = b;
        b.vx *= drag; b.vy *= drag; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.streak === false && random() < dt * 5) b.g = pick(POOL); // glyphs flip as they fade, like the cloud
      }
      bits.length = n;
      return n;
    },
  };
}
