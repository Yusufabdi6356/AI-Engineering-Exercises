import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';

const { EJSON } = mongoose.mongo.BSON;

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection.');

  const folder = path.join('backups', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(folder, { recursive: true });

  const collections = await db.listCollections().toArray();
  for (const { name } of collections) {
    const documents = await db.collection(name).find().toArray();
    await writeFile(path.join(folder, `${name}.json`), EJSON.stringify(documents, undefined, 2));
    console.log(`${name}: ${documents.length} documents`);
  }

  console.log(`Backup saved to ${folder}`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
