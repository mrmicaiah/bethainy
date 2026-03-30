CREATE TABLE daily_plans (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  items JSON,
  completed JSON,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);