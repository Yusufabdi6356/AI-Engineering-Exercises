import { inngest } from "./client";
import { newsAnalysisNetwork } from "@/lib/network";
import { getDB } from "@/lib/db";

async function markFailed(runId: string, message: string) {
    const db = await getDB();
    await db.collection('results').updateOne(
        { runId, status: 'running' },
        { $set: { status: 'failed', error: message, failedAt: new Date(), updatedAt: new Date() } }
    );
}

function missingKeyMessage() {
    if (!process.env.OPENROUTER_API_KEY) {
        return 'OpenRouter API key is missing. Add OPENROUTER_API_KEY to .env.local and restart the app.';
    }

    if (!process.env.SERPER_API_KEY) {
        return 'Serper API key is missing. Add SERPER_API_KEY to .env.local and restart the app to search for news.';
    }

    return null;
}

export async function runNewsAnalysis({ event }: { event: { data: { input: string; runId: string } } }) {
    const { input, runId } = event.data;

    const missingKey = missingKeyMessage();

    if (missingKey) {
        console.error(missingKey);
        await markFailed(runId, missingKey);
        return { runId, error: missingKey };
    }

    try {
        const result = await newsAnalysisNetwork.run(input, {
            state: {
                data: { runId }
            }
        })

        await markFailed(runId, 'The agents stopped before finishing the workflow. Please run them again.');

        return { runId, approved: result.state.data.approved ?? null };

    } catch (error) {
        console.error('Error running agents:', error instanceof Error ? error.message : error);

        try {
            await markFailed(runId, 'Something went wrong while the agents were running. Please try again.');
        } catch (dbError) {
            console.error('Failed to save error:', dbError instanceof Error ? dbError.message : dbError);
        }

        throw error;
    }
}

export const newsAnalysisWorkflow = inngest.createFunction(
    { id: "news-analysis-workflow" },
    { event: "ai.agents/run" },
    runNewsAnalysis
)
