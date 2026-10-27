import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import OpenAI from "openai";
import { getDB, saveRunState } from "../db";

export const generatePosterTool = createTool({
    name: "generate_poster",
    description: "Generate a single, eye-catching poster for the social media posts",
    parameters: z.object({
        prompt: z.string().describe("A detailed description of the poster to generate")
    }),
    handler: async (input, { network, step }) => {
        const runId = network.state.data.runId;

        const imageUrl = await step?.run('generate_poster_image', async () => {
            const openai = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: process.env.OPENROUTER_API_KEY || '',
            })

            const response = await openai.images.generate({
                model: "openai/gpt-image-2",
                prompt: input.prompt,
                aspect_ratio: "1:1",
                quality: "low"
            } as OpenAI.ImageGenerateParamsNonStreaming)

            const image = response.data?.[0]?.b64_json;

            if (!image) {
                return null;
            }

            const db = await getDB();
            const { insertedId } = await db.collection('posters').insertOne({ runId, image, createdAt: new Date() });

            return `/api/posters/${insertedId.toString()}`;
        })

        if (!imageUrl) {
            throw new Error('Failed to generate poster');
        }

        const posters = [...(network.state.data.posters || []), { url: imageUrl, prompt: input.prompt }];
        network.state.data.posters = posters;

        await step?.run('save_posters', () => saveRunState(runId, { 'state.posters': posters }));

        return { success: true, imageUrl, prompt: input.prompt };
    }
})
