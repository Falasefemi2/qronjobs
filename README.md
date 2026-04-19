# qronjobs

qronjobs is a reliable, distributed cron job scheduling system built with Bun, Postgres, and Redis (BullMQ). It provides a RESTful API to manage recurring jobs and a robust worker/poller architecture to ensure job execution and recovery.

## features

- **distributed scheduling**: uses postgres for job state and bullmq (redis) for distributed task processing
- **cron expressions**: support for standard cron patterns for flexible job scheduling
- **api driven**: full rest api for creating, listing, updating, and deleting jobs
- **robust recovery**: automatic detection and recovery of missed jobs based on configurable policies
- **built with effect**: leverages the effect library for type-safe, functional error handling and dependency injection
- **high performance**: built on bun for fast startup and execution

## tech stack

- **runtime**: [bun](https://bun.sh)
- **web framework**: [hono](https://hono.dev)
- **task queue**: [bullmq](https://bullmq.io)
- **database**: [postgres](https://www.postgresql.org/) (via postgres.js)
- **caching/queueing**: [redis](https://redis.io/) (via ioredis)
- **logic orchestration**: [effect](https://effect.website)

## project structure

- `src/api`: hono routes for job management
- `src/database`: schema definitions and connection management
- `src/jobs`: cron calculation logic
- `src/queue`: bullmq queue and worker implementation
- `src/scheduler`: poller for due jobs and recovery logic for missed jobs
- `src/libs`: shared types and error classes
- `server.ts`: application entry point

## database schema

the system uses three main tables:

1. **jobs**: stores job definitions, cron expressions, and the next scheduled run time
2. **runs**: tracks individual job executions and their outcomes
3. **schema_migrations**: manages database versioning

## getting started

### prerequisites

- bun installed
- postgres instance
- redis instance

### installation

1. clone the repository
2. install dependencies:
   ```bash
   bun install
   ```
3. configure environment variables in a `.env` file:
   ```env
   DATABASE_URL=postgres://user:password@localhost:5432/qronjobs
   REDIS_URL=redis://localhost:6379
   ```

### running the application

start the server, poller, and worker:
```bash
bun run server.ts
```

## api endpoints

### create a job
`POST /jobs`
```json
{
  "name": "data-backup",
  "cron_expression": "0 0 * * *",
  "payload": { "bucket": "backups" },
  "missed_job_policy": "run_immediately"
}
```

### list all jobs
`GET /jobs`

### get job by id
`GET /jobs/:id`

### update job status
`PATCH /jobs/:id`
```json
{
  "status": "paused"
}
```

### delete a job
`DELETE /jobs/:id`

## missed job policies

when the scheduler starts, it checks for jobs that should have run while it was offline:
- **skip**: do not run missed executions; just schedule the next one
- **run_immediately**: queue the missed job immediately and schedule the next one
