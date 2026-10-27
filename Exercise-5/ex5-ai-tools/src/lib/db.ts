import mongoose from 'mongoose';
import { FriendlyError } from './errors';

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new FriendlyError('MONGODB_URI is not set. Add it to .env.local and restart the app.');
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    console.error('[database]', error);
    throw new FriendlyError(
      'Could not connect to MongoDB. Make sure the MongoDB service is running and MONGODB_URI in .env.local is correct.',
    );
  }
}
