import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { syncAllIndexes } from '@/lib/seed';

const { EJSON } = mongoose.mongo.BSON;

async function main() {
  const folder = process.argv[2];
  if (!folder) throw new Error('Pass the backup folder, for example: npm run restore -- backups/2026-10-27T09-00-00-000Z');

  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection.');

  const files = (await readdir(folder)).filter(file => file.endsWith('.json'));
  for (const file of files) {
    const name = path.basename(file, '.json');
    const documents = EJSON.parse(await readFile(path.join(folder, file), 'utf8')) as mongoose.mongo.Document[];
    await db.collection(name).deleteMany({});
    if (documents.length > 0) await db.collection(name).insertMany(documents);
    console.log(`${name}: restored ${documents.length} documents`);
  }

  await syncAllIndexes();
  console.log(`Restored ${files.length} collections from ${folder}`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
