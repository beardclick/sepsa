CREATE TABLE rounds (
 id TEXT PRIMARY KEY,
 payload TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE round_assignments (
 round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY (round_id,user_id)
);
CREATE INDEX round_assignee ON round_assignments(user_id);
UPDATE roles SET permissions=json_set(permissions,'$.rounds',json('["view","create","update","delete"]')) WHERE id='admin';
UPDATE roles SET permissions=json_set(permissions,'$.rounds',json('["view"]')) WHERE id IN ('chief','supervisor');
