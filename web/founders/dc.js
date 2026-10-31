/* A small renderer for the Claude Design template in index.html, so the app runs without React.
 *
 *   DC.mount(Component, props, rootElement, templateElement)
 *
 * The template is plain HTML with four additions:
 *   {{ path }}                    a value from the component's renderVals() (or a loop item), e.g. {{ t.cont }}, {{ 250 }}
 *   <sc-if value="{{ x }}">       renders its children when x is truthy
 *   <sc-for list="{{ xs }}" as="x">  renders its children once per item, with the item as x
 *   <x-import component-from-global-scope="KohuUI.Signal" ...>  a component from DC.components
 * onClick / onChange (fired on every keystroke, like React) / onKeyDown take functions, ref takes { current }.
 *
 * Components extend DCLogic: a state object, setState(partial | fn), renderVals(), and the React-style
 * componentDidMount / componentDidUpdate / componentWillUnmount hooks. Each setState re-renders on the next
 * microtask; the DOM is patched in place (keyed by template position), so inputs keep focus and refs stay put.
 */
(function () {
'use strict';

const EXPR = /\{\{\s*([^}]+?)\s*\}\}/g;
const EVENTS = { onclick: 'click', onchange: 'input', onkeydown: 'keydown' };

class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(update) {
    const part = typeof update === 'function' ? update(this.state, this.props) : update;
    if (part == null) return;
    this.state = Object.assign({}, this.state, part);
    if (this._schedule) this._schedule();
  }
}

// ---- compile: the template DOM to a small tree, with each {{ }} split out once ----
function parts(str) {
  const out = []; let last = 0, m;
  EXPR.lastIndex = 0;
  while ((m = EXPR.exec(str))) { if (m.index > last) out.push(str.slice(last, m.index)); out.push({ expr: m[1] }); last = EXPR.lastIndex; }
  if (last < str.length) out.push(str.slice(last));
  return out;
}
let ids = 0;
function compile(node) {
  const id = 'n' + (ids++);
  if (node.nodeType === 3) return { kind: 'text', id, parts: parts(node.data) };
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  const attr = n => parts(node.getAttribute(n) || '');
  const kids = () => Array.from(node.childNodes).map(compile).filter(Boolean);
  if (tag === 'sc-if') return { kind: 'if', id, value: attr('value'), kids: kids() };
  if (tag === 'sc-for') return { kind: 'for', id, list: attr('list'), as: node.getAttribute('as'), kids: kids() };
  if (tag === 'x-import') {
    const props = [];
    for (const a of node.attributes) if (a.name !== 'component-from-global-scope') props.push([a.name, parts(a.value)]);
    return { kind: 'comp', id, name: node.getAttribute('component-from-global-scope').replace(/^KohuUI\./, ''), props };
  }
  const attrs = [];
  for (const a of node.attributes) attrs.push([a.name, parts(a.value)]);
  return { kind: 'el', id, tag, ns: node.namespaceURI, attrs, kids: kids() };
}

// ---- evaluate: paths and literals only ----
function lookup(scope, expr) {
  if (/^-?\d/.test(expr)) return Number(expr);
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (expr === 'null') return null;
  const keys = expr.split('.');
  let v = scope[keys[0]];
  for (let i = 1; i < keys.length && v != null; i++) v = v[keys[i]];
  return v;
}
function value(p, scope) {
  if (p.length === 1 && typeof p[0] === 'object') return lookup(scope, p[0].expr);
  return p.map(x => typeof x === 'string' ? x : (v => v == null || v === false ? '' : String(v))(lookup(scope, x.expr))).join('');
}
function text(p, scope) { const v = value(p, scope); return v == null || v === false ? '' : String(v); }

// ---- render: the compiled tree plus values to virtual nodes ----
function render(nodes, scope, key, out) {
  for (const n of nodes) {
    const k = key + n.id;
    if (n.kind === 'text') out.push({ k, text: text(n.parts, scope) });
    else if (n.kind === 'if') { if (value(n.value, scope)) render(n.kids, scope, k + '/', out); }
    else if (n.kind === 'for') {
      const list = value(n.list, scope) || [];
      list.forEach((item, i) => { const s = Object.create(scope); s[n.as] = item; render(n.kids, s, k + '.' + i + '/', out); });
    } else if (n.kind === 'comp') {
      const props = {};
      for (const [name, p] of n.props) if (!name.startsWith('hint-')) props[name] = value(p, scope);
      out.push({ k, comp: n.name, props });
    } else {
      const v = { k, tag: n.tag, ns: n.ns, attrs: {}, on: {}, ref: null, kids: [] };
      for (const [name, p] of n.attrs) {
        if (name.startsWith('hint-')) continue;
        if (EVENTS[name]) v.on[EVENTS[name]] = value(p, scope);
        else if (name === 'ref') v.ref = value(p, scope);
        else v.attrs[name] = text(p, scope);
      }
      render(n.kids, scope, '', v.kids);
      out.push(v);
    }
  }
  return out;
}

// ---- patch: virtual nodes onto the DOM ----
function same(a, b) { return a.text !== undefined ? b.text !== undefined : a.comp ? a.comp === b.comp : a.tag === b.tag; }
function create(v) {
  if (v.text !== undefined) { v.el = document.createTextNode(v.text); return; }
  if (v.comp) {
    const def = DC.components[v.comp];
    v.inst = def ? def(v.props) : { el: document.createComment(v.comp), update() {}, destroy() {} };
    v.el = v.inst.el; return;
  }
  v.el = v.ns && v.ns !== 'http://www.w3.org/1999/xhtml' ? document.createElementNS(v.ns, v.tag) : document.createElement(v.tag);
  v.el.__on = {};
  update({ attrs: {}, on: {}, kids: [] }, v);
}
function update(o, v) {
  const el = v.el = o.el || v.el;
  if (v.text !== undefined) { if (o.text !== v.text) el.data = v.text; return; }
  if (v.comp) { v.inst = o.inst; if (o.props !== undefined) v.inst.update(v.props); return; }
  for (const name in v.attrs) {
    const val = v.attrs[name];
    if (name === 'value') { if (el.value !== val) el.value = val; continue; }
    if (o.attrs[name] !== val) el.setAttribute(name, val);
  }
  for (const name in o.attrs) if (!(name in v.attrs)) el.removeAttribute(name);
  for (const type in v.on) if (!(type in el.__on)) el.addEventListener(type, e => { const f = el.__on[type]; if (typeof f === 'function') f(e); });
  el.__on = Object.assign(el.__on, v.on);
  for (const type in el.__on) if (!(type in v.on)) el.__on[type] = null;
  if (v.ref && typeof v.ref === 'object') v.ref.current = el;
  patch(el, o.kids, v.kids);
}
function destroy(v) {
  if (v.inst) v.inst.destroy();
  if (v.ref && v.ref.current === v.el) v.ref.current = null;
  if (v.kids) v.kids.forEach(destroy);
}
function patch(parent, old, kids) {
  const byKey = new Map();
  for (const o of old) byKey.set(o.k, o);
  for (const v of kids) {
    const o = byKey.get(v.k);
    if (o && same(o, v)) { byKey.delete(v.k); update(o, v); } else create(v);
  }
  for (const o of byKey.values()) { destroy(o); if (o.el.parentNode === parent) parent.removeChild(o.el); }
  let at = parent.firstChild;
  for (const v of kids) { if (v.el !== at) parent.insertBefore(v.el, at); else at = at.nextSibling; }
}

function mount(Component, props, root, template) {
  const tree = Array.from(template.content.childNodes).map(compile).filter(Boolean);
  const inst = new Component(props);
  let vkids = [], queued = false, mounted = false;
  const draw = () => {
    queued = false;
    const kids = render(tree, inst.renderVals(), '', []);
    patch(root, vkids, kids); vkids = kids;
    if (mounted && inst.componentDidUpdate) inst.componentDidUpdate();
  };
  inst._schedule = () => { if (!queued) { queued = true; queueMicrotask(draw); } };
  draw();
  mounted = true;
  if (inst.componentDidMount) inst.componentDidMount();
  return inst;
}

// ---- Kohu UI components (the design system's React components, in plain DOM) ----
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function Signal(props) {
  const el = document.createElement('div');
  el.className = 'k-signal-stage'; el.setAttribute('aria-hidden', 'true');
  let api = null, gone = false, cur = {};
  const size = s => { el.style.width = el.style.height = (s || 240) + 'px'; };
  const apply = p => {
    if (!api) return;
    if (p.theme && p.theme !== cur.theme) api.setTheme(p.theme);
    if (p.mood && p.mood !== cur.mood) api.setMood(p.mood);
    if (p.state && p.state !== cur.state) api.setState(p.state);
    cur = Object.assign({}, p);
  };
  size(props.size);
  // Created once the stage is in the page, so it can measure itself.
  requestAnimationFrame(() => {
    if (gone || !window.KohuSignal) return;
    api = window.KohuSignal.create(el, { theme: props.theme || 'dark', particles: 0, glyphs: 1100, glyphSize: 'auto', camDist: 3.7, orbit: false, follow: 0.35, trackDocument: true, autoMoods: true, fontUrl: DC.fontUrl });
    apply(props);
  });
  return {
    el,
    update(p) { if (p.size !== props.size) size(p.size); props = p; apply(p); },
    destroy() {
      gone = true;
      if (api) api.setPaused(true);
      // Free the WebGL context: a stage per screen would otherwise pile them up.
      el.querySelectorAll('canvas').forEach(c => { const gl = c.getContext('webgl') || c.getContext('experimental-webgl'); const x = gl && gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); });
    }
  };
}

function StageBar(props) {
  const el = document.createElement('ol');
  el.className = 'k-stages';
  const draw = p => {
    const stages = p.stages || [], cur = p.current || 0;
    el.setAttribute('aria-label', `Stage ${cur + 1} of ${stages.length}: ${stages[cur] || ''}`);
    el.innerHTML = stages.map((s, i) => `<li${i < cur ? ' class="k-done"' : i === cur ? ' class="k-now"' : ''}><span>${esc(s)}</span></li>`).join('');
  };
  draw(props);
  return { el, update: draw, destroy() {} };
}

function KpiTile(props) {
  const el = document.createElement('div');
  el.className = 'k-kpi';
  const draw = p => {
    el.innerHTML = `<p class="k-kpi-label k-mono">${esc(p.label)}</p><p class="k-kpi-value">${esc(p.value)}</p>` +
      `<p class="k-kpi-meta k-mono">${p.delta ? `<b>${esc(p.delta)}</b>` : ''}${p.delta && p.note ? ' ' : ''}${esc(p.note)}</p>`;
  };
  draw(props);
  return { el, update: draw, destroy() {} };
}

const DC = window.DC = { DCLogic, mount, components: { Signal, StageBar, KpiTile }, fontUrl: null, createRef: () => ({ current: null }) };
})();
