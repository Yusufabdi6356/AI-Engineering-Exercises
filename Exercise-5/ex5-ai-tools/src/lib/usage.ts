import mongoose from 'mongoose';
import { connectToDatabase } from './db';
import { ToolUsage } from './models';

export async function trackUsage<T>(tool: string, run: () => Promise<T>): Promise<T> {
  const started = Date.now();

  try {
    const result = await run();
    await recordUsage(tool, Date.now() - started);
    return result;
  } catch (error) {
    await recordUsage(tool, Date.now() - started, error);
    throw error;
  }
}

async function recordUsage(tool: string, durationMs: number, error?: unknown) {
  if (mongoose.connection.readyState !== 1) return;

  try {
    await ToolUsage.create({
      tool,
      durationMs,
      success: !error,
      error: error instanceof Error ? error.message : undefined,
    });
  } catch (recordError) {
    console.error('[usage]', recordError);
  }
}

export type ToolStat = {
  tool: string;
  calls: number;
  errors: number;
  averageMs: number;
  slowestMs: number;
  lastUsed: string;
};

export async function getToolStats(): Promise<ToolStat[]> {
  await connectToDatabase();

  const rows = await ToolUsage.aggregate<{
    _id: string;
    calls: number;
    errors: number;
    averageMs: number;
    slowestMs: number;
    lastUsed: Date;
  }>([
    {
      $group: {
        _id: '$tool',
        calls: { $sum: 1 },
        errors: { $sum: { $cond: ['$success', 0, 1] } },
        averageMs: { $avg: '$durationMs' },
        slowestMs: { $max: '$durationMs' },
        lastUsed: { $max: '$createdAt' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map(row => ({
    tool: row._id,
    calls: row.calls,
    errors: row.errors,
    averageMs: Math.round(row.averageMs),
    slowestMs: row.slowestMs,
    lastUsed: row.lastUsed.toISOString(),
  }));
}
