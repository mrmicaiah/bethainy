CREATE TABLE system_docs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  content TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);