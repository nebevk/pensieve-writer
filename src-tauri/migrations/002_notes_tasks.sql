ALTER TABLE chapters ADD COLUMN synopsis TEXT NOT NULL DEFAULT '';
ALTER TABLE chapters ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';

CREATE TABLE notes (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ideas',
  tags TEXT NOT NULL DEFAULT '',
  todo_state TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE note_chapters (
  note_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  PRIMARY KEY (note_id, chapter_id)
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  todo_state TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

UPDATE schema_version SET version = 2 WHERE id = 1;
