import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  message: string;
  cause?: unknown;
}> {}

export class SchedulerError extends Data.TaggedError("SchedulerError")<{
  message: string;
  cause?: unknown;
}> {}

export class CronParseError extends Data.TaggedError("CronParseError")<{
  message: string;
  cause?: unknown;
}> {}
