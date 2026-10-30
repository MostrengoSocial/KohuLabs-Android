// Kohu Founders sync: the phone's database ↔ the cloud copy in D1 (binding DB), for index.js.
//
//   POST /api/sync   Authorization: Bearer <app token>
//   body  { cursor: <last seq seen, 0 at first>, changes: { <table>: [ <row>, ... ], ... } }
//   reply { cursor: <new seq>, more: <true if there is more to pull>, changes: { <table>: [ <row>, ... ] } }
//
// Push: each row is saved under the signed-in person (user_id), unless the cloud already has a newer one (the
// newest updated_at wins, so a slow phone never overwrites newer work). Every accepted row gets the next seq.
// Pull: rows with a seq after the phone's cursor, at most PAGE per table; the phone asks again while more is true.
// Rows come back as plain objects with the table's columns (no user_id or seq).
import { MIGRATIONS, TABLES } from './migrations.js';

export const PAGE = 500;            // rows per table per reply
export const MAX_PUSH = 1000;       // rows per request
const BATCH = 50;                   // statements per D1 batch

// ---- schema: applies db/migrations/ to D1 once, in order ---------------------------------------------------------
let migrated = null;                // per Worker isolate
export async function migrate(db) {
  if (migrated === db) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)').run();
  const done = new Set((await db.prepare('SELECT name FROM schema_migrations').all()).results.map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    // One batch is one transaction: a migration is applied whole or not at all. If two requests race, the loser's
    // batch fails on the schema_migrations insert (or an existing table) and changes nothing.
    try {
      await db.batch([...m.statements.map((s) => db.prepare(s)), db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').bind(m.name, Date.now())]);
    } catch (err) {
      const again = (await db.prepare('SELECT name FROM schema_migrations WHERE name = ?').bind(m.name).all()).results;
      if (!again.length) throw err;
    }
  }
  migrated = db;
}

// ---- checks --------------------------------------------------------------------------------------------------------
const okValue = (v) => v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean';
function cleanRow(table, row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  if (typeof row.id !== 'string' || !row.id || row.id.length > 100) return null;
  if (!Number.isInteger(row.updated_at) || row.updated_at < 0) return null;
  const out = {};
  for (const col of TABLES[table]) {
    const v = row[col] === undefined ? null : row[col];
    if (!okValue(v) || (typeof v === 'string' && v.length > 20_000)) return null;
    out[col] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
  }
  return out;
}

// ---- sync ----------------------------------------------------------------------------------------------------------
export async function sync(db, userId, body) {
  if (!body || typeof body !== 'object') return { status: 400, error: 'bad_request' };
  const cursor = Number.isInteger(body.cursor) && body.cursor >= 0 ? body.cursor : 0;
  const changes = body.changes && typeof body.changes === 'object' ? body.changes : {};

  const rows = [];
  for (const [table, list] of Object.entries(changes)) {
    if (!TABLES[table] || !Array.isArray(list)) return { status: 400, error: `unknown_table:${table}` };
    for (const r of list) {
      const clean = cleanRow(table, r);
      if (!clean) return { status: 400, error: `bad_row:${table}` };
      rows.push([table, clean]);
    }
  }
  if (rows.length > MAX_PUSH) return { status: 413, error: 'too_many_rows' };

  await migrate(db);

  // Push: reserve seqs for these rows, then upsert them (newest updated_at wins).
  if (rows.length) {
    const top = (await db.prepare('INSERT INTO sync_counter (user_id, seq) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET seq = seq + excluded.seq RETURNING seq')
      .bind(userId, rows.length).all()).results[0].seq;
    let seq = top - rows.length;
    const statements = rows.map(([table, row]) => {
      const cols = TABLES[table];
      const sql = `INSERT INTO ${table} (user_id, seq, ${cols.join(', ')}) VALUES (?, ?, ${cols.map(() => '?').join(', ')}) ` +
        `ON CONFLICT (user_id, id) DO UPDATE SET seq = excluded.seq, ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')} ` +
        `WHERE excluded.updated_at > ${table}.updated_at`;
      return db.prepare(sql).bind(userId, ++seq, ...cols.map((c) => row[c]));
    });
    for (let i = 0; i < statements.length; i += BATCH) await db.batch(statements.slice(i, i + BATCH));
  }

  // Pull: what changed after the phone's cursor. If a table fills a page, the new cursor stops at the last row of the
  // fullest page, so nothing is skipped (rows after it in other tables simply come again next time).
  const out = {};
  let next = cursor, truncated = Infinity;
  for (const [table, cols] of Object.entries(TABLES)) {
    const res = (await db.prepare(`SELECT seq, ${cols.join(', ')} FROM ${table} WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?`).bind(userId, cursor, PAGE).all()).results;
    if (!res.length) continue;
    const last = res[res.length - 1].seq;
    next = Math.max(next, last);
    if (res.length === PAGE) truncated = Math.min(truncated, last);
    out[table] = res.map(({ seq, ...row }) => row);
  }
  const more = truncated !== Infinity;
  return { status: 200, cursor: more ? truncated : next, more, changes: out };
}
