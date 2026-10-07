CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,               -- ADMIN, PM01..PM03, DEV01..DEV06
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('ADMIN','MANAGER','AGENT')),
  specialization TEXT NOT NULL DEFAULT '',
  skills         TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,                  -- crypto.randomUUID()
  name        TEXT NOT NULL,
  client_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  manager_id  TEXT NOT NULL REFERENCES users(id),
  deadline    DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,              -- crypto.randomUUID()
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  assignee_id     TEXT NOT NULL REFERENCES users(id),
  deadline        DATE NOT NULL,
  estimated_hours NUMERIC(8,2) NOT NULL CHECK (estimated_hours > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee   ON tasks(assignee_id);
