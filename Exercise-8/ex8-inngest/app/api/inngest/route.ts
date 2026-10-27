import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import {
    approvalWorkflow,
    dailyReport,
    dataProcessor,
    flakyTask,
    processVideo,
    sendEmails,
    sendReminder,
    sendWelcomeEmail,
    simpleGreeter,
    trackSignup
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        simpleGreeter,
        dataProcessor,
        sendEmails,
        approvalWorkflow,
        flakyTask,
        sendReminder,
        dailyReport,
        processVideo,
        sendWelcomeEmail,
        trackSignup
    ]
});
