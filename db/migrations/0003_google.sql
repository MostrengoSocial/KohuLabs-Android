-- Calendar and Gmail import (api/google-import.js). Server only: the phone never sees this table.
--
-- One row per person who signed in with Google and allowed offline access. refresh_token is encrypted (AES-GCM, key
-- derived from the Worker's SESSION_SECRET), so a copy of the database alone cannot read anyone's Google data. scopes
-- is what Google actually granted (people can untick Calendar or Gmail on the consent screen).
CREATE TABLE google_accounts (
  user_id          TEXT    PRIMARY KEY,
  refresh_token    TEXT    NOT NULL,
  scopes           TEXT    NOT NULL DEFAULT '',
  updated_at       INTEGER NOT NULL,
  last_import_at   INTEGER,
  last_import_date TEXT,
  last_error       TEXT
);
