import { CronExpressionParser } from "cron-parser";
import { Effect } from "effect";
import { CronParseError } from "../libs/errors";

export const calculateNextRunAt = (cronExpression: string) =>
  Effect.try({
    try: () => {
      const interval = CronExpressionParser.parse(cronExpression);
      const next = interval.next().toDate();
      return next;
    },
    catch: (err) =>
      new CronParseError({
        message: "failed to parse cron expression",
        cause: err,
      }),
  });
