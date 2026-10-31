// A stand-in for Cloudflare D1 in tests: the same prepare/bind/all/run/batch calls, on real SQLite (node:sqlite).
import { DatabaseSync } from 'node:sqlite';

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args), success: true }; }
  async run() { this.db.prepare(this.sql).run(...this.args); return { success: true }; }
}

export class FakeD1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db, sql); }
  // Like D1: one batch is one transaction.
  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const out = [];
      for (const s of statements) out.push(/^\s*(select|insert.*returning)/i.test(s.sql) ? await s.all() : await s.run());
      this.db.exec('COMMIT');
      return out;
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}
