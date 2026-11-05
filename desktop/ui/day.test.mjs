import test from 'node:test';
import assert from 'node:assert/strict';
import { attention, dateKey, dayView, langOf } from './day.js';

const now = new Date(2026, 10, 5, 10, 0);
const date = dateKey(now);
const c = (id, start, status = 'planned', extra = {}) => ({ id, date, start, minutes: 25, title: id, category: 'ops', status, workspace_id: 'k', ...extra });
const tables = (...rows) => ({ chunks: Object.fromEntries(rows.map((r) => [r.id, r])), workspaces: { k: { id: 'k', name: 'Kohu' } } });

test('today: only today, in order, without replaced or deleted chunks', () => {
  const v = dayView(tables(c('b', '11:00'), c('a', '09:00', 'done'), c('split', '09:30', 'split'), c('gone', '09:40', 'planned', { deleted: 1 }), c('old', '09:00', 'planned', { date: '2026-11-04' })), now);
  assert.deepEqual(v.items.map((i) => i.id), ['a', 'b']);
  assert.equal(v.left, 1); assert.equal(v.next.id, 'b'); assert.equal(v.current, null);
  assert.equal(v.items[1].workspace, 'Kohu');
});

test('the current chunk is the one the clock is inside', () => {
  const v = dayView(tables(c('a', '09:50'), c('b', '10:30')), now);
  assert.equal(v.current.id, 'a'); assert.equal(v.next.id, 'b');
  assert.equal(dayView(tables(c('a', '09:35')), now).current, null); // ended at exactly 10:00
});

test('waiting on you: open ones that wait on you, newest first', () => {
  const t = { follow_ups: {
    a: { id: 'a', person: 'A', what: 'x', direction: 'you', status: 'open', since: '2026-11-01' }, b: { id: 'b', person: 'B', what: 'y', direction: 'you', status: 'open', since: '2026-11-04' },
    c: { id: 'c', person: 'C', what: 'z', direction: 'them', status: 'open', since: '2026-11-04' }, d: { id: 'd', person: 'D', what: 'w', direction: 'you', status: 'done', since: '2026-11-04' } } };
  assert.deepEqual(dayView(t, now).waiting.map((f) => f.id), ['b', 'a']);
});

test('he comes 10 minutes before a meeting, and when a chunk starts; a dismissed reminder stays dismissed', () => {
  const meet = { category: 'meet', title: 'Client' };
  const view = (r) => dayView(tables(r), now);
  assert.match(attention(view(c('m', '10:08', 'planned', meet)), now).text, /In 8 min: Client/);
  assert.equal(attention(view(c('m', '10:11', 'planned', meet)), now), null);
  assert.match(attention(view(c('m', '09:59', 'planned', meet)), now, new Set(), 'pt').text, /Agora: Client/);
  assert.equal(attention(view(c('m', '09:57', 'planned', meet)), now), null);
  assert.match(attention(view(c('t', '10:00', 'planned', { title: 'Write' })), now).text, /Time for: Write/);
  assert.equal(attention(view(c('t', '10:05')), now), null);
  assert.equal(attention(view(c('t', '10:00', 'done')), now), null);
  const a = attention(view(c('t', '10:00')), now);
  assert.equal(attention(view(c('t', '10:00')), now, new Set([a.key])), null);
  // a moved meeting is a new reminder
  assert.notEqual(attention(view(c('m', '10:05', 'planned', meet)), now).key, attention(view(c('m', '10:06', 'planned', meet)), now).key);
});

test('language comes from the synced setting, and bad data falls back to English', () => {
  assert.equal(langOf({ settings: { lang: { value: '"pt"' } } }), 'pt');
  assert.equal(langOf({ settings: { lang: { value: 'pt' } } }), 'pt');
  assert.equal(langOf({ settings: { lang: { value: '"pt"', deleted: 1 } } }), 'en');
  assert.equal(langOf(null), 'en');
});

test('no data yet is an empty day, not an error', () => {
  const v = dayView(null, now);
  assert.deepEqual([v.items, v.waiting, v.current, v.next, v.left], [[], [], null, null, 0]);
});
