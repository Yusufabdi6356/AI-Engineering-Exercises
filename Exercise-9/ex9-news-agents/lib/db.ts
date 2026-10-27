import { MongoClient, Db } from 'mongodb';

let connection: Promise<Db> | undefined;

export function getDB() {
  if (!connection) {
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');

    connection = client
      .connect()
      .then(() => client.db(process.env.MONGODB_DB || 'ex9-news'))
      .catch((error) => {
        connection = undefined;
        console.error('MongoDB connection failed:', error instanceof Error ? error.message : error);
        throw error;
      });
  }

  return connection;
}

export async function saveRunState(runId: string | undefined, fields: Record<string, unknown>) {
  if (!runId) {
    console.error('No runId found');
    return;
  }

  const db = await getDB();
  await db.collection('results').updateOne(
    { runId, status: 'running' },
    { $set: { ...fields, updatedAt: new Date() } }
  );
}
