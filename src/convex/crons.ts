import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Notification worker: drains the QUEUED outbox every minute (async — never on
// the driver's critical write path).
crons.interval("process-notification-outbox", { minutes: 1 }, api.notifications.processOutbox, {});

export default crons;
