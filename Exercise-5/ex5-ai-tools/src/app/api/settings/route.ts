import { friendlyMessage } from '@/lib/errors';
import { getSettings, settingsInputSchema, updateSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await getSettings());
  } catch (error) {
    console.error('[settings]', error);
    return Response.json({ error: friendlyMessage(error, 'Could not load settings.') }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const input = settingsInputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: 'Choose a joke category and 5, 10 or 20 rows per page.' }, { status: 400 });
  }

  try {
    return Response.json(await updateSettings(input.data));
  } catch (error) {
    console.error('[settings]', error);
    return Response.json({ error: friendlyMessage(error, 'Could not save settings.') }, { status: 500 });
  }
}
