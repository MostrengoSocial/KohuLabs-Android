// What Kō is paying attention to: your typing, a window you just switched to, or your mouse.
// Pure logic, tested with `node --test desktop/ui/attention.test.mjs`. All points are screen pixels.
// He is told only that a key went down and where the text cursor is, never which key.

const WINDOW_GLANCE_MS = 1300, TYPING_MS = 1600, MOUSE_MS = 4000, PERCH_AFTER_MS = 5000, BURST_GAP_MS = 2500, NEAR_PX = 240;

export function createAttention() {
  let mouse = null, mouseAt = -Infinity, typedAt = -Infinity, burstFrom = -Infinity, focus = null, focusExact = false, glance = null, glanceAt = -Infinity;
  return {
    mouseMoved(x, y, now) { mouse = { x, y }; mouseAt = now; },
    keyPressed(point, now) {
      if (now - typedAt > BURST_GAP_MS) burstFrom = now;
      typedAt = now;
      if (point) { focus = { x: point.x, y: point.y }; focusExact = !!point.exact; }
    },
    windowChanged(point, now) { glance = point; glanceAt = now; },
    /** kx, ky: the middle of Kō's body. */
    now(now, kx, ky) {
      const typing = now - typedAt < TYPING_MS;
      if (now - glanceAt < WINDOW_GLANCE_MS && glance && !typing) return { what: 'window', point: glance };
      if (typing && focus) return { what: 'typing', point: focus, perch: focusExact && now - burstFrom >= PERCH_AFTER_MS };
      if (typing) return { what: 'typing', point: mouse, perch: false };
      if (mouse && now - mouseAt < MOUSE_MS) return { what: Math.hypot(mouse.x - kx, mouse.y - ky) < NEAR_PX ? 'mouse-near' : 'mouse', point: mouse };
      return { what: 'nothing', point: null };
    },
  };
}

/**
 * Where to sit and watch you type, as a spot for his window's top-left inside the work area: beside the text cursor
 * and clear of it, on the right if there is room. null when he is close enough already, or there is no good spot.
 * caret and current are in the same coordinates as the area (0, 0 at its corner).
 */
export function perchFor(caret, current, area, win = { w: 240, h: 260 }, gap = 170, closeEnough = 520) {
  if (caret.x < 0 || caret.y < 0 || caret.x > area.w || caret.y > area.h) return null; // on another display
  const middle = { x: current.x + win.w / 2, y: current.y + win.h / 2 };
  if (Math.hypot(middle.x - caret.x, middle.y - caret.y) < closeEnough) return null;
  const right = caret.x + gap, left = caret.x - gap - win.w;
  const x = right + win.w <= area.w ? right : left >= 0 ? left : null;
  if (x === null) return null;
  return { x, y: Math.max(0, Math.min(area.h - win.h, caret.y - win.h / 2)) };
}
