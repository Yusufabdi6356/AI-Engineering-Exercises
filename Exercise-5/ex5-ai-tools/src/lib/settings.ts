import { z } from 'zod';
import { JOKE_CATEGORIES, PAGE_SIZES, type JokeCategory } from './constants';
import { connectToDatabase } from './db';
import { Settings } from './models';

export const settingsInputSchema = z
  .object({
    jokeCategory: z.enum(JOKE_CATEGORIES),
    pageSize: z.literal(PAGE_SIZES),
  })
  .partial();

export type AppSettings = { jokeCategory: JokeCategory; pageSize: number };

export async function getSettings(): Promise<AppSettings> {
  await connectToDatabase();
  const settings = await Settings.findOneAndUpdate(
    { key: 'default' },
    {},
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();

  return { jokeCategory: settings.jokeCategory, pageSize: settings.pageSize };
}

export async function updateSettings(changes: z.infer<typeof settingsInputSchema>): Promise<AppSettings> {
  await connectToDatabase();
  const settings = await Settings.findOneAndUpdate(
    { key: 'default' },
    { $set: changes },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
  ).lean();

  return { jokeCategory: settings.jokeCategory, pageSize: settings.pageSize };
}
