/* Kō - Kohu Labs mascot renderer.
 *
 * A plain script (no modules, so it also runs from file://) that defines window.KohuSignal:
 *
 *   const s = KohuSignal.create(stageElement, { form: 'cloud', theme: 'dark', ... });
 *   s.setState('listening' | 'thinking' | 'speaking' | 'idle');
 *   s.flash();                       // one acid blink: "an answer or action is ready"
 *   s.shape('bars' | 'line' | 'donut' | { type: 'bars', values: [...] } | { text: '96%' } | null);
 *   s.lookAt(element | null);        // keep its gaze on an element (e.g. the chat input)
 *   s.setMood('happy' | 'curious' | 'confused' | 'sorry' | 'sleepy' | 'surprised' | 'neutral', { duration });
 *   s.pulse(); s.setTheme(); s.setForm(); s.setEyes(); s.setMode(); s.setPaused(); s.set(name, value);
 *
 * Options include glyphs (count), glyphSize (px, or 'auto' to scale with the stage), particles (0 for none),
 * camDist, follow / wander (how far it moves), orbit, clickPulse, keyboard and trackDocument (watch the
 * pointer anywhere on the page, for small launchers), autoMoods (sleepy when left alone for sleepAfter
 * seconds, curious when the pointer comes close, surprised when clicked) and markSide (1 puts the "?" and
 * the z's to the right of the head, -1 to the left), markSize and eyeScale (bigger marks or eyes, for small stages).
 *
 * The stage element gets two canvases: a 2D preview (shown until WebGL draws, and as the
 * fallback) and the WebGL view. Rendering pauses while the stage is off screen or the tab is hidden.
 */
(function () {
'use strict';

const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOTION = reduceMotion ? 0.45 : 1;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rand = (a, b) => a + Math.random() * (b - a);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const BODY = [1, .84, .88]; // the creature's ellipsoid radii
const FOV = Math.PI / 4, LIGHT_DIR = [-.75, .95, .45];

// Site palettes (css/styles.css). Dark draws light additively; light draws ink normally.
const THEMES = {
  dark: { film: '#5b7bff', tint: '#eeeae0', irid: .25, filmAlpha: 1, points: ['#3a6dff', '#eeeae0', '#d4ff3a'], alphaMul: .5, additive: true },
  light: { film: '#1c3dff', tint: '#0c0e14', irid: .06, filmAlpha: .5, points: ['#1c3dff', '#0c0e14', '#9fc000'], alphaMul: 1, additive: false }
};
const EYES = {
  auto: { label: 'Ink', dark: '#eeeae0', light: '#0c0e14' },
  cream: { label: 'Cream', dark: '#eeeae0', light: '#eeeae0' },
  black: { label: 'Black', dark: '#0c0e14', light: '#0c0e14' },
  cobalt: { label: 'Cobalt', dark: '#5b7bff', light: '#1c3dff' },
  acid: { label: 'Acid', dark: '#d4ff3a', light: '#c6ee00' }
};
// What each assistant state does to the creature.
//   churn: how fast glyphs flip and the cloud's shells turn   lid: eyelids held closed (1 = a line)
//   eyes: eye colour override   size: eye size   gather: outer data pulled in   talk: speaking bounce
const STATES = {
  idle: { churn: 1, lid: 0, eyes: null, size: 1, gather: 0, talk: 0 },
  listening: { churn: .55, lid: 0, eyes: 'cobalt', size: 1.15, gather: 0, talk: 0 },
  thinking: { churn: 4.5, lid: .86, eyes: null, size: 1, gather: 1, talk: 0 },
  speaking: { churn: 1.8, lid: 0, eyes: null, size: 1, gather: 0, talk: 1 }
};
// Moods sit on top of the states: how it feels rather than what it is doing. The eyes stay flat
// dots and only change shape (arc = a happy ^, lid = half closed, tilt = droopy, size per eye).
//   roll: head tilt   sink: drops (or lifts, if negative)   dim: fades   lean: leans towards the pointer
//   lookDown / dart: where the eyes go   breath: slower, deeper breathing   noBlink: wide-eyed
const NEUTRAL = { arc: 0, sizeL: 1, sizeR: 1, lid: 0, tilt: 0, roll: 0, sink: 0, churn: 1, dim: 0, lean: 0, lookDown: 0, dart: 0, breath: 1, noBlink: 0 };
const MOODS = {
  neutral: NEUTRAL,
  happy: Object.assign({}, NEUTRAL, { arc: 1, churn: 1.5, sink: -.04 }),
  curious: Object.assign({}, NEUTRAL, { sizeR: 1.18, roll: .2, lean: 1, churn: .8 }),
  confused: Object.assign({}, NEUTRAL, { sizeL: .78, sizeR: 1.12, roll: -.24, dart: 1, churn: 1.3 }),
  sorry: Object.assign({}, NEUTRAL, { lid: .5, tilt: .38, sink: .12, dim: .3, churn: .45, lookDown: 1, breath: .7 }),
  sleepy: Object.assign({}, NEUTRAL, { lid: .8, sink: .08, dim: .25, churn: .12, lookDown: .5, breath: 2.6 }),
  surprised: Object.assign({}, NEUTRAL, { sizeL: 1.45, sizeR: 1.45, churn: 2.4, noBlink: 1 })
};
// Seconds before a mood fades back to neutral (Infinity: until something changes it).
const MOOD_TIME = { neutral: Infinity, happy: 2.6, curious: 3, confused: 2.8, sorry: 3.4, sleepy: Infinity, surprised: 1.2 };
const EYE_K = 9; // discs per eye: stacked they make a dot, spread along a curve they make an arc

/* ---------- Shaders ---------- */
const HIGHP = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';

// Bubble body. Displacement is smooth, and normals use the inverse scale so lighting holds while it squashes.
const meshVS = `attribute vec3 a_pos;attribute vec3 a_norm;
uniform mat4 u_viewProj;uniform mat4 u_model;uniform mat4 u_rot;uniform vec3 u_invScale;uniform float u_time;uniform float u_wobble;
varying vec3 v_world;varying vec3 v_normal;varying vec3 v_local;
void main(){vec3 p=a_pos;
float n=sin(p.x*5.+u_time*.8)*.025+sin(p.y*6.-u_time*.5)*.018+cos(p.z*4.+u_time*.6)*.02;
p+=a_norm*n*u_wobble;
vec4 w=u_model*vec4(p,1.);v_world=w.xyz;v_local=p;v_normal=(u_rot*vec4(a_norm*u_invScale,0.)).xyz;
gl_Position=u_viewProj*w;}`;
const meshFS = HIGHP + `uniform vec3 u_film;uniform vec3 u_tint;uniform float u_irid;uniform float u_opacity;uniform float u_ftime;uniform float u_dissolve;uniform float u_glow;uniform float u_backface;uniform vec3 u_eye;uniform vec3 u_light;
varying vec3 v_world;varying vec3 v_normal;varying vec3 v_local;
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1.,0.,0.)),f.x),mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),
mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x),mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
void main(){
float d=noise(v_local*3.2)*.7+noise(v_local*7.1)*.3;
float edge=d-(u_dissolve*1.1-.05);if(edge<0.)discard;
float burn=(1.-smoothstep(0.,.06,edge))*step(.001,u_dissolve);
vec3 N=normalize(v_normal);if(!gl_FrontFacing)N=-N;
vec3 V=normalize(u_eye-v_world);vec3 H=normalize(normalize(u_light)+V);
float fres=pow(1.-abs(dot(N,V)),1.6);
float spec=pow(max(dot(N,H),0.),140.);float sheen=pow(max(dot(N,H),0.),16.)*.05;
float h=noise(v_local*2.2+vec3(0.,u_ftime*.05,0.))*.75+noise(v_local*4.7-vec3(u_ftime*.03))*.25;
float line=smoothstep(.43,.49,abs(fract(h*8.)-.5));
vec3 irid=.5+.5*cos(6.2832*(fres*1.1+h*.7+vec3(0.,.33,.67)));
vec3 cream=vec3(.933,.918,.878);
vec3 col=mix(u_film,u_tint,.3)+irid*fres*u_irid+vec3(spec)+cream*sheen+u_film*u_glow*.6+vec3(.45,.65,1.)*burn*1.6;
float a=u_opacity*(.03+.8*fres+.2*line)+spec*.8+sheen+burn+u_glow*.06;
a=clamp(a*(u_backface>.5?.5:1.),0.,1.);
gl_FragColor=vec4(col*a,a);}`;

// Eyes: two flat, unlit discs. A blink flattens them into a line.
const eyeVS = `attribute vec3 a_pos;uniform mat4 u_viewProj;uniform mat4 u_model;
void main(){gl_Position=u_viewProj*u_model*vec4(a_pos,1.);}`;
const eyeFS = `precision mediump float;uniform vec3 u_color;void main(){gl_FragColor=vec4(u_color,1.);}`;

// Round data points (outer field, and the terrain inside the bubble).
const pointVS = `attribute vec4 a_pos;attribute float a_tint;uniform mat4 u_viewProj;uniform mat4 u_model;uniform float u_size;varying float v_alpha;varying float v_tint;
void main(){gl_Position=u_viewProj*u_model*vec4(a_pos.xyz,1.);gl_PointSize=clamp(u_size*(1.+step(1.5,a_tint)*1.4)*4.7/gl_Position.w,1.,u_size*4.);v_alpha=a_pos.w;v_tint=a_tint;}`;
const pointFS = `precision mediump float;uniform vec3 u_c0;uniform vec3 u_c1;uniform vec3 u_c2;uniform float u_alphaMul;varying float v_alpha;varying float v_tint;
void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.1,.5,d))*clamp(v_alpha,0.,1.);
vec3 col=v_tint<.5?u_c0:v_tint<1.5?u_c1:u_c2;gl_FragColor=vec4(col*a,a*u_alphaMul);}`;

// ASCII cloud: glyph sprites cut from an atlas. Shells turn at different speeds (u_spin), glyphs
// flip over time (u_flick), a space clears round the eyes, and u_morph pulls every glyph to a
// second position (a_shape) so the cloud can briefly become a chart or a number.
const GLYPHS = '01.:·+*=<>[]{}/\\|~-;';
const cloudVS = `attribute vec3 a_pos;attribute float a_seed;attribute vec4 a_shape;
uniform mat4 u_viewProj;uniform mat4 u_model;uniform vec3 u_eyePos;uniform vec3 u_center;uniform vec3 u_eyeL;uniform vec3 u_eyeR;uniform float u_eyeClear;
uniform float u_time;uniform float u_spin;uniform float u_flick;uniform float u_dissolve;uniform float u_wobble;uniform float u_size;uniform float u_glyphN;uniform float u_morph;uniform float u_markScale;uniform float u_markBoost;
varying float v_alpha;varying float v_glyph;varying float v_tint;
float h1(float k){return fract(sin(k*12.9898)*43758.5453);}
void main(){float s=a_seed;vec3 p=a_pos;
float ang=u_spin*(.08+.22*(1.-length(p)))*(fract(s*5.1)<.5?1.:-1.)*.6;float c=cos(ang),sn=sin(ang);p.xz=mat2(c,-sn,sn,c)*p.xz;
p+=normalize(p)*(sin(p.x*5.+u_time*.8)*.025+sin(p.y*6.-u_time*.5)*.018+cos(p.z*4.+u_time*.6)*.02)*u_wobble;
vec3 q=a_shape.xyz+vec3(sin(u_time*1.3+s*40.),cos(u_time*1.1+s*30.),0.)*.008;
float mm=u_morph*step(0.,a_shape.w);
p=mix(p,q,mm);
p*=1.+u_dissolve*(.4+1.8*fract(s*13.7));
float clear=p.z>.3?smoothstep(.1*u_eyeClear,.2*u_eyeClear,min(distance(p,u_eyeL),distance(p,u_eyeR))):1.;
clear=mix(clear,1.,mm);
vec4 w=u_model*vec4(p,1.);gl_Position=u_viewProj*w;
float k=floor(u_flick*(.25+1.8*fract(s*3.1))+s*10.);
float h=h1(k+s*91.),h2=h1(k*1.37+s*17.);
v_glyph=h<.62?floor(h2*2.):2.+floor(h2*(u_glyphN-2.));
float facing=dot(normalize(w.xyz-u_center),normalize(u_eyePos-u_center));
v_alpha=mix(.22+.78*smoothstep(-.6,.9,facing),max(a_shape.w,0.)*u_markBoost,mm)*clear*(1.-u_dissolve*.85);
float t=fract(s*91.7);v_tint=t<.14?1.:t>.993?2.:0.;
gl_PointSize=u_size*(.75+.5*fract(s*7.7))*mix(1.,u_markScale,mm)*4.7/gl_Position.w;}`;
const cloudFS = `precision mediump float;uniform sampler2D u_atlas;uniform float u_glyphCount;uniform float u_opacity;uniform float u_alphaMul;
uniform vec3 u_c0;uniform vec3 u_c1;uniform vec3 u_c2;varying float v_alpha;varying float v_glyph;varying float v_tint;
void main(){vec2 pc=gl_PointCoord;float m=texture2D(u_atlas,vec2((v_glyph+pc.x)/u_glyphCount,pc.y)).a;
float a=m*v_alpha*u_opacity;if(a<.004)discard;
vec3 col=v_tint<.5?u_c0:v_tint<1.5?u_c1:u_c2;gl_FragColor=vec4(col*a,a*u_alphaMul);}`;

/* ---------- Geometry and matrices (column-major) ---------- */
function ellipsoid(lat, lon, rx, ry, rz) { // correct normals, outward-facing CCW winding
  const p = [], n = [], idx = [];
  for (let y = 0; y <= lat; y++) {
    const phi = y / lat * Math.PI;
    for (let x = 0; x <= lon; x++) {
      const theta = x / lon * Math.PI * 2;
      const ux = Math.sin(phi) * Math.cos(theta), uy = Math.cos(phi), uz = Math.sin(phi) * Math.sin(theta);
      p.push(ux * rx, uy * ry, uz * rz);
      const nx = ux / rx, ny = uy / ry, nz = uz / rz, l = Math.hypot(nx, ny, nz) || 1;
      n.push(nx / l, ny / l, nz / l);
    }
  }
  for (let y = 0; y < lat; y++) for (let x = 0; x < lon; x++) { const a = y * (lon + 1) + x, b = a + lon + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  return { p: new Float32Array(p), n: new Float32Array(n), idx: new Uint16Array(idx) };
}
const bodyGeo = ellipsoid(64, 96, BODY[0], BODY[1], BODY[2]), eyeGeo = ellipsoid(10, 32, 1, 1, 1);
function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
function perspective(fovy, aspect, near, far) { const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), o = new Float32Array(16); o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf; return o; }
function lookAtM(eye, x, y, z) { const o = new Float32Array(16); o[0] = x[0]; o[1] = y[0]; o[2] = z[0]; o[4] = x[1]; o[5] = y[1]; o[6] = z[1]; o[8] = x[2]; o[9] = y[2]; o[10] = z[2]; o[12] = -dot(x, eye); o[13] = -dot(y, eye); o[14] = -dot(z, eye); o[15] = 1; return o; }
const translate = (x, y, z) => { const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; o[12] = x; o[13] = y; o[14] = z; return o; };
const scale = (x, y, z) => { const o = new Float32Array(16); o[0] = x; o[5] = y; o[10] = z; o[15] = 1; return o; };
function rotYX(yaw, pitch) { // Ry(yaw) * Rx(pitch): +Z forward turns toward (sin yaw, -sin pitch, cos yaw)
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return new Float32Array([cy, 0, -sy, 0, sy * sp, cp, cy * sp, 0, sy * cp, -sp, cy * cp, 0, 0, 0, 0, 1]);
}
const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const LIGHT = norm(LIGHT_DIR);

/* ---------- Glyph atlas (shared by every instance) ---------- */
const atlas = document.createElement('canvas');
const atlasListeners = new Set();
function drawAtlas() {
  const cell = 64, c = atlas.getContext('2d');
  atlas.width = cell * GLYPHS.length; atlas.height = cell;
  c.clearRect(0, 0, atlas.width, atlas.height);
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '500 46px "DM Mono", ui-monospace, Menlo, Consolas, monospace';
  for (let g = 0; g < GLYPHS.length; g++) c.fillText(GLYPHS[g], g * cell + cell / 2, cell / 2 + 2);
}
drawAtlas();
let fontRequested = false;
function loadFont(url) { // the site's DM Mono; when it can't load (e.g. file:// in some browsers) monospace is used
  if (fontRequested || !window.FontFace) return; fontRequested = true;
  new FontFace('DM Mono', `url(${url})`, { weight: '500' }).load()
    .then(f => { document.fonts.add(f); drawAtlas(); atlasListeners.forEach(fn => fn()); }).catch(() => {});
}

/* ---------- Chart shapes the cloud can morph into (local space, facing +Z) ---------- */
function shapePositions(spec, n) {
  const out = new Float32Array(n * 4);
  const put = (i, x, y, a) => { out[i * 4] = x; out[i * 4 + 1] = y; out[i * 4 + 2] = rand(-.05, .05); out[i * 4 + 3] = a; };
  const type = typeof spec === 'string' ? spec : (spec.text != null ? 'text' : spec.type);
  if (type === 'bars') {
    const v = (spec.values || [.45, .7, .55, .95, .8]), max = Math.max(...v), k = v.length, w = 1.7 / k;
    for (let i = 0; i < n; i++) {
      if (i % 16 === 0) { put(i, rand(-.88, .88), -.66, .55); continue; } // baseline
      const b = i % k, h = v[b] / max * 1.25;
      put(i, -.85 + b * w + rand(w * .12, w * .82), -.62 + rand(0, h), 1);
    }
  } else if (type === 'line') {
    const v = spec.values || [.2, .45, .35, .6, .5, .85, .75], max = Math.max(...v);
    const yAt = x => { const t = (x + .85) / 1.7 * (v.length - 1), j = Math.min(v.length - 2, Math.floor(t)), f = t - j; return -.62 + (v[j] + (v[j + 1] - v[j]) * f) / max * 1.15; };
    for (let i = 0; i < n; i++) {
      const x = rand(-.85, .85);
      if (i % 16 === 0) put(i, rand(-.88, .88), -.66, .55);
      else if (i % 9 < 5) put(i, x, yAt(x) + rand(-.025, .025), 1);
      else put(i, x, rand(-.62, yAt(x)), .22);
    }
  } else if (type === 'donut') {
    const v = spec.values || [.45, .3, .25], sum = v.reduce((a, b) => a + b, 0), shade = [1, .62, .36, .2];
    let acc = 0; const segs = v.map((x, j) => { const s = { a0: acc / sum, a1: (acc + x) / sum, alpha: shade[j % shade.length] }; acc += x; return s; });
    for (let i = 0; i < n; i++) {
      const s = segs[i % segs.length], t = rand(s.a0 + .012, s.a1 - .012), ang = Math.PI / 2 - t * Math.PI * 2, r = rand(.46, .74);
      put(i, Math.cos(ang) * r, Math.sin(ang) * r - .02, s.alpha);
    }
  } else if (type === 'text') {
    // Rasterise the text and scatter glyphs over its filled pixels.
    const c = document.createElement('canvas'), ctx = c.getContext('2d'); c.width = 320; c.height = 120;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 104px "DM Mono", ui-monospace, Menlo, monospace';
    const str = String(spec.text), tw = ctx.measureText(str).width;
    if (tw > 300) ctx.font = `600 ${Math.floor(104 * 300 / tw)}px "DM Mono", ui-monospace, Menlo, monospace`;
    ctx.fillText(str, 160, 62);
    const d = ctx.getImageData(0, 0, 320, 120).data, filled = [];
    for (let y = 0; y < 120; y += 2) for (let x = 0; x < 320; x += 2) if (d[(y * 320 + x) * 4 + 3] > 128) filled.push([x, y]);
    for (let i = 0; i < n; i++) {
      if (!filled.length) { put(i, 0, 0, 0); continue; }
      const [x, y] = filled[(Math.random() * filled.length) | 0];
      put(i, (x - 160) / 160 * .95 + rand(-.005, .005), -(y - 60) / 160 * .95, 1);
    }
  }
  return out;
}

/* ---------- One mascot ---------- */
function create(stage, options) {
  const o = Object.assign({
    form: 'cloud', theme: 'dark', eyes: 'auto', particles: 1800, glyphs: 1700, glyphSize: 13,
    camDist: 4.7, follow: 1, wander: 1, orbit: true, clickPulse: true, keyboard: false, trackDocument: false,
    opacity: .58, response: .75, fontUrl: null, onStatus: () => {}, autoMoods: false, sleepAfter: 7, markSide: 1, markSize: 1, eyeScale: 1
  }, options || {});
  if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
  const preview = document.createElement('canvas'), canvas = document.createElement('canvas');
  for (const c of [preview, canvas]) { c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; c.setAttribute('aria-hidden', 'true'); stage.appendChild(c); }
  const status = t => o.onStatus(t);
  if (o.fontUrl) loadFont(o.fontUrl);

  let form = o.form, theme = THEMES[o.theme] ? o.theme : 'dark', eyeKey = EYES[o.eyes] ? o.eyes : 'auto', mode = 'follow';
  let paused = false, opacity = o.opacity, response = o.response, particleCount = o.particles;
  let state = 'idle', gazeEl = null, shapeTarget = 0, shapeIsText = false, morph = 0, flashAt = -1e9;
  let mood = 'neutral', moodUntil = Infinity, autoCurious = false, markActive = false, markKind = null, zTemplate = null, hops = [], lastActivity = performance.now(), breathPhase = 0;
  const mf = Object.assign({}, NEUTRAL);
  const fx = { churn: 1, lid: 0, size: 1, gather: 0, talk: 0 }, eyeRGB = hex(EYES[eyeKey][theme]);
  let spin = 0, flick = 0;

  /* 2D preview: a flat glyph cloud, shown until WebGL draws and as the fallback */
  const pctx = preview.getContext('2d');
  const previewPts = Array.from({ length: Math.min(420, Math.round(o.glyphs / 3)) }, () => {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * (.55 + .45 * Math.random());
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * BODY[1], s: Math.random() };
  });
  let previewOn = false, previewRaf = 0, previewTime = 0;
  function previewResize() {
    const r = stage.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    preview.width = Math.max(1, Math.round(r.width * d)); preview.height = Math.max(1, Math.round(r.height * d));
    pctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function previewFrame() {
    if (!previewOn) return;
    const w = stage.clientWidth, h = stage.clientHeight, cx = w / 2, cy = h / 2, r = Math.min(w, h) * .3, ctx = pctx, T = THEMES[theme];
    previewTime += .016 * MOTION; ctx.clearRect(0, 0, w, h);
    ctx.font = `500 ${Math.max(6, Math.round(r * .075))}px "DM Mono", ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of previewPts) {
      const g = GLYPHS[Math.floor((Math.sin(Math.floor(previewTime * (.5 + p.s * 2) + p.s * 10) * 12.9898 + p.s * 78.2) * 43758.5453 % 1 + 1) % 1 * (p.s < .6 ? 2 : GLYPHS.length))];
      ctx.globalAlpha = .35 + .5 * p.s; ctx.fillStyle = p.s > .86 ? T.points[1] : T.points[0];
      ctx.fillText(g, cx + p.x * r + Math.sin(previewTime + p.s * 6) * 2, cy + p.y * r);
    }
    ctx.globalAlpha = 1;
    const lid = (previewTime % 4.2) < .08 ? .15 : 1, er = Math.max(2, r * .05);
    ctx.fillStyle = EYES[eyeKey][theme]; ctx.beginPath();
    ctx.ellipse(cx - r * .26, cy - r * .1, er, er * lid, 0, 0, Math.PI * 2); ctx.ellipse(cx + r * .26, cy - r * .1, er, er * lid, 0, 0, Math.PI * 2);
    ctx.fill();
    previewRaf = requestAnimationFrame(previewFrame);
  }
  function showPreview(on) {
    previewOn = on; preview.style.display = on ? '' : 'none'; cancelAnimationFrame(previewRaf);
    if (on) { previewResize(); previewFrame(); }
  }
  showPreview(true);

  /* Plain-JS controls that work with or without WebGL */
  const api = {
    canvas, get state() { return state; },
    setTheme(t) { if (THEMES[t]) { theme = t; redraw(); } },
    setEyes(k) { if (EYES[k]) { eyeKey = k; redraw(); } },
    setForm(f) { form = f === 'bubble' ? 'bubble' : 'cloud'; redraw(); },
    setMode() {}, setPaused() {}, set() {}, pulse() {}, flash() {}, shape() {}, lookAt() {}, setState(s) { if (STATES[s]) state = s; },
    setMood(m) { if (MOODS[m]) mood = m; }, get mood() { return mood; }
  };
  function redraw() { if (!raf && R) render(); }

  /* WebGL */
  let gl = null;
  const glOpts = { alpha: true, antialias: true, depth: true, premultipliedAlpha: true, powerPreference: 'high-performance' };
  try { gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts); } catch (e) {}
  let R = null, raf = 0;
  if (!gl) { status('WebGL unavailable - showing compatibility preview'); return api; }

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    return s;
  }
  function makeProgram(vs, fs, attribs, uniforms) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    attribs.forEach((n, i) => gl.bindAttribLocation(p, i, n));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
    const u = {}; uniforms.forEach(n => { u[n] = gl.getUniformLocation(p, n); });
    return { p, u };
  }

  // Outer field: each particle orbits a home ring and springs toward it, so forces displace it
  // and it drifts back naturally.
  const MAX_P = Math.max(particleCount, 3500);
  const home = new Float32Array(MAX_P * 4), pos = new Float32Array(MAX_P * 3), vel = new Float32Array(MAX_P * 3);
  const baseAlpha = new Float32Array(MAX_P), glow = new Float32Array(MAX_P), gpuParticles = new Float32Array(MAX_P * 5);
  for (let i = 0; i < MAX_P; i++) {
    const r = rand(1.3, 3.4), a = rand(0, Math.PI * 2), y = rand(-1.5, 1.5) * (1.15 - (r - 1.3) / 5);
    home[i * 4] = r; home[i * 4 + 1] = a; home[i * 4 + 2] = y; home[i * 4 + 3] = rand(.03, .11);
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
    baseAlpha[i] = rand(.2, .8); gpuParticles[i * 5 + 4] = Math.random() < .22 ? 1 : 0;
  }
  // The terrain inside the bubble form.
  const GRID = 25, INNER_R = .7, TILT_C = Math.cos(.62), TILT_S = Math.sin(.62), inner = [];
  for (let gx = 0; gx < GRID; gx++) for (let gz = 0; gz < GRID; gz++) {
    const x = (gx / (GRID - 1) * 2 - 1) * INNER_R, z = (gz / (GRID - 1) * 2 - 1) * INNER_R, r = Math.hypot(x, z);
    if (r <= INNER_R) inner.push([x, z, 1 - smooth(INNER_R * .7, INNER_R, r)]);
  }
  const gpuInner = new Float32Array(inner.length * 5);
  const terrain = (x, z, t) => (Math.sin(x * 3.1 + t * .6) * Math.cos(z * 2.7 - t * .4) * .6 + Math.sin((x + z) * 4.3 + t * .9) * .3 + Math.cos(x * 6.1 - z * 2.2 - t * .5) * .1) * .13;
  // The cloud: random directions, biased towards the surface so the silhouette reads.
  const CLOUD_N = o.glyphs, cloudData = new Float32Array(CLOUD_N * 4);
  for (let i = 0; i < CLOUD_N; i++) {
    const u = rand(-1, 1), t = rand(0, Math.PI * 2), q = Math.sqrt(1 - u * u), r = .3 + .72 * Math.pow(Math.random(), .3);
    cloudData[i * 4] = q * Math.cos(t) * r * BODY[0]; cloudData[i * 4 + 1] = u * r * BODY[1]; cloudData[i * 4 + 2] = q * Math.sin(t) * r * BODY[2];
    cloudData[i * 4 + 3] = Math.random();
  }
  let shapeData = new Float32Array(CLOUD_N * 4);
  const eyeLocal = [[-.26, .1, .8], [.26, .1, .8]];

  function initGL() {
    const buf = (target, data, usage) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage || gl.STATIC_DRAW); return b; };
    R = {
      mesh: makeProgram(meshVS, meshFS, ['a_pos', 'a_norm'], ['u_viewProj', 'u_model', 'u_rot', 'u_invScale', 'u_time', 'u_ftime', 'u_wobble', 'u_opacity', 'u_dissolve', 'u_glow', 'u_backface', 'u_eye', 'u_light', 'u_film', 'u_tint', 'u_irid']),
      eye: makeProgram(eyeVS, eyeFS, ['a_pos'], ['u_viewProj', 'u_model', 'u_color']),
      point: makeProgram(pointVS, pointFS, ['a_pos', 'a_tint'], ['u_viewProj', 'u_model', 'u_size', 'u_c0', 'u_c1', 'u_c2', 'u_alphaMul']),
      cloud: makeProgram(cloudVS, cloudFS, ['a_pos', 'a_seed', 'a_shape'], ['u_viewProj', 'u_model', 'u_eyePos', 'u_center', 'u_eyeL', 'u_eyeR', 'u_eyeClear', 'u_time', 'u_spin', 'u_flick', 'u_dissolve', 'u_wobble', 'u_size', 'u_glyphN', 'u_glyphCount', 'u_atlas', 'u_opacity', 'u_alphaMul', 'u_c0', 'u_c1', 'u_c2', 'u_morph', 'u_markScale', 'u_markBoost']),
      bodyPos: buf(gl.ARRAY_BUFFER, bodyGeo.p), bodyNorm: buf(gl.ARRAY_BUFFER, bodyGeo.n), bodyIdx: buf(gl.ELEMENT_ARRAY_BUFFER, bodyGeo.idx),
      eyePos: buf(gl.ARRAY_BUFFER, eyeGeo.p), eyeIdx: buf(gl.ELEMENT_ARRAY_BUFFER, eyeGeo.idx),
      particles: buf(gl.ARRAY_BUFFER, gpuParticles, gl.DYNAMIC_DRAW), inner: buf(gl.ARRAY_BUFFER, gpuInner, gl.DYNAMIC_DRAW),
      cloudBuf: buf(gl.ARRAY_BUFFER, cloudData), shapeBuf: buf(gl.ARRAY_BUFFER, shapeData, gl.DYNAMIC_DRAW), atlasTex: gl.createTexture()
    };
    uploadAtlas();
  }
  function uploadAtlas() {
    gl.bindTexture(gl.TEXTURE_2D, R.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  const onAtlas = () => { if (R && !contextLost) { uploadAtlas(); redraw(); } };
  atlasListeners.add(onAtlas);
  function attrib(loc, buffer, size, stride, offset) { gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride || 0, offset || 0); }

  /* State */
  let time = 0, last = 0, onScreen = true, contextLost = false, firstFrame = true;
  let dissolve = 0, energy = 0, squash = 0, squashV = 0, lastDragAt = -1e9;
  const HOME = { yaw: .15, pitch: .12 };
  const cam = { yaw: HOME.yaw, pitch: HOME.pitch, dist: o.camDist, vyaw: 0, vpitch: 0 };
  const body = { p: [0, 0, 0], v: [0, 0, 0], yaw: 0, pitch: 0 };
  const pointer = { nx: 0, ny: 0, inside: false, lastMove: -1e9, down: false, dragged: false, downX: 0, downY: 0, lastX: 0, lastY: 0 };
  const blink = { start: -1, next: 1.5, double: false };
  const pulses = [];
  let W = 1, H = 1, DPR = 1;

  function pulse(strength) {
    const s = strength == null ? 1 : strength;
    pulses.push({ t0: time, o: body.p.slice() }); if (pulses.length > 4) pulses.shift();
    energy = Math.max(energy, s); squashV -= 3.2 * MOTION * s; kick();
  }

  /* Input */
  function trackPointer(e) {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return; // hidden (display: none): no meaningful position, and it would be NaN
    touch();
    pointer.nx = (e.clientX - r.left) / r.width * 2 - 1; pointer.ny = (e.clientY - r.top) / r.height * 2 - 1;
    pointer.inside = true; pointer.lastMove = performance.now();
  }
  if (o.trackDocument) window.addEventListener('pointermove', trackPointer, { passive: true });
  else stage.addEventListener('pointermove', e => { if (!pointer.down) trackPointer(e); });
  stage.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    trackPointer(e); pointer.down = true; pointer.dragged = false;
    pointer.downX = pointer.lastX = e.clientX; pointer.downY = pointer.lastY = e.clientY;
    if (o.orbit && stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!pointer.down) return;
    trackPointer(e);
    if (!pointer.dragged && Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) > 6) pointer.dragged = true;
    if (pointer.dragged && o.orbit) {
      const dx = (e.clientX - pointer.lastX) * .008, dy = (e.clientY - pointer.lastY) * .008;
      cam.yaw -= dx; cam.pitch = clamp(cam.pitch + dy, -1.1, 1.1);
      cam.vyaw = -dx * 30; cam.vpitch = dy * 30; lastDragAt = performance.now();
    }
    pointer.lastX = e.clientX; pointer.lastY = e.clientY;
  });
  function endPointer(e, cancelled) {
    if (!pointer.down) return;
    pointer.down = false;
    if (!cancelled && !pointer.dragged && o.clickPulse) { pulse(); if (o.autoMoods) applyMood('surprised'); }
    if (e.pointerType !== 'mouse' && !o.trackDocument) pointer.inside = false; // touch has no hover
  }
  stage.addEventListener('pointerup', e => endPointer(e, false));
  stage.addEventListener('pointercancel', e => endPointer(e, true));
  stage.addEventListener('pointerleave', () => { if (!pointer.down && !o.trackDocument) pointer.inside = false; });
  if (o.keyboard) stage.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') pulse();
    else if (e.key === 'ArrowLeft') cam.yaw += .2;
    else if (e.key === 'ArrowRight') cam.yaw -= .2;
    else if (e.key === 'ArrowUp') cam.pitch = clamp(cam.pitch - .15, -1.1, 1.1);
    else if (e.key === 'ArrowDown') cam.pitch = clamp(cam.pitch + .15, -1.1, 1.1);
    else return;
    lastDragAt = performance.now(); e.preventDefault(); redraw();
  });

  /* Moods */
  // Any sign of life resets the sleep timer and wakes it up.
  function touch() { lastActivity = performance.now(); if (mood === 'sleepy') applyMood('neutral'); }
  function applyMood(m, duration) {
    const prev = mood; mood = m; autoCurious = false;
    const d = duration != null ? duration : MOOD_TIME[m];
    moodUntil = d ? time + d : Infinity;
    if (m === 'happy') hops = [time, time + .38];
    if (m === 'surprised') { squashV += 3.6 * MOTION; energy = Math.max(energy, .5); blink.start = -1; }
    if (prev === 'sleepy' && m !== 'sleepy') { blink.start = time; blink.double = true; }
    if (m === 'confused') showMark('question'); else if (m === 'sleepy') showMark('zzz'); else if (markActive) { markActive = false; markKind = null; shapeTarget = 0; }
    kick();
  }
  // Marks: a few glyphs leave the cloud and form a small sign beside its head (the rest stay put,
  // a_shape.w = -1). Confused shows a "?"; sleepy lets three z's drift up and fade, on a loop.
  function showMark(kind) {
    if (!R || (shapeTarget && !markActive)) return; // a chart is showing; leave it alone
    markKind = kind; markActive = true; shapeIsText = false; shapeTarget = 1;
    if (kind === 'question') {
      const q = shapePositions({ text: '?' }, CLOUD_N);
      for (let i = 0; i < CLOUD_N; i++) {
        if (i % (o.markSize > 1 ? 2 : 4)) { q[i * 4 + 3] = -1; continue; } // small stages have fewer glyphs: use more of them
        const ms = o.markSize;
        q[i * 4] = (q[i * 4] * 1.3 + 1.05 * o.markSide) * ms; q[i * 4 + 1] = (q[i * 4 + 1] * 1.3 + .95) * ms; q[i * 4 + 2] = .35 + q[i * 4 + 2];
      }
      shapeData = q;
    } else {
      if (!zTemplate) zTemplate = shapePositions({ text: 'z' }, 160);
      updateZzz();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, R.shapeBuf); gl.bufferData(gl.ARRAY_BUFFER, shapeData, gl.DYNAMIC_DRAW);
  }
  function updateZzz() {
    const q = shapeData.length === CLOUD_N * 4 ? shapeData : new Float32Array(CLOUD_N * 4);
    for (let i = 0; i < CLOUD_N; i++) {
      const d = o.markSize > 1 ? 2 : 5;
      if (i % d) { q[i * 4 + 3] = -1; continue; }
      const k = ((i / d) | 0) % 3, j = ((i / (d * 3)) | 0) % 160;              // which z, which point of it
      const p = (time * .2 + k / 3) % 1, sc = .6 + p * .55;               // each z rises, grows and fades
      q[i * 4] = ((.36 + p * .95) * o.markSide + zTemplate[j * 4] * sc) * o.markSize;
      q[i * 4 + 1] = (.36 + p * 1.02 + zTemplate[j * 4 + 1] * sc) * o.markSize;
      q[i * 4 + 2] = .3;
      q[i * 4 + 3] = Math.pow(Math.sin(p * Math.PI), .7);
    }
    shapeData = q;
  }

  /* Simulation */
  const wave = (p, t) => Math.sin(p[0] * 5 + t * .8) * .025 + Math.sin(p[1] * 6 - t * .5) * .018 + Math.cos(p[2] * 4 + t * .6) * .02;
  let viewProj, eye = [0, 0, o.camDist], camRight = [1, 0, 0], camUp = [0, 1, 0], camFwd = [0, 0, -1];
  let model, rot, invScale = [1, 1, 1], eyeModels = [], wobble = 1;

  function updateCamera(dt, now) {
    if (!pointer.dragged || !pointer.down) {
      const k = Math.exp(-4 * dt);
      cam.yaw += cam.vyaw * dt; cam.pitch = clamp(cam.pitch + cam.vpitch * dt, -1.1, 1.1); cam.vyaw *= k; cam.vpitch *= k;
      if (now - lastDragAt > 4000) { const e = 1 - Math.exp(-.6 * dt); cam.yaw += wrapAngle(HOME.yaw - cam.yaw) * e; cam.pitch += (HOME.pitch - cam.pitch) * e; }
    }
    const cp = Math.cos(cam.pitch);
    eye = [Math.sin(cam.yaw) * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * cp * cam.dist];
    const z = norm(eye); camFwd = [-z[0], -z[1], -z[2]];
    camRight = norm(cross([0, 1, 0], z)); camUp = cross(z, camRight);
    viewProj = mul(perspective(FOV, canvas.width / canvas.height, .1, 100), lookAtM(eye, camRight, camUp, z));
  }
  // Where a screen point (stage-relative, -1..1, may lie outside) meets the plane through the origin facing the camera.
  function screenToWorld(nx, ny) {
    const t = Math.tan(FOV / 2), aspect = canvas.width / canvas.height;
    const dir = norm([0, 1, 2].map(i => camFwd[i] + camRight[i] * nx * t * aspect - camUp[i] * ny * t));
    const s = cam.dist / dot(dir, camFwd);
    return [eye[0] + dir[0] * s, eye[1] + dir[1] * s, eye[2] + dir[2] * s];
  }
  function update(dt, now) {
    time += dt * MOTION;
    updateCamera(dt, now);

    // Mood: expire transient moods, then ease every mood effect.
    if (time > moodUntil) applyMood('neutral');
    if (o.autoMoods && o.sleepAfter && mood === 'neutral' && state === 'idle' && shapeTarget === 0 && now - lastActivity > o.sleepAfter * 1000) applyMood('sleepy');
    const MD = MOODS[mood];
    for (const k in mf) mf[k] = approach(mf[k], MD[k], k === 'arc' || k === 'noBlink' ? 9 : 4, dt);
    while (hops.length && time >= hops[0]) { hops.shift(); body.v[1] += 1.5 * MOTION; squashV += 2.2 * MOTION; }

    // Assistant state: ease every effect towards the state's settings.
    const S = STATES[state];
    for (const k in fx) fx[k] = approach(fx[k], k === 'churn' ? S.churn : S[k], k === 'lid' ? 12 : 4, dt);
    const churn = fx.churn * mf.churn;
    spin += dt * MOTION * (1 + (churn - 1) * .5); flick += dt * MOTION * churn;
    const flashing = time - flashAt < .9;
    const eyeTarget = hex(EYES[flashing ? 'acid' : S.eyes || eyeKey][theme]);
    for (let i = 0; i < 3; i++) eyeRGB[i] = approach(eyeRGB[i], eyeTarget[i], 14, dt);
    morph = approach(morph, shapeTarget, 3.2, dt);
    if (markKind === 'zzz' && R) { updateZzz(); gl.bindBuffer(gl.ARRAY_BUFFER, R.shapeBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, shapeData); }
    const showing = markActive ? 0 : morph;

    // Attention: an element we were asked to watch, or the pointer.
    let target = null, attending = false;
    const sr = stage.getBoundingClientRect();
    if (gazeEl && gazeEl.isConnected && sr.width && sr.height) {
      const r = sr, g = gazeEl.getBoundingClientRect();
      target = screenToWorld(((g.left + g.width / 2) - r.left) / r.width * 2 - 1, ((g.top + g.height / 2) - r.top) / r.height * 2 - 1);
      attending = true;
    } else {
      const interactive = mode === 'follow' || mode === 'attract' || mode === 'repel';
      attending = interactive && pointer.inside && !(pointer.down && pointer.dragged) && now - pointer.lastMove < 2500;
      if (attending) target = screenToWorld(pointer.nx, pointer.ny);
      // Curious when the pointer comes close; back to neutral when it leaves.
      if (o.autoMoods) {
        const near = attending && Math.hypot(target[0] - body.p[0], target[1] - body.p[1], target[2] - body.p[2]) < 1;
        if (near && mood === 'neutral' && state === 'idle') { applyMood('curious', 0); autoCurious = true; }
        else if (!near && mood === 'curious' && autoCurious) applyMood('neutral');
      }
    }

    // Body: frame-rate independent spring toward the target, or a lazy drift.
    let goal;
    if (attending) { goal = target.map(v => v * .5 * o.follow * (1 + mf.lean * .8)); const l = Math.hypot(...goal); if (l > .85) goal = goal.map(v => v * .85 / l); }
    else goal = [Math.sin(time * .5) * .18 * o.wander, Math.cos(time * .37) * .1 * o.wander, 0];
    goal[1] -= mf.sink;
    if (showing > .02) goal = goal.map(v => v * (1 - showing)); // hold still while showing a chart
    const k = attending ? 10 * response : 2.5, damp = Math.exp(-6 * dt);
    for (let i = 0; i < 3; i++) { body.v[i] = (body.v[i] + (goal[i] - body.p[i]) * k * dt) * damp; body.p[i] += body.v[i] * dt; }

    // Head: face the camera, turned toward what it is looking at; straight on while showing a chart.
    const toCam = norm([eye[0] - body.p[0], eye[1] - body.p[1], eye[2] - body.p[2]]);
    let lookOff = attending ? [0, 1, 2].map(i => target[i] - body.p[i])
      : [0, 1, 2].map(i => camRight[i] * Math.sin(time * .6) * .9 + camUp[i] * Math.sin(time * .43) * .4);
    if (state === 'thinking' && !gazeEl) lookOff = [0, 1, 2].map(i => -camRight[i] * .5 + camUp[i] * .7); // looks up and away
    const dart = Math.sign(Math.sin(time * 2.6)) * .9 * mf.dart;
    lookOff = lookOff.map((v, i) => (v + camRight[i] * dart - camUp[i] * mf.lookDown * .9) * (1 - showing));
    const look = norm([0, 1, 2].map(i => toCam[i] * 2.6 + lookOff[i] * .8));
    const turn = 1 - Math.exp(-(attending ? 7 : 2.5) * dt);
    body.yaw += wrapAngle(Math.atan2(look[0], look[2]) - body.yaw) * turn;
    body.pitch += (clamp(-Math.asin(clamp(look[1], -1, 1)), -.6, .6) - body.pitch) * turn;

    // Squash spring (kicked by pulses), breathing, and a small bounce while speaking.
    squashV += (-squash * 140 - squashV * 9) * dt; squash += squashV * dt;
    breathPhase += dt * MOTION * (1.7 + fx.gather * 1.5) / Math.sqrt(mf.breath);
    const breath = Math.sin(breathPhase) * .012 * mf.breath;
    const talk = fx.talk * Math.max(0, Math.sin(time * 10.5)) * Math.max(0, Math.sin(time * 2.3 + 1)) * .045;
    const shrink = (1 - fx.gather * .05) * (1 - Math.max(0, mf.sink) * .4);
    const sx = (1 - squash * .45 - breath * .5 - talk * .4) * shrink, sy = (1 + squash + breath + talk) * shrink;
    energy *= Math.exp(-2.5 * dt);
    wobble = (1 + energy * 1.8) * (reduceMotion ? .5 : 1);

    if (mode === 'dissolve') dissolve = Math.min(1, dissolve + dt * .55);
    else if (mode === 'reform') dissolve = Math.max(0, dissolve - dt * .7);
    else dissolve = Math.max(0, dissolve - dt * .4);

    rot = mul(rotYX(body.yaw, body.pitch), rotZ(mf.roll));
    model = mul(mul(translate(body.p[0], body.p[1], body.p[2]), rot), scale(sx, sy, sx));
    invScale = [1 / sx, 1 / sy, 1 / sx];

    // Eyes: sit on the surface, drift with the gaze, blink; held to a line while thinking.
    if (time >= blink.next) { blink.start = time; blink.double = Math.random() < .2; blink.next = time + rand(2.2, 5.5); }
    const lidCurve = s => (s > 0 && s < 1) ? Math.sin(s * Math.PI) : 0;
    const bt = (time - blink.start) / .15;
    const blinkLid = Math.max(lidCurve(bt), blink.double ? lidCurve(bt - 1.6) : 0) * (1 - mf.noBlink);
    const lid = Math.max(blinkLid, fx.lid, mf.lid) * (1 - mf.arc) * (1 - mf.noBlink); // a happy arc doesn't close; surprise opens them wide
    const gx = clamp(dot(lookOff, camRight) * .03, -.04, .04), gy = clamp(dot(lookOff, camUp) * .03, -.035, .035);
    const eyeFade = (1 - smooth(.2, .5, dissolve)) * (1 - smooth(.15, .55, showing));
    eyeModels = [];
    if (eyeFade > .01) [-1, 1].forEach(side => {
      const x = side * .26 + gx, y = .1 + gy;
      const z = BODY[2] * Math.sqrt(Math.max(0, 1 - x * x - (y / BODY[1]) ** 2));
      const n = norm([x, y / (BODY[1] * BODY[1]), z / (BODY[2] * BODY[2])]);
      const off = wave([x, y, z], time) * wobble + .004;
      eyeLocal[side < 0 ? 0 : 1] = [x, y, z];
      const base = mul(model, mul(translate(x + n[0] * off, y + n[1] * off, z + n[2] * off), rotYX(Math.atan2(n[0], n[2]), -Math.asin(clamp(n[1], -1, 1)))));
      const tilted = mul(base, rotZ(side < 0 ? mf.tilt : -mf.tilt)); // sorry: outer corners droop
      const sz = (side < 0 ? mf.sizeL : mf.sizeR) * fx.size * eyeFade * o.eyeScale, arc = mf.arc;
      const K = arc < .01 ? 1 : EYE_K, span = arc * 2.3, R0 = .09 * arc, mid = (1 + Math.cos(span / 2)) / 2;
      const r = (.078 + (.025 - .078) * arc) * sz, ry = r * Math.max(.14, 1 - lid);
      for (let k = 0; k < K; k++) {
        const t = K === 1 ? 0 : (k / (K - 1) - .5) * span;
        eyeModels.push(mul(tilted, mul(translate(Math.sin(t) * R0 * sz, (Math.cos(t) - mid) * R0 * sz, 0), scale(r, ry, .012))));
      }
    });

    if (particleCount) updateParticles(dt);
    if (form === 'bubble') updateInner();
  }
  function updateInner() {
    const P = pulses.length ? pulses[pulses.length - 1] : null, age = P ? time - P.t0 : 9;
    let peak = 0, peakY = -1;
    for (let i = 0; i < inner.length; i++) {
      const [x, z, fade] = inner[i], d = Math.hypot(x, z);
      let y = terrain(x, z, time);
      if (age < 1.2) y += Math.exp(-(((d - age * 1.2) / .1) ** 2)) * .1 * (1 - age / 1.2);
      const g = i * 5;
      gpuInner[g] = x; gpuInner[g + 1] = y * TILT_C - z * TILT_S - .16; gpuInner[g + 2] = y * TILT_S + z * TILT_C;
      gpuInner[g + 3] = fade * (.35 + (y + .13) * 2.6) * (1 - dissolve * .7);
      gpuInner[g + 4] = 0;
      if (y > peakY) { peakY = y; peak = i; }
    }
    gpuInner[peak * 5 + 4] = 2; gpuInner[peak * 5 + 3] = 1.2; // the one signal in the noise
  }
  function updateParticles(dt) {
    const damp = Math.exp(-2.2 * dt), spread = 1 + dissolve * .35;
    const shell = mode === 'reform' ? smooth(0, .6, dissolve) : 0;
    const attract = mode === 'attract' ? 1 : fx.gather;
    const [bx, by, bz] = body.p;
    for (let p = pulses.length - 1; p >= 0; p--) if (time - pulses[p].t0 > 1.6) pulses.splice(p, 1);
    for (let i = 0; i < particleCount; i++) {
      const h = i * 4, j = i * 3;
      const r = home[h], ang = home[h + 1] + time * home[h + 3] * (1 + attract * 2);
      let tx = bx * .35 + Math.cos(ang) * r * spread, ty = by * .35 + home[h + 2] * spread, tz = bz * .35 + Math.sin(ang) * r * spread;
      if (attract > .01) { const rr = 1.08 + (r - 1.3) * .22; tx += (bx + Math.cos(ang) * rr - tx) * attract; ty += (by + home[h + 2] * .45 - ty) * attract; tz += (bz + Math.sin(ang) * rr - tz) * attract; }
      if (shell > 0) { const d = norm([tx - bx, ty - by, tz - bz]); tx += (bx + d[0] * 1.02 - tx) * shell; ty += (by + d[1] * .86 - ty) * shell; tz += (bz + d[2] * .9 - tz) * shell; }
      const px = pos[j], py = pos[j + 1], pz = pos[j + 2];
      let ax = (tx - px) * 2, ay = (ty - py) * 2, az = (tz - pz) * 2;
      const dx = px - bx, dy = py - by, dz = pz - bz, dist = Math.hypot(dx, dy, dz) || 1;
      if (mode === 'repel' && dist < 2.4) { const f = (2.4 - dist) * 5 / dist; ax += dx * f; ay += dy * f; az += dz * f; }
      if (mode === 'dissolve') { ax += Math.sin(py * 2.1 + time * 1.3 + i) * dissolve; ay += Math.cos(pz * 1.7 + time * 1.1 + i * .7) * dissolve; az += Math.sin(px * 1.9 + time * .9) * dissolve; }
      for (let q = 0; q < pulses.length; q++) {
        const P = pulses[q], age = time - P.t0, ox = px - P.o[0], oy = py - P.o[1], oz = pz - P.o[2], d = Math.hypot(ox, oy, oz) || 1;
        const w = Math.exp(-(((d - age * 3.2) / .3) ** 2)) * (1 - age / 1.6);
        if (w > .01) { const f = w * 14 / d; ax += ox * f; ay += oy * f; az += oz * f; glow[i] = Math.max(glow[i], w); }
      }
      vel[j] = (vel[j] + ax * dt) * damp; vel[j + 1] = (vel[j + 1] + ay * dt) * damp; vel[j + 2] = (vel[j + 2] + az * dt) * damp;
      pos[j] = px + vel[j] * dt; pos[j + 1] = py + vel[j + 1] * dt; pos[j + 2] = pz + vel[j + 2] * dt;
      glow[i] *= Math.exp(-3 * dt);
      const g = i * 5;
      gpuParticles[g] = pos[j]; gpuParticles[g + 1] = pos[j + 1]; gpuParticles[g + 2] = pos[j + 2];
      gpuParticles[g + 3] = baseAlpha[i] * (1 + glow[i] * 2.5 + dissolve * .6);
    }
  }

  /* Rendering */
  function resize() {
    const r = stage.getBoundingClientRect(); W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round(W * DPR)), ch = Math.max(1, Math.round(H * DPR));
    if (previewOn) previewResize();
    if (cw === canvas.width && ch === canvas.height) return;
    canvas.width = cw; canvas.height = ch;
    // Resizing clears the canvas, and resize observers run after this frame's draw, so redraw now
    // (otherwise a stage that is animating its size shows blank frames).
    if (R && !contextLost) render();
  }
  function render() {
    if (!R || contextLost) return;
    if (!model) update(0, performance.now());
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);

    // 1. Eyes: opaque, write depth.
    gl.disable(gl.BLEND); gl.depthMask(true);
    if (eyeModels.length) {
      gl.useProgram(R.eye.p); attrib(0, R.eyePos, 3); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.eyeIdx);
      gl.uniformMatrix4fv(R.eye.u.u_viewProj, false, viewProj); gl.uniform3fv(R.eye.u.u_color, eyeRGB);
      for (const m of eyeModels) { gl.uniformMatrix4fv(R.eye.u.u_model, false, m); gl.drawElements(gl.TRIANGLES, eyeGeo.idx.length, gl.UNSIGNED_SHORT, 0); }
    }

    gl.enable(gl.BLEND); gl.depthMask(false);
    const T = THEMES[theme], pts = T.points.map(hex), Pt = R.point, pointBlend = T.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA;
    const pointUniforms = () => { gl.useProgram(Pt.p); gl.uniformMatrix4fv(Pt.u.u_viewProj, false, viewProj); pts.forEach((c, i) => gl.uniform3fv(Pt.u['u_c' + i], c)); gl.uniform1f(Pt.u.u_alphaMul, T.alphaMul); };
    if (form === 'cloud') {
      // 2. ASCII cloud: glyph sprites, no depth write, hidden behind the eyes.
      const C = R.cloud; gl.disable(gl.CULL_FACE); gl.blendFunc(gl.ONE, pointBlend); gl.useProgram(C.p);
      attrib(0, R.cloudBuf, 3, 16, 0); attrib(1, R.cloudBuf, 1, 16, 12); attrib(2, R.shapeBuf, 4);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.atlasTex); gl.uniform1i(C.u.u_atlas, 0);
      gl.uniformMatrix4fv(C.u.u_viewProj, false, viewProj); gl.uniformMatrix4fv(C.u.u_model, false, model);
      gl.uniform3fv(C.u.u_eyePos, eye); gl.uniform3fv(C.u.u_center, body.p); gl.uniform3fv(C.u.u_eyeL, eyeLocal[0]); gl.uniform3fv(C.u.u_eyeR, eyeLocal[1]); gl.uniform1f(C.u.u_eyeClear, o.eyeScale);
      gl.uniform1f(C.u.u_time, time); gl.uniform1f(C.u.u_spin, spin); gl.uniform1f(C.u.u_flick, flick + energy * 3); gl.uniform1f(C.u.u_dissolve, dissolve);
      gl.uniform1f(C.u.u_wobble, wobble); gl.uniform1f(C.u.u_morph, morph); gl.uniform1f(C.u.u_markScale, markActive ? .5 : 1); gl.uniform1f(C.u.u_markBoost, 1.03 / (.45 + opacity)); // marks as bright as at the default opacity
      gl.uniform1f(C.u.u_size, (o.glyphSize === 'auto' ? clamp(H / 40, 3.2, 14) : o.glyphSize) * DPR * (1 + morph * (shapeIsText ? -.45 : .15))); gl.uniform1f(C.u.u_glyphN, GLYPHS.length); gl.uniform1f(C.u.u_glyphCount, GLYPHS.length);
      gl.uniform1f(C.u.u_opacity, (.45 + opacity) * (1 - mf.dim)); gl.uniform1f(C.u.u_alphaMul, T.alphaMul); pts.forEach((c, i) => gl.uniform3fv(C.u['u_c' + i], c));
      gl.drawArrays(gl.POINTS, 0, CLOUD_N);
      gl.disableVertexAttribArray(2);
    } else {
      // 2. Bubble: translucent film, back faces, then the terrain inside, then front faces.
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const M = R.mesh; gl.useProgram(M.p);
      attrib(0, R.bodyPos, 3); attrib(1, R.bodyNorm, 3); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.bodyIdx);
      gl.uniformMatrix4fv(M.u.u_viewProj, false, viewProj); gl.uniformMatrix4fv(M.u.u_model, false, model); gl.uniformMatrix4fv(M.u.u_rot, false, rot);
      gl.uniform3fv(M.u.u_invScale, invScale); gl.uniform3fv(M.u.u_eye, eye); gl.uniform3fv(M.u.u_light, LIGHT);
      gl.uniform1f(M.u.u_time, time); gl.uniform1f(M.u.u_ftime, time); gl.uniform1f(M.u.u_wobble, wobble); gl.uniform1f(M.u.u_opacity, opacity * T.filmAlpha * (1 - mf.dim));
      gl.uniform1f(M.u.u_dissolve, dissolve); gl.uniform1f(M.u.u_glow, energy);
      gl.uniform3fv(M.u.u_film, hex(T.film)); gl.uniform3fv(M.u.u_tint, hex(T.tint)); gl.uniform1f(M.u.u_irid, T.irid);
      gl.cullFace(gl.FRONT); gl.uniform1f(M.u.u_backface, 1); gl.drawElements(gl.TRIANGLES, bodyGeo.idx.length, gl.UNSIGNED_SHORT, 0);

      gl.disable(gl.CULL_FACE); gl.blendFunc(gl.ONE, pointBlend); pointUniforms();
      gl.uniform1f(Pt.u.u_size, 2.6 * DPR); gl.uniformMatrix4fv(Pt.u.u_model, false, model);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.inner); gl.bufferSubData(gl.ARRAY_BUFFER, 0, gpuInner);
      attrib(0, R.inner, 4, 20, 0); attrib(1, R.inner, 1, 20, 16);
      gl.drawArrays(gl.POINTS, 0, inner.length);

      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(M.p);
      attrib(0, R.bodyPos, 3); attrib(1, R.bodyNorm, 3); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.bodyIdx);
      gl.uniform1f(M.u.u_backface, 0); gl.drawElements(gl.TRIANGLES, bodyGeo.idx.length, gl.UNSIGNED_SHORT, 0);
    }

    // 3. Outer field: hidden behind the eyes, visible through the film.
    if (particleCount) {
      gl.disable(gl.CULL_FACE); gl.blendFunc(gl.ONE, pointBlend); pointUniforms();
      gl.uniformMatrix4fv(Pt.u.u_model, false, IDENTITY); gl.uniform1f(Pt.u.u_size, 2.4 * DPR);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.particles); gl.bufferSubData(gl.ARRAY_BUFFER, 0, gpuParticles.subarray(0, particleCount * 5));
      attrib(0, R.particles, 4, 20, 0); attrib(1, R.particles, 1, 20, 16);
      gl.drawArrays(gl.POINTS, 0, particleCount);
    }
    gl.depthMask(true);

    if (firstFrame) { firstFrame = false; showPreview(false); status('WEBGL / 3D / ' + (form === 'cloud' ? CLOUD_N + ' GLYPHS · ' : '') + particleCount + ' PARTICLES'); }
  }

  /* Loop: only runs while visible, unpaused and with a live context */
  const shouldRun = () => !paused && onScreen && !document.hidden && !contextLost;
  function kick() { if (!raf && R && shouldRun()) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    if (!shouldRun()) return;
    const dt = clamp((now - last) / 1000, .001, .05); last = now;
    update(dt, now); render();
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', kick);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; kick(); }).observe(stage);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); contextLost = true; cancelAnimationFrame(raf); raf = 0;
    showPreview(true); status('WebGL context lost - showing compatibility preview');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try { initGL(); contextLost = false; firstFrame = true; resize(); kick(); }
    catch (e) { status('WebGL could not be restored - showing compatibility preview'); }
  });

  try { initGL(); }
  catch (e) { R = null; status('WebGL shader failed; showing preview. ' + e.message); return api; }

  /* Full API */
  Object.assign(api, {
    setMode(m) { mode = m; if (m === 'dissolve') dissolve = Math.min(dissolve, .02); if (m === 'reform') dissolve = Math.max(dissolve, 1); kick(); },
    setPaused(p) { paused = !!p; kick(); },
    set(name, value) {
      if (name === 'opacity') opacity = value;
      else if (name === 'response') response = value;
      else if (name === 'particles') particleCount = clamp(Math.round(value), 0, MAX_P);
      else if (name === 'autoMoods') { o.autoMoods = !!value; if (!value && autoCurious) applyMood('neutral'); }
      else if (name === 'sleepAfter') o.sleepAfter = value;
      redraw();
    },
    pulse(s) { touch(); pulse(s); },
    setState(s) { if (!STATES[s]) return; if (s !== 'idle') touch(); if (s === 'speaking' && state !== 'speaking') pulse(.35); state = s; kick(); },
    flash() { touch(); flashAt = time; blink.start = time; blink.double = false; pulse(.6); },
    shape(spec) {
      touch();
      if (!spec) { shapeTarget = 0; markActive = false; markKind = null; kick(); return; }
      markActive = false; markKind = null; shapeData = shapePositions(spec, CLOUD_N); shapeIsText = spec.text != null;
      gl.bindBuffer(gl.ARRAY_BUFFER, R.shapeBuf); gl.bufferData(gl.ARRAY_BUFFER, shapeData, gl.DYNAMIC_DRAW);
      shapeTarget = 1; energy = Math.max(energy, .5); kick();
    },
    lookAt(el) { gazeEl = el || null; kick(); },
    setMood(m, opts) { if (!MOODS[m]) return; lastActivity = performance.now(); applyMood(m, opts && opts.duration); }
  });
  resize();
  kick();
  stage.kohuSignal = api; // handy for debugging and for code that only has the element
  return api;
}

window.KohuSignal = { create, EYES, THEMES, STATES: Object.keys(STATES), MOODS: Object.keys(MOODS), GLYPHS };
})();
