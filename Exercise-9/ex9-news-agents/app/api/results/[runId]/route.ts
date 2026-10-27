import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

const STALLED_AFTER_MS = 10 * 60 * 1000;
const STALLED_MESSAGE = 'The agents stopped responding. Please run them again.';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    if (!/^run_[0-9a-f-]{36}$/.test(runId)) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const results = (await getDB()).collection('results');
    const result = await results.findOne({ runId });

    if (!result) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const lastUpdate = new Date(result.updatedAt || result.createdAt).getTime();

    if (result.status === 'running' && Date.now() - lastUpdate > STALLED_AFTER_MS) {
      await results.updateOne(
        { runId, status: 'running' },
        { $set: { status: 'failed', error: STALLED_MESSAGE, failedAt: new Date() } }
      );
      result.status = 'failed';
      result.error = STALLED_MESSAGE;
    }

    return NextResponse.json({
      runId: result.runId,
      input: result.input,
      status: result.status,
      state: result.state || {},
      error: result.error,
    });
  } catch (error) {
    console.error('Error fetching result:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch result' }, { status: 500 });
  }
}
