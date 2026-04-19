import { Effect } from "effect";
import { DatabaseClient, DatabaseLive } from "../database/connection";
import { jobQueue } from "../queue/queue";
import { DatabaseError } from "../libs/errors";

const pollJobs = Effect.gen(function* () {
  const { sql } = yield* DatabaseClient;
  const jobs = yield* Effect.tryPromise({
    try: () =>
      sql.begin(async (tx) => {
        const jobs = await tx`
            SELECT * FROM jobs
            WHERE status = 'active'
            AND next_run_at <= NOW()
            FOR UPDATE SKIP LOCKED
            `;
        for (const job of jobs) {
          await jobQueue.add("run-job", {
            jobId: job.id,
            name: job.name,
            payload: job.payload,
            cron_expression: job.cron_expression,
          });
          await tx`
            UPDATE jobs
            SET last_run_at = NOW()
            WHERE id = ${job.id}
          `;
        }
        return jobs;
      }),
    catch: (err) =>
      new DatabaseError({
        message: "failed to poll job",
        cause: err,
      }),
  });
  if (jobs.length > 0) {
    console.log(`Dispatched ${jobs.length} jobs`);
  }
});

export const startPoller = () => {
  console.log("Poller started");
  setInterval(() => {
    Effect.runPromise(pollJobs.pipe(Effect.provide(DatabaseLive))).catch(
      console.error,
    );
  }, 30_000);
};
