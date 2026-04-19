import { Hono } from "hono";
import type { JobStatus, MissedJobPolicy } from "../../libs/types";
import { Effect } from "effect";
import { calculateNextRunAt } from "../../jobs/cron";
import { DatabaseClient, DatabaseLive } from "../../database/connection";
import { DatabaseError } from "../../libs/errors";
import { async } from "effect/Stream";

const app = new Hono();

app.post("/jobs", async (c) => {
  const body = await c.req.json<{
    name: string;
    cron_expression: string;
    payload?: Record<string, unknown>;
    missed_job_policy?: MissedJobPolicy;
  }>();

  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }
  if (!body.cron_expression) {
    return c.json({ error: "cron_expression is required" }, 400);
  }

  const insertJob = Effect.gen(function* () {
    const nextRunAt = yield* calculateNextRunAt(body.cron_expression);
    const { sql } = yield* DatabaseClient;
    const [job] = yield* Effect.tryPromise({
      try: () => sql`
        INSERT INTO jobs (name, cron_expression, payload, missed_job_policy, next_run_at)
        VALUES (
          ${body.name},
          ${body.cron_expression},
          ${sql.json(body.payload ?? ({} as any))},
          ${body.missed_job_policy ?? "skip"},
          ${nextRunAt}
        )
        RETURNING *
      `,
      catch: (err) =>
        new DatabaseError({ message: "failed to insert job", cause: err }),
    });
    return job;
  });

  const result = await Effect.runPromiseExit(
    insertJob.pipe(Effect.provide(DatabaseLive)),
  );

  if (result._tag === "Failure") {
    const err = result.cause;
    return c.json({ error: "failed to create job" }, 500);
  }

  return c.json(result.value, 201);
});

app.get("/jobs", async (c) => {
  const getJobs = Effect.gen(function* () {
    const { sql } = yield* DatabaseClient;
    const jobs = yield* Effect.tryPromise({
      try: () =>
        sql`
            SELECT * FROM jobs ORDER BY created_at DESC
            `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to fetch jobs",
          cause: err,
        }),
    });
    return jobs;
  });
  const result = await Effect.runPromiseExit(
    getJobs.pipe(Effect.provide(DatabaseLive)),
  );
  if (result._tag === "Failure") {
    return c.json({ error: "failed to fetch jobs" }, 500);
  }

  return c.json(result.value, 200);
});

app.get("/jobs/:id", async (c) => {
  const id = c.req.param("id");
  const getJobByID = Effect.gen(function* () {
    const { sql } = yield* DatabaseClient;
    const jobs = yield* Effect.tryPromise({
      try: () => sql`
            SELECT * FROM jobs WHERE id = ${id}
            `,
      catch: (err) =>
        new DatabaseError({
          message: "invalid ID",
          cause: err,
        }),
    });
    return jobs;
  });
  const result = await Effect.runPromiseExit(
    getJobByID.pipe(Effect.provide(DatabaseLive)),
  );
  if (result._tag === "Failure") {
    return c.json({ error: "failed to fetch jobs" }, 500);
  }

  return c.json(result.value, 200);
});

app.patch("/jobs/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ status: JobStatus }>();

  if (!body.status) {
    return c.json({ error: "status is required" }, 400);
  }

  const updateJob = Effect.gen(function* () {
    const { sql } = yield* DatabaseClient;
    const [job] = yield* Effect.tryPromise({
      try: () => sql`
        UPDATE jobs
        SET status = ${body.status}
        WHERE id = ${id}
        RETURNING *
      `,
      catch: (err) =>
        new DatabaseError({ message: "failed to update job", cause: err }),
    });
    return job;
  });

  const result = await Effect.runPromiseExit(
    updateJob.pipe(Effect.provide(DatabaseLive)),
  );

  if (result._tag === "Failure") {
    return c.json({ error: "failed to update job" }, 500);
  }

  if (!result.value) {
    return c.json({ error: "job not found" }, 404);
  }

  return c.json(result.value, 200);
});

app.delete("/jobs/:id", async (c) => {
  const id = c.req.param("id");
  const deleteJob = Effect.gen(function* () {
    const { sql } = yield* DatabaseClient;
    yield* Effect.tryPromise({
      try: () => sql`DELETE FROM jobs WHERE id = ${id}`,
      catch: (err) =>
        new DatabaseError({ message: "failed to delete job", cause: err }),
    });
  });

  const result = await Effect.runPromiseExit(
    deleteJob.pipe(Effect.provide(DatabaseLive)),
  );

  if (result._tag === "Failure") {
    return c.json({ error: "failed to delete job" }, 500);
  }

  return c.body(null, 204);
});

export default app;
