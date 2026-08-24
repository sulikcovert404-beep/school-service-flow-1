import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Notification worker: drains the QUEUED outbox every minute (async — never on
// the driver's critical write path). Real FCM delivery when credentials are
// configured; simulated otherwise.
crons.interval("deliver-notification-outbox", { minutes: 1 }, api.fcm.deliverOutbox, {});

export default crons;
