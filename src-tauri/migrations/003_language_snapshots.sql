ALTER TABLE projects ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE chapters ADD COLUMN language TEXT NOT NULL DEFAULT '';
ALTER TABLE snapshots ADD COLUMN kind TEXT NOT NULL DEFAULT 'hourly';

CREATE TABLE personal_words (
  language TEXT NOT NULL,
  word TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (language, word)
);

UPDATE schema_version SET version = 3 WHERE id = 1;
