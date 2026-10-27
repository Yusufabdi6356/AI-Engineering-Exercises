import { friendlyMessage } from '@/lib/errors';
import { queryInputSchema, runQuery } from '@/tools/query-database';

export async function POST(req: Request) {
  const input = queryInputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: 'The query is not valid.' }, { status: 400 });
  }

  try {
    return Response.json(await runQuery(input.data));
  } catch (error) {
    return Response.json({ error: friendlyMessage(error) }, { status: 400 });
  }
}
