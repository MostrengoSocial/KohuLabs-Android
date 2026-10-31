-- Kohu Founders: the data model, as the cloud database (Cloudflare D1) will hold it.
--
-- The phone keeps the same tables in its own database (android/app/src/main/java/com/kohulabs/android/data/,
-- Room), without user_id: there is only ever one person on a phone. db/check-schema.mjs checks that the two match.
--
-- Every table has the same bookkeeping columns, for syncing (step 2):
--   id          made on the phone (a UUID, or a fixed name for settings, workspaces and day reviews)
--   updated_at  when the row last changed, in milliseconds since 1970 (newest wins when syncing)
--   deleted     1 instead of a real delete, so deletions sync too
-- Dates are 'YYYY-MM-DD' and times 'HH:MM', in the phone's time zone.

-- Kohu, Personal, Revolut. Only workspaces with tools_allowed = 1 can use MCP tools.
CREATE TABLE workspaces (
  user_id       TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  tools_allowed INTEGER NOT NULL DEFAULT 0,
  sort          INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  deleted       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- A piece of work ("Investor update"), split into chunks. category groups it (ops, fin, inv, hire, ...);
-- source is where it came from (gmail, notion, calendar, linear, you, ko).
CREATE TABLE tasks (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  workspace_id TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  category     TEXT    NOT NULL,
  source       TEXT,
  due_date     TEXT,
  status       TEXT    NOT NULL DEFAULT 'open',   -- open | done | dropped
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- A 15, 25 or 45 minute slot of a task on one day. started_at is when it became the current chunk (the timer);
-- carried_from is the chunk it continues when the day rolled over.
CREATE TABLE chunks (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  task_id      TEXT,
  workspace_id TEXT    NOT NULL,
  date         TEXT    NOT NULL,
  start        TEXT    NOT NULL,
  minutes      INTEGER NOT NULL,
  title        TEXT    NOT NULL,
  category     TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'planned', -- planned | done | skipped | split | moved | dropped
  started_at   INTEGER,
  carried_from TEXT,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX chunks_by_date ON chunks (user_id, date);

-- Daily goals. Unfinished ones carry over to the next day.
CREATE TABLE goals (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  workspace_id TEXT    NOT NULL,
  date         TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  done         INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- Something Kō flags: a decision, a risk, a break, a reminder. actions is a JSON list of button labels;
-- answer is the one you picked. go names a screen to open with the first action (e.g. review).
CREATE TABLE nudges (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  workspace_id TEXT,
  kind         TEXT    NOT NULL,
  tone         TEXT    NOT NULL DEFAULT 'info',   -- info | decision | risk
  time_label   TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  actions      TEXT    NOT NULL DEFAULT '[]',
  go           TEXT,
  created_at   INTEGER NOT NULL,
  answer       TEXT,
  answered_at  INTEGER,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- Who is waiting on whom. direction: you (they wait on you) | them (you wait on them). since is a date.
CREATE TABLE follow_ups (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  workspace_id TEXT    NOT NULL,
  person       TEXT    NOT NULL,
  what         TEXT    NOT NULL,
  direction    TEXT    NOT NULL,
  since        TEXT    NOT NULL,
  source       TEXT,
  status       TEXT    NOT NULL DEFAULT 'open',   -- open | done
  nudged_at    INTEGER,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- Alarms Kō keeps (and sets in the phone's clock app). brief = read the morning brief when it is stopped.
CREATE TABLE alarms (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  time         TEXT    NOT NULL,
  label        TEXT    NOT NULL,
  days         TEXT    NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  by_ko        INTEGER NOT NULL DEFAULT 0,
  brief        INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- The chat with Kō, per day. who: user | ko. A scripted reply is stored by reply_key, so it shows in the
-- current language; anything else as text.
CREATE TABLE messages (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  date         TEXT    NOT NULL,
  workspace_id TEXT,
  who          TEXT    NOT NULL,
  text         TEXT,
  reply_key    TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX messages_by_date ON messages (user_id, date);

-- The end-of-day review (id = the date). slips is JSON {chunk id: 0 tomorrow | 1 split | 2 drop}, used when
-- the day rolls over. feel: 0 drained | 1 ok | 2 good.
CREATE TABLE day_reviews (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  date         TEXT    NOT NULL,
  feel         INTEGER,
  slips        TEXT    NOT NULL DEFAULT '{}',
  closed_at    INTEGER,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- Calls with their prep and recap (JSON), filled from Calendar and the Meet transcript later.
CREATE TABLE meetings (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  workspace_id TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  date         TEXT    NOT NULL,
  start        TEXT    NOT NULL,
  minutes      INTEGER NOT NULL,
  prep         TEXT    NOT NULL DEFAULT '{}',
  recap        TEXT    NOT NULL DEFAULT '{}',
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- One row per AI request, for Stats › Spend. purpose: chat | split | nudge. cost in US dollars.
CREATE TABLE usage (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  at           INTEGER NOT NULL,
  model        TEXT    NOT NULL,
  provider     TEXT    NOT NULL,
  purpose      TEXT    NOT NULL,
  tokens_in    INTEGER NOT NULL DEFAULT 0,
  tokens_out   INTEGER NOT NULL DEFAULT 0,
  cache_read   INTEGER NOT NULL DEFAULT 0,
  cache_write  INTEGER NOT NULL DEFAULT 0,
  cost         REAL    NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- Preferences (id = the setting's name, value = JSON): lang, mode, chunk, cap, model, nudgesOn, ...
CREATE TABLE settings (
  user_id      TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  value        TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);
