export type MissedJobPolicy = "run_immediately" | "skip";
export type JobStatus = "active" | "paused" | "disabled";
export type RunStatus = "running" | "completed" | "failed";

export type Job = {
  id: string;
  name: string;
  cronExpression: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  missedJobPolicy: MissedJobPolicy;
  nextRunAt: string;
  lastRunAt: string | null;
  createdAt: string;
};

export type Run = {
  id: string;
  jobId: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  payload: Record<string, unknown>;
};

export type CreateJobInput = {
  name: string;
  cronExpression: string;
  payload?: Record<string, unknown>;
  missedJobPolicy: MissedJobPolicy;
};
