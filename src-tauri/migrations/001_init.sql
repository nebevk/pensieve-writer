CREATE TABLE schema_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL
);

INSERT INTO schema_version (id, version) VALUES (1, 1);

CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_chapters_project_position ON chapters (project_id, position);

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX idx_snapshots_project_created ON snapshots (project_id, created_at);
