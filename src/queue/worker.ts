import { Worker } from "bullmq";
import { Effect } from "effect";
import { connection } from "./redis";
import { DatabaseClient, DatabaseLive } from "../database/connection";
import { DatabaseError } from "../libs/errors";
import { calculateNextRunAt } from "../jobs/cron";

export const startWorker = () => {
  const worker = new Worker(
    "qronjobs",
    async (job) => {
      const { jobId, name, payload, cron_expression } = job.data;

      await Effect.runPromise(
        Effect.gen(function* () {
          const { sql } = yield* DatabaseClient;

          // 1. insert run record
          const [run] = yield* Effect.tryPromise({
            try: () => sql`
              INSERT INTO runs (job_id, status, payload)
              VALUES (${jobId}, 'running', ${sql.json(payload ?? {}) as any})
              RETURNING *
            `,
            catch: (err) =>
              new DatabaseError({
                message: "failed to insert run",
                cause: err,
              }),
          });

          console.log(`Running job: ${name}`, payload);

          // 2. mark run completed
          yield* Effect.tryPromise({
            try: () => sql`
              UPDATE runs
              SET status = 'completed', completed_at = NOW()
              WHERE id = ${run?.id}
            `,
            catch: (err) =>
              new DatabaseError({
                message: "failed to complete run",
                cause: err,
              }),
          });

          // 3. recalculate next_run_at
          const nextRunAt = yield* calculateNextRunAt(cron_expression);

          // 4. update job
          yield* Effect.tryPromise({
            try: () => sql`
              UPDATE jobs
              SET next_run_at = ${nextRunAt}, last_run_at = NOW()
              WHERE id = ${jobId}
            `,
            catch: (err) =>
              new DatabaseError({
                message: "failed to update job",
                cause: err,
              }),
          });

          console.log(`Job ${name} completed, next run at ${nextRunAt}`);
        }).pipe(Effect.provide(DatabaseLive)),
      );
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed: ${err.message}`);
  });

  return worker;
};
