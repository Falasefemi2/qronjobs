export const createSchemaMigrationsTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    executed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createJobTable = `
CREATE TABLE IF NOT EXISTS jobs (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name              TEXT NOT NULL,
    cron_expression   TEXT NOT NULL,
    payload           JSONB NOT NULL DEFAULT '{}',
    status            TEXT NOT NULL DEFAULT 'active',
    missed_job_policy TEXT NOT NULL DEFAULT 'skip',
    next_run_at       TIMESTAMPTZ NOT NULL,
    last_run_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`;

export const createRunTable = `
CREATE TABLE IF NOT EXISTS runs (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'running',
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error       TEXT,
    payload     JSONB NOT NULL DEFAULT '{}'
)
`;

export const createJobIndexes = `
CREATE INDEX IF NOT EXISTS idx_jobs_status_next_run_at
ON jobs(status, next_run_at);
`;

export const createRunIndexes = `
CREATE INDEX IF NOT EXISTS idx_runs_job_id
ON runs(job_id);
`;
