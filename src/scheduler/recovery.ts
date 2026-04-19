import { Effect } from "effect";
import { DatabaseClient, DatabaseLive } from "../database/connection";
import { DatabaseError } from "../libs/errors";
import { calculateNextRunAt } from "../jobs/cron";
import { jobQueue } from "../queue/queue";

export const runRecovery = Effect.gen(function* () {
  const { sql } = yield* DatabaseClient;

  const missedJobs = yield* Effect.tryPromise({
    try: () => sql`
      SELECT * FROM jobs
      WHERE status = 'active'
      AND next_run_at < NOW()
    `,
    catch: (err) =>
      new DatabaseError({ message: "failed to fetch missed jobs", cause: err }),
  });

  if (missedJobs.length === 0) {
    console.log("No missed jobs found");
    return;
  }

  console.log(`Found ${missedJobs.length} missed jobs`);

  for (const job of missedJobs) {
    if (job.missed_job_policy === "run_immediately") {
      jobQueue.add("run-job", {
        jobId: job.id,
        name: job.name,
        payload: job.payload,
      });
      console.log(`Queued missed job: ${job.name}`);
    }

    const nextRunAt = yield* calculateNextRunAt(job.cron_expression);

    yield* Effect.tryPromise({
      try: () => sql`
        UPDATE jobs
        SET next_run_at = ${nextRunAt}
        WHERE id = ${job.id}
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to update next_run_at",
          cause: err,
        }),
    });
  }

  console.log("Recovery completed");
});

export const startRecovery = () =>
  Effect.runPromise(runRecovery.pipe(Effect.provide(DatabaseLive))).catch(
    console.error,
  );
