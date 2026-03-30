-- bethainy D1 Schema
-- Migration 002: Mode system (mirrors my-life repo structure)

-- Tracks (the core unit - people, projects, stores, courses, assets, etc.)
-- This is the equivalent of files in my-life/*/tracks/*.json
CREATE TABLE tracks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL,           -- 'fitness', 'people', 'projects', 'shopping', etc.
  name TEXT NOT NULL,           -- 'Sarah', 'Raimpage', 'Lowe\'s', 'Python Course'
  type TEXT,                    -- 'person', 'project', 'store', 'course', 'exploration', 'asset'
  behavior TEXT DEFAULT 'collaborative',  -- 'circuit' or 'collaborative'
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed'
  
  -- The flexible JSON fields (mirrors track file structure)
  plan JSON,                    -- The plan/goal/structure
  progress JSON,                -- Current progress
  profile JSON,                 -- Static facts (people, assets, projects)
  situation JSON,               -- Current state (people)
  preferences JSON,             -- User preferences for this track
  current_list JSON,            -- Revolving checklist (shopping)
  tasks JSON,                   -- Things to do (projects, daily)
  schedule JSON,                -- Recurring items (maintenance)
  insights JSON,                -- Captured learnings (collaborative)
  resources JSON,               -- External links (learning)
  timeline JSON,                -- Events over time
  notes JSON,                   -- Observations
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Entries (dated logs - workouts, meals, journal entries, expenses, sessions)
-- This is the equivalent of files in my-life/*/YYYY-MM-DD.json or entries/YYYY-MM-DD.md
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL,           -- 'fitness', 'journal', 'money', 'faith', 'shopping'
  type TEXT NOT NULL,           -- 'workout', 'meal', 'journal', 'expense', 'session', 'trip'
  track_id TEXT,                -- Optional link to a track
  date TEXT NOT NULL,           -- YYYY-MM-DD
  data JSON NOT NULL,           -- The entry data (flexible per type)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (track_id) REFERENCES tracks(id)
);

-- Daily notes (persistent task bucket - mirrors daily/notes.json)
CREATE TABLE daily_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT DEFAULT 'task',     -- 'task' or 'note'
  content TEXT NOT NULL,
  context TEXT,
  status TEXT DEFAULT 'open',   -- 'open', 'done', 'moved'
  moved_to TEXT,                -- track_id if moved to a track
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Daily plans (the day's plan - mirrors daily/plans/YYYY-MM-DD.json)
CREATE TABLE daily_plans (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  items JSON,                   -- The plan items
  completed JSON,               -- What got done
  reflection TEXT,              -- End of day notes
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User settings (mode preferences, plans like diet-plan.md, workout-plan.md)
CREATE TABLE user_settings (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,            -- 'fitness.diet_plan', 'fitness.workout_plan', 'journal.purpose'
  value JSON NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_tracks_user_mode ON tracks(user_id, mode);
CREATE INDEX idx_tracks_status ON tracks(status);
CREATE INDEX idx_entries_user_date ON entries(user_id, date);
CREATE INDEX idx_entries_mode_type ON entries(mode, type);
CREATE INDEX idx_entries_track ON entries(track_id);
CREATE INDEX idx_daily_notes_user_status ON daily_notes(user_id, status);
