CREATE TABLE IF NOT EXISTS scores (
  submission_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  variant TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  score REAL NOT NULL,
  metadata TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_board ON scores (slug, variant, score, timestamp);
