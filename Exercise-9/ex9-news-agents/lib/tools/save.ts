import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { saveRunState } from "../db";

export const saveSentimentsTool = createTool({
    name: "save_sentiments",
    description: "Save the sentiment analysis of the articles to the database",
    parameters: z.object({
        sentiments: z.array(
            z.object({
                sentiment: z.enum(["positive", "negative", "neutral"]),
                score: z.number(),
                reasoning: z.string(),
            })
        )
    }),
    handler: async (input, { network, step }) => {
        network.state.data.sentiments = input.sentiments;

        await step?.run('save_sentiments', () =>
            saveRunState(network.state.data.runId, { 'state.sentiments': input.sentiments })
        );

        return { success: true, count: input.sentiments.length };
    }
})

export const savePostsTool = createTool({
    name: "save_posts",
    description: "Save the social media posts to the database",
    parameters: z.object({
        posts: z.array(
            z.object({
                type: z.enum(["twitter", "linkedin"]),
                content: z.string(),
                hashtags: z.array(z.string()),
            })
        )
    }),
    handler: async (input, { network, step }) => {
        network.state.data.posts = input.posts;

        await step?.run('save_posts', () =>
            saveRunState(network.state.data.runId, { 'state.posts': input.posts })
        );

        return { success: true, count: input.posts.length };
    }
})

export const approveContentTool = createTool({
    name: "approve_content",
    description: 'Approve or reject content',
    parameters: z.object({
        approved: z.boolean(),
        notes: z.string().default(''),
    }),
    handler: async (input, { network, step }) => {
        network.state.data.approved = input.approved;
        network.state.data.notes = input.notes;

        await step?.run('save_approval', () =>
            saveRunState(network.state.data.runId, {
                'state.approved': input.approved,
                'state.moderatorNotes': input.notes,
                status: 'success',
                completedAt: new Date(),
            })
        );

        return { success: true, approved: input.approved };
    }
})
