import { Effect } from "effect";
import {
  createJobIndexes,
  createJobTable,
  createRunIndexes,
  createRunTable,
  createSchemaMigrationsTable,
} from "./schema";
import { DatabaseClient, DatabaseLive } from "./connection";

type Migration = {
  readonly name: string;
  readonly statements: ReadonlyArray<string>;
};

const migrations: ReadonlyArray<Migration> = [
  {
    name: "001_create_schema_migrations",
    statements: [createSchemaMigrationsTable],
  },
  {
    name: "002_create_job_run_tables",
    statements: [createJobTable, createRunTable],
  },
  {
    name: "003_create_job_index",
    statements: [createJobIndexes, createRunIndexes],
  },
];

const ensureMigrationTable = Effect.gen(function* () {
  const db = yield* DatabaseClient;

  yield* Effect.promise(() => db.sql.unsafe(createSchemaMigrationsTable));
});

const hasMigrationRun = (name: string) =>
  Effect.gen(function* () {
    const db = yield* DatabaseClient;

    const rows = yield* Effect.promise(
      () =>
        db.sql<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM schema_migrations
          WHERE name = ${name}
        ) AS exists
      `,
    );

    return rows[0]?.exists === true;
  });

const runSingleMigration = (migration: Migration) =>
  Effect.gen(function* () {
    const alreadyRan = yield* hasMigrationRun(migration.name);

    if (alreadyRan) {
      console.log(`Skipping ${migration.name}`);
      return;
    }

    console.log(`Running ${migration.name}`);

    const db = yield* DatabaseClient;

    yield* Effect.promise(() =>
      db.sql.begin(async () => {
        for (const statement of migration.statements) {
          await db.sql.unsafe(statement);
        }

        await db.sql`
          INSERT INTO schema_migrations (name)
          VALUES (${migration.name})
        `;
      }),
    );

    console.log(`Completed ${migration.name}`);
  });

const migrate = Effect.gen(function* () {
  yield* ensureMigrationTable;

  for (const migration of migrations) {
    yield* runSingleMigration(migration);
  }

  console.log("All migrations completed successfully.");
});

Effect.runPromise(migrate.pipe(Effect.provide(DatabaseLive))).catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
