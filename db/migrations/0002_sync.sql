-- Syncing (step 2). Server-only additions; the phone has none of these.
--
-- seq orders every change the server accepts for a person: the phone asks for "everything after the last seq I saw",
-- which does not depend on the phone's clock. sync_counter holds each person's latest seq.

ALTER TABLE workspaces ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chunks ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE goals ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nudges ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE follow_ups ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alarms ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE day_reviews ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE meetings ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;

CREATE INDEX workspaces_by_seq ON workspaces (user_id, seq);
CREATE INDEX tasks_by_seq ON tasks (user_id, seq);
CREATE INDEX chunks_by_seq ON chunks (user_id, seq);
CREATE INDEX goals_by_seq ON goals (user_id, seq);
CREATE INDEX nudges_by_seq ON nudges (user_id, seq);
CREATE INDEX follow_ups_by_seq ON follow_ups (user_id, seq);
CREATE INDEX alarms_by_seq ON alarms (user_id, seq);
CREATE INDEX messages_by_seq ON messages (user_id, seq);
CREATE INDEX day_reviews_by_seq ON day_reviews (user_id, seq);
CREATE INDEX meetings_by_seq ON meetings (user_id, seq);
CREATE INDEX usage_by_seq ON usage (user_id, seq);
CREATE INDEX settings_by_seq ON settings (user_id, seq);

CREATE TABLE sync_counter (
  user_id TEXT    PRIMARY KEY,
  seq     INTEGER NOT NULL DEFAULT 0
);
