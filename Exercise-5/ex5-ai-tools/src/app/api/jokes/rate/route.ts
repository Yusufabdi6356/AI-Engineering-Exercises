import { isObjectIdOrHexString } from 'mongoose';
import { z } from 'zod';
import { friendlyMessage } from '@/lib/errors';
import { rateJoke } from '@/tools/get-jokes';

const rateSchema = z.object({
  id: z.string().refine(id => isObjectIdOrHexString(id)),
  vote: z.enum(['up', 'down']),
});

export async function POST(req: Request) {
  const input = rateSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: 'Send a joke id and a vote of "up" or "down".' }, { status: 400 });
  }

  try {
    const joke = await rateJoke(input.data.id, input.data.vote);
    if (!joke) return Response.json({ error: 'That joke was not found.' }, { status: 404 });
    return Response.json(joke);
  } catch (error) {
    console.error('[rate]', error);
    return Response.json({ error: friendlyMessage(error, 'Could not save your rating.') }, { status: 500 });
  }
}
