CREATE TABLE incidents (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  created_by TEXT NOT NULL,
  agent_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX incidents_agent ON incidents(agent_id);
CREATE TABLE incident_directory (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
