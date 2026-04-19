import { Hono } from "hono";
import jobsRoute from "./src/api/routes/jobs";
import { startWorker } from "./src/queue/worker";
import { startPoller } from "./src/scheduler/poller";
import { startRecovery } from "./src/scheduler/recovery";

const app = new Hono();
app.route("/", jobsRoute);

// start worker
startWorker();
console.log("Worker started");

// run recovery once on startup
startRecovery();
console.log("Recovery started");

// start poller
startPoller();

export default {
  port: 3000,
  fetch: app.fetch,
};
