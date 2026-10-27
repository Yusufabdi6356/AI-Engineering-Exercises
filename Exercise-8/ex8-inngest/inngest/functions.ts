import { NonRetriableError } from "inngest";
import { inngest } from "./client";

export const simpleGreeter = inngest.createFunction(
    { id: "simple-greeter" },
    { event: "app/greet" },
    async ({ event, step }) => {
        const message = await step.run("create-greeting", async () => {
            return `Hello, ${event.data.name}!`;
        });

        return { message };
    }
);

export const dataProcessor = inngest.createFunction(
    { id: "data-processor" },
    { event: "data/process" },
    async ({ event, step }) => {
        const records = await step.run("fetch-data", async () => {
            console.log(`Fetching records from ${event.data.source}`);
            return [
                { id: 1, amount: 120 },
                { id: 2, amount: 80 },
                { id: 3, amount: 200 }
            ];
        });

        const summary = await step.run("process-data", async () => {
            const total = records.reduce((sum, record) => sum + record.amount, 0);
            return {
                count: records.length,
                total,
                average: total / records.length
            };
        });

        await step.run("save-results", async () => {
            console.log("Saving summary", summary);
            return { saved: true, savedAt: new Date().toISOString() };
        });

        return summary;
    }
);

export const sendEmails = inngest.createFunction(
    { id: "send-emails" },
    { event: "emails/send" },
    async ({ event, step }) => {
        const recipients: string[] = event.data.recipients;

        for (const [index, email] of recipients.entries()) {
            await step.run(`send-email-${index + 1}`, async () => {
                console.log(`Sending email to ${email}`);
                return { to: email, sentAt: new Date().toISOString() };
            });

            if (index < recipients.length - 1) {
                await step.sleep(`wait-after-email-${index + 1}`, "2s");
            }
        }

        return { sent: recipients.length };
    }
);

export const approvalWorkflow = inngest.createFunction(
    { id: "approval-workflow" },
    { event: "approval/requested" },
    async ({ event, step }) => {
        const { requestId, title } = event.data;

        await step.run("notify-approver", async () => {
            console.log(`Approval needed for request ${requestId}: ${title}`);
        });

        const approval = await step.waitForEvent("wait-for-approval", {
            event: "approval/approved",
            timeout: "5m",
            match: "data.requestId"
        });

        if (!approval) {
            await step.run("handle-timeout", async () => {
                console.log(`Request ${requestId} timed out without approval`);
            });
            return { requestId, status: "timed-out" };
        }

        await step.run("process-approval", async () => {
            console.log(`Request ${requestId} approved by ${approval.data.approvedBy}`);
        });

        return { requestId, status: "approved", approvedBy: approval.data.approvedBy };
    }
);

export const flakyTask = inngest.createFunction(
    { id: "flaky-task", retries: 3 },
    { event: "task/run" },
    async ({ event, step, attempt }) => {
        if (!event.data.taskId) {
            throw new NonRetriableError("taskId is required, retrying will not help");
        }

        return await step.run("call-unstable-service", async () => {
            console.log(`Task ${event.data.taskId}, attempt ${attempt + 1}`);

            if (attempt < 2) {
                throw new Error(`Service unavailable on attempt ${attempt + 1}`);
            }

            return { taskId: event.data.taskId, succeededOnAttempt: attempt + 1 };
        });
    }
);

export const sendReminder = inngest.createFunction(
    { id: "send-reminder" },
    { event: "reminder/schedule" },
    async ({ event, step }) => {
        const { message, delayMinutes } = event.data;

        await step.sleep("wait-before-reminder", `${delayMinutes}m`);

        return await step.run("deliver-reminder", async () => {
            console.log(`Reminder: ${message}`);
            return { message, sentAt: new Date().toISOString() };
        });
    }
);

export const dailyReport = inngest.createFunction(
    { id: "daily-report" },
    { cron: "*/1 * * * *" },
    async ({ step }) => {
        const report = await step.run("build-report", async () => {
            return {
                date: new Date().toISOString(),
                newUsers: 12,
                emailsSent: 48
            };
        });

        await step.run("send-report", async () => {
            console.log("Daily report", report);
        });

        return report;
    }
);

export const processVideo = inngest.createFunction(
    { id: "process-video", concurrency: { limit: 2 } },
    { event: "video/uploaded" },
    async ({ event, step }) => {
        return await step.run("transcode-video", async () => {
            const startedAt = new Date().toISOString();
            console.log(`Processing video ${event.data.videoId}`);

            await new Promise((resolve) => setTimeout(resolve, 5000));

            console.log(`Finished video ${event.data.videoId}`);
            return { videoId: event.data.videoId, startedAt, finishedAt: new Date().toISOString() };
        });
    }
);

export const sendWelcomeEmail = inngest.createFunction(
    { id: "send-welcome-email" },
    { event: "user/registered" },
    async ({ event, step }) => {
        const { email, name } = event.data;

        return await step.run("send-email", async () => {
            console.log(`To: ${email}`);
            console.log(`Subject: Welcome, ${name}!`);
            console.log("Thanks for signing up. We are glad to have you.");
            return { to: email, sentAt: new Date().toISOString() };
        });
    }
);

export const trackSignup = inngest.createFunction(
    { id: "track-signup" },
    { event: "user/registered" },
    async ({ event, step }) => {
        return await step.run("log-signup", async () => {
            const entry = {
                event: "user_signed_up",
                userId: event.data.id,
                email: event.data.email,
                at: new Date().toISOString()
            };
            console.log("Analytics", entry);
            return entry;
        });
    }
);
