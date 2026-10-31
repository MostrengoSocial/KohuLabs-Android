-- Kō plans the day (the morning proposal), and a second Gmail for the import.
--
-- tasks.estimate: how many minutes of work a task needs ("add: proposal for Ana 2h by Friday" is 120). Kō plans
-- chunks for it until that much is done. Null: one chunk's worth.
ALTER TABLE tasks ADD COLUMN estimate INTEGER;

-- More Gmail accounts brought into the import, for the same person: their personal Gmail (api/google-import.js).
-- Server only, like google_accounts. email is the linked account; refresh_token is encrypted the same way.
CREATE TABLE google_links (
  user_id        TEXT    NOT NULL,
  email          TEXT    NOT NULL,
  refresh_token  TEXT    NOT NULL,
  scopes         TEXT    NOT NULL DEFAULT '',
  updated_at     INTEGER NOT NULL,
  last_import_at INTEGER,
  last_error     TEXT,
  PRIMARY KEY (user_id, email)
);
