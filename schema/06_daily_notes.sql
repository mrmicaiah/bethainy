CREATE TABLE daily_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  task TEXT NOT NULL,
  context TEXT,
  status TEXT DEFAULT 'open',
  added_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);