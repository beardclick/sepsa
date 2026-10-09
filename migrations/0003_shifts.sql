CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX shifts_agent ON shifts(agent_id);
