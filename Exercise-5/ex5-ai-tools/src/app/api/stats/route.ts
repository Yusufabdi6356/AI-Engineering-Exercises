import { friendlyMessage } from '@/lib/errors';
import { getToolStats } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await getToolStats());
  } catch (error) {
    console.error('[stats]', error);
    return Response.json({ error: friendlyMessage(error, 'Could not load tool statistics.') }, { status: 500 });
  }
}
