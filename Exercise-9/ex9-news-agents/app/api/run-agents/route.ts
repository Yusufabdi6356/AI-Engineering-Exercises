import { randomUUID } from "node:crypto";
import { inngest } from "@/app/inngest/client";
import { getDB } from "@/lib/db";
import { MAX_QUERY_LENGTH } from "@/lib/news";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    let body: { input?: unknown };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const input = typeof body?.input === 'string' ? body.input.trim() : '';

    if (!input) {
        return NextResponse.json({ error: 'Please enter a search query' }, { status: 400 });
    }

    if (input.length > MAX_QUERY_LENGTH) {
        return NextResponse.json({ error: `Please keep the search query to ${MAX_QUERY_LENGTH} characters or fewer` }, { status: 400 });
    }

    try {
        const runId = `run_${randomUUID()}`;
        const now = new Date();

        const db = await getDB();
        await db.collection('results').insertOne({
            runId,
            input,
            status: 'running',
            state: {},
            createdAt: now,
            updatedAt: now,
        });

        await inngest.send({
            name: "ai.agents/run",
            data: { input, runId }
        })

        return NextResponse.json({ status: 'running', runId });
    } catch (error) {
        console.error('Error starting agents:', error instanceof Error ? error.message : error);
        return NextResponse.json({ error: 'Could not start the agents. Please try again.' }, { status: 500 });
    }
}
