CREATE TABLE tracks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  behavior TEXT DEFAULT 'collaborative',
  status TEXT DEFAULT 'active',
  plan JSON,
  progress JSON,
  profile JSON,
  situation JSON,
  preferences JSON,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (mode_id) REFERENCES modes(id)
);