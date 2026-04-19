## Q1: What does the poller do every 30 seconds?

Every 30 seconds it opens a transaction, queries the database for jobs where status = 'active' AND next_run_at <= NOW() (meaning the scheduled time has passed), locks those rows with FOR UPDATE SKIP LOCKED, pushes each job to BullMQ, and updates last_run_at = NOW().

## Every 30 seconds it opens a transaction, queries the database for jobs where status = 'active' AND next_run_at <= NOW() (meaning the scheduled time has passed), locks those rows with FOR UPDATE SKIP LOCKED, pushes each job to BullMQ, and updates last_run_at = NOW().

FOR UPDATE places a lock on selected rows so no other process can touch them during the transaction. SKIP LOCKED tells other processes to skip already-locked rows instead of waiting. This prevents multiple scheduler instances from picking up the same job simultaneously.

## Q3: What happens when the server crashes and misses a scheduled job?

On startup runRecovery runs. It queries for jobs where next_run_at < NOW(). For each missed job it checks missed_job_policy — run_immediately pushes to BullMQ right away, skip just recalculates next_run_at to the next scheduled time. Either way next_run_at is updated.

## Q4: Why PostgreSQL and not just Redis?

Redis is in-memory first — data can be lost on crash. PostgreSQL is durable by default — every write is flushed to disk. PostgreSQL is also queryable with SQL which Redis is not. So Postgres is the source of truth and Redis is just the fast execution engine. If Redis dies, jobs are still safe in Postgres.

## Q5: What does calculateNextRunAt do and where is it used?

It takes a cron expression like 0 9 \* \* 1, uses cron-parser to calculate the next date that expression will fire, and returns it as a Date wrapped in an Effect. It's used in two places — when a job is first created to set the initial next_run_at, and after a job executes to reschedule it for the next run.

## Q6: What does the worker do when it receives a job?

It inserts a row into runs with status = 'running', executes the job (logs payload for now), updates the run to status = 'completed', calls calculateNextRunAt with the cron expression, and updates jobs.next_run_at so the poller knows when to fire it again.

## Q7: Why are there two tables — jobs and runs?

jobs stores the definition — what runs, when, how often. One row per scheduled job. runs stores execution history — one row every time a job fires. Separating them lets you query "show me all failed runs for job X in the last 7 days" without touching the job definition. Mixing them would make the jobs table grow unboundedly.
