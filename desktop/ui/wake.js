// A see-through window over the whole display that only draws Kō's wake. Clicks never land on it. When no glyph is left
// it stops drawing altogether, so a resting Kō costs nothing here.
import { listen, isDemo } from './bridge.js';
import { createWake } from './wake-core.js';

const COLORS = { ink: 'rgb(238,234,224)', accent: 'rgb(91,123,255)', acid: 'rgb(212,255,58)' };
const OUTLINE = 'rgba(9,11,17,.5)'; // the cream glyphs need it on a pale wallpaper
const canvas = document.getElementById('wake'), ctx = canvas.getContext('2d');
const wake = createWake({ size: 150 });
let W = 0, H = 0, dpr = 1, raf = 0, last = 0, prev = null;

function layout() {
  W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.25); // small fading glyphs don't need more
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  prev = null;
}
addEventListener('resize', layout);
layout();

const fonts = [];
const fontFor = (px) => fonts[px] || (fonts[px] = `500 ${px}px "DM Mono", ui-monospace, Consolas, monospace`);

function draw(now) {
  raf = 0;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const left = wake.step(dt);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  if (!left) return; // cleared, and nothing more to do until he moves again
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.strokeStyle = OUTLINE;
  let font = '', col = '';
  for (const b of wake.bits) {
    const p = b.age / b.life, f = fontFor(Math.max(5, Math.round(b.size * (1 - p * 0.45))));
    ctx.globalAlpha = (1 - p) * (1 - p) * (b.streak !== false ? 0.55 : 0.9);
    if (f !== font) ctx.font = font = f;
    if (b.col !== col) ctx.fillStyle = COLORS[col = b.col];
    if (b.streak !== false) {
      const c = Math.cos(b.streak), s = Math.sin(b.streak);
      ctx.setTransform(dpr * c, dpr * s, -dpr * s, dpr * c, b.x * dpr, b.y * dpr);
      ctx.strokeText(b.g, 0, 0); ctx.fillText(b.g, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else { ctx.strokeText(b.g, b.x, b.y); ctx.fillText(b.g, b.x, b.y); }
  }
  ctx.globalAlpha = 1;
  raf = requestAnimationFrame(draw);
}
function wakeUp() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } }

/** He is at (x, y): the middle of his body, in CSS pixels on this display. */
function moved(x, y) {
  const now = performance.now();
  if (prev) {
    const dt = (now - prev.t) / 1000, dx = x - prev.x, dy = y - prev.y;
    // a jump means another display or a long gap, not flight
    if (dt > 0 && dt < 0.5 && Math.hypot(dx, dy) < 400) { wake.emit(x, y, dx / dt, dy / dt, dt); if (wake.bits.length) wakeUp(); }
  }
  prev = { x, y, t: now };
}
listen('ko-moved', (p) => moved(p.x, p.y));
listen('ko-visible', (visible) => { prev = null; if (!visible) { wake.bits.length = 0; wakeUp(); } });

if (isDemo) window.koWake = { moved, wake };
