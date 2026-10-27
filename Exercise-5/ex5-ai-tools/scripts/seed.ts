import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';

async function main() {
  await connectToDatabase();
  const counts = await seedDatabase();
  console.log(
    `Seeded ${counts.movies} movies, ${counts.users} users and ${counts.reviews} reviews. ` +
      `The joke collection has ${counts.jokes} jokes.`,
  );
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
