// Kō's own window: small, transparent, always on top. It moves around the screen; clicks only land on Kō himself
// (src-tauri's watcher lets everything else through to the windows below).
import { invoke, listen, isDemo } from './bridge.js';
import { createRoamer, BEHAVIOURS } from './roam.js';
import { attention, dayView, langOf } from './day.js';
import { createAttention, perchFor } from './attention.js';

const WIN = { w: 240, h: 260 };           // logical pixels, as in tauri.conf.json
const HIT = { cx: 120, cy: 162, r: 74 };  // Kō's body inside the window
const GAZE_REACH = 85;                    // how far from his middle his eyes' target sits
const SYNC_MS = 5 * 60 * 1000, CHECK_MS = 20 * 1000, NAP_PAUSE_MS = 20 * 1000, MOVE_MS = 33;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const stage = document.getElementById('stage'), bubble = document.getElementById('bubble');
const signal = window.KohuSignal.create(stage, { theme: 'dark', particles: 0, glyphs: 900, glyphSize: 'auto', camDist: 3.7, orbit: false, follow: 0.35, trackDocument: true, autoMoods: false });

let tables = null, current = null, currentSince = 0; // the first frames can run while we wait below
let area = await invoke('ko_area');
const roamer = createRoamer({ width: area.w / area.scale, height: area.h / area.scale, size: WIN.w,
  x: Math.max(0, area.w / area.scale - WIN.w - 40), y: Math.max(0, area.h / area.scale - WIN.h - 10) });
if (reducedMotion) roamer.hold(true);

const flags = { hover: false, drag: false, idle: false, paused: false, hidden: false, typing: false, thinking: false };
const applyHold = () => { if (!reducedMotion) roamer.hold(flags.hover || flags.drag || flags.idle || flags.paused || flags.typing || flags.thinking); };

// ---- what he looks like ------------------------------------------------------------------------------------------
let shown = '', noticed = 'nothing';
function look() {
  const called = !!current;
  const want = called ? 'called' : flags.idle ? 'sleeping' : flags.thinking ? 'thinking' : flags.hover ? 'hover' : flags.typing ? 'typing' : noticed === 'window' ? 'glance' : noticed === 'mouse-near' ? 'near' : roamer.held ? 'still' : roamer.behaviour;
  if (want === shown) return;
  shown = want;
  if (want === 'called') { signal.setMood('surprised', { duration: 1.2 }); signal.setState('speaking'); signal.flash(); }
  else if (want === 'sleeping') { signal.setMood('sleepy'); signal.setState('idle'); }
  else if (want === 'hover') { signal.setMood('curious'); signal.setState('listening'); }
  else if (want === 'thinking') { signal.setMood('neutral'); signal.setState('thinking'); }
  else if (want === 'typing') { signal.setMood('curious'); signal.setState('listening'); }
  else if (want === 'glance' || want === 'near') { signal.setMood('curious'); signal.setState('idle'); }
  else if (want === 'still') { signal.setMood('neutral'); signal.setState('idle'); }
  else { signal.setMood(BEHAVIOURS[want][0]); signal.setState(BEHAVIOURS[want][1]); }
}

// While he sleeps through your break, nothing is drawn at all.
let napTimer = 0;
function setRendering() {
  clearTimeout(napTimer);
  if (flags.hidden) return signal.setPaused(true);
  signal.setPaused(false);
  if (flags.idle) napTimer = setTimeout(() => signal.setPaused(true), NAP_PAUSE_MS);
}

// ---- what he looks at: you ----------------------------------------------------------------------------------------
const attn = createAttention();
const gaze = document.createElement('div');
gaze.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;visibility:hidden';
document.body.appendChild(gaze);
signal.lookAt(gaze);
let perching = false, gazing = true;
const toArea = (p) => ({ x: (p.x - area.x) / area.scale, y: (p.y - area.y) / area.scale });
function notice() {
  const now = performance.now(), kx = area.x + (roamer.x + HIT.cx) * area.scale, ky = area.y + (roamer.y + HIT.cy) * area.scale;
  const a = attn.now(now, kx, ky);
  noticed = a.what;
  const typing = a.what === 'typing';
  if (typing !== flags.typing) {
    flags.typing = typing; applyHold();
    if (!typing && perching) { perching = false; roamer.release(); }
  }
  if (a.perch && !perching && !current && !reducedMotion && !flags.drag && !flags.paused) {
    const spot = perchFor(toArea(a.point), { x: roamer.x, y: roamer.y }, { w: area.w / area.scale, h: area.h / area.scale }, WIN);
    if (spot) { perching = true; roamer.call(spot.x, spot.y, 170); }
  }
  // Nothing to look at: back to his own thoughts.
  if (!a.point) { if (gazing) { gazing = false; signal.lookAt(null); } return; }
  if (!gazing) { gazing = true; signal.lookAt(gaze); }
  // Only the direction matters: a target far away would pull his whole body out of place, so it sits just outside him.
  const p = toArea(a.point), dx = p.x - (roamer.x + HIT.cx), dy = p.y - (roamer.y + HIT.cy), d = Math.hypot(dx, dy) || 1, reach = Math.min(d, GAZE_REACH);
  gaze.style.transform = `translate(${(HIT.cx + (dx / d) * reach).toFixed(1)}px, ${(HIT.cy + (dy / d) * reach).toFixed(1)}px)`;
}

// ---- moving the window --------------------------------------------------------------------------------------------
let sent = 0, sending = false;
function send(force) {
  const now = performance.now();
  if (sending || (!force && now - sent < MOVE_MS)) return;
  sent = now; sending = true;
  const x = Math.round(area.x + roamer.x * area.scale), y = Math.round(area.y + roamer.y * area.scale);
  if (isDemo) { sending = false; return; }
  invoke('move_ko', { x, y, lx: roamer.x + HIT.cx, ly: roamer.y + HIT.cy }).catch(() => {}).finally(() => { sending = false; });
}
// He leans into his flight and stretches a little with speed, as in the homepage intro.
let tilt = 0, stretch = 0;
function lean(vx, vy, dt) {
  tilt += (Math.max(-0.2, Math.min(0.2, vx / 1600)) - tilt) * (1 - Math.exp(-6 * dt));
  stretch += (Math.min(0.07, Math.hypot(vx, vy) / 6000) - stretch) * (1 - Math.exp(-10 * dt));
  stage.style.transform = `rotate(${tilt.toFixed(3)}rad) scale(${(1 + stretch).toFixed(3)}, ${(1 - stretch * 0.6).toFixed(3)})`;
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; // a frame's clock can start before ours
  if (flags.hidden) return;
  const px = roamer.x, py = roamer.y;
  roamer.step(dt); notice(); look();
  lean((roamer.x - px) / (dt || 1 / 60), (roamer.y - py) / (dt || 1 / 60), dt);
  if (!flags.drag) send();
}
requestAnimationFrame(frame);
setInterval(async () => { // displays and the taskbar change; a drag can land on another display
  const a = await invoke('ko_area').catch(() => null);
  if (!a || flags.drag) return;
  if (a.x !== area.x || a.y !== area.y || a.w !== area.w || a.h !== area.h || a.scale !== area.scale) {
    area = a; roamer.resize(a.w / a.scale, a.h / a.scale); hitRegions();
  }
}, 5000);

// ---- where clicks land --------------------------------------------------------------------------------------------
function hitRegions() {
  const b = bubble.hidden ? null : bubble.getBoundingClientRect();
  invoke('set_hit', { cx: HIT.cx, cy: HIT.cy, r: HIT.r, bx: b ? b.left : 0, by: b ? b.top : 0, bw: b ? b.width : 0, bh: b ? b.height : 0 }).catch(() => {});
}

// ---- click to open, drag to move ------------------------------------------------------------------------------------
let press = null;
stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  stage.setPointerCapture(e.pointerId);
  press = { sx: e.screenX, sy: e.screenY, x: roamer.x, y: roamer.y, moved: false };
});
stage.addEventListener('pointermove', (e) => {
  if (!press) return;
  const dx = e.screenX - press.sx, dy = e.screenY - press.sy;
  if (!press.moved && Math.hypot(dx, dy) < 5) return;
  if (!press.moved) { press.moved = true; flags.drag = true; applyHold(); stage.classList.add('dragging'); invoke('set_dragging', { dragging: true }).catch(() => {}); }
  roamer.place(press.x + dx, press.y + dy);
  send(true);
});
function endPress() {
  if (!press) return;
  const clicked = !press.moved; press = null;
  if (clicked) return openToday();
  flags.drag = false; stage.classList.remove('dragging'); applyHold();
  invoke('set_dragging', { dragging: false }).catch(() => {});
  invoke('ko_area').then((a) => { if (a) { area = a; roamer.resize(a.w / a.scale, a.h / a.scale); } }).catch(() => {});
}
stage.addEventListener('pointerup', endPress);
stage.addEventListener('pointercancel', () => { if (press) { press.moved = true; endPress(); } });
bubble.addEventListener('click', () => openToday());

function openToday() {
  signal.pulse();
  if (current) dismiss();
  invoke('open_panel').catch(() => {});
}

// ---- your day, and when he comes to you --------------------------------------------------------------------------
const dismissed = new Set();
function dismiss() {
  if (!current) return;
  dismissed.add(current.key); current = null; shown = '';
  bubble.hidden = true; roamer.release(); perching = false; hitRegions();
}
function check() {
  if (current && Date.now() - currentSince > 3 * 60 * 1000) dismiss(); // said it long enough
  if (!tables || current || flags.hidden) return;
  const now = new Date(), a = attention(dayView(tables, now), now, dismissed, langOf(tables));
  if (!a) return;
  current = a; currentSince = Date.now();
  bubble.textContent = a.text; bubble.hidden = false; hitRegions();
  roamer.call(area.w / area.scale - WIN.w - 24, area.h / area.scale - WIN.h - 8); // the bottom right, by the clock
}
const useDay = (d) => { if (d && d.tables) { tables = d.tables; check(); } };
async function syncNow() { useDay(await invoke('sync_day').catch(() => null)); }
useDay(await invoke('get_day').catch(() => null));
syncNow();
setInterval(syncNow, SYNC_MS);
setInterval(check, CHECK_MS);

// ---- what the desktop side tells us ----------------------------------------------------------------------------------
listen('ko-hover', (hover) => { flags.hover = hover; applyHold(); });
listen('ko-idle', (idle) => {
  flags.idle = idle; applyHold(); shown = ''; setRendering();
  if (!idle) { signal.setMood('surprised', { duration: 1 }); signal.pulse(); } // you're back!
});
listen('ko-thinking', (on) => {
  flags.thinking = on; applyHold(); shown = '';
  if (!on) { signal.flash(); signal.setMood('happy', { duration: 1.5 }); }
});
listen('ko-mouse', (p) => attn.mouseMoved(p.x, p.y, performance.now()));
listen('ko-key', (p) => attn.keyPressed(p, performance.now()));
listen('ko-window', (p) => { attn.windowChanged(p, performance.now()); signal.pulse(0.25); });
listen('ko-roaming', (roaming) => { flags.paused = !roaming; applyHold(); });
listen('ko-visible', (visible) => { flags.hidden = !visible; setRendering(); if (visible) { last = performance.now(); send(true); } });
listen('day-updated', useDay);
listen('auth-changed', (account) => { if (account) syncNow(); else { tables = null; if (current) dismiss(); dismissed.clear(); } });

hitRegions();
send(true);
if (isDemo) window.koDebug = { roamer, flags, attn, gaze, signal, dismiss: () => dismiss(), get noticed() { return noticed; }, get area() { return area; }, check: () => check(), get current() { return current; } };
