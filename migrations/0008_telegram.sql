CREATE TABLE telegram_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  chat_id TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  notify_incidents INTEGER NOT NULL DEFAULT 1 CHECK(notify_incidents IN (0,1)),
  notify_shifts INTEGER NOT NULL DEFAULT 1 CHECK(notify_shifts IN (0,1)),
  notify_reports INTEGER NOT NULL DEFAULT 1 CHECK(notify_reports IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO telegram_settings (id) VALUES (1);
