import { sampleJokes, sampleMovies, sampleReviews, sampleUsers } from '@/data/sample-data';
import { Conversation, Joke, Movie, MovieCache, Review, Settings, ToolUsage, User } from './models';

export async function syncAllIndexes() {
  await Promise.all(
    [Movie, User, Review, Joke, MovieCache, Conversation, ToolUsage, Settings].map(model => model.syncIndexes()),
  );
}

export async function seedDatabase() {
  await Promise.all([Movie.deleteMany({}), User.deleteMany({}), Review.deleteMany({})]);

  const movies = await Movie.insertMany(sampleMovies);
  const users = await User.insertMany(sampleUsers);

  const movieIds = new Map(movies.map(movie => [movie.title, movie._id]));
  const userIds = new Map(users.map(user => [user.email, user._id]));

  const reviews = await Review.insertMany(
    sampleReviews.map(review => ({
      movie_id: movieIds.get(review.movie),
      user_id: userIds.get(review.user),
      rating: review.rating,
      comment: review.comment,
      date: new Date(review.date),
    })),
  );

  await Joke.bulkWrite(
    sampleJokes.map(joke => ({
      updateOne: {
        filter: { jokeId: joke.jokeId },
        update: { $setOnInsert: { joke: joke.joke, category: joke.category } },
        upsert: true,
      },
    })),
  );

  await syncAllIndexes();

  return {
    movies: movies.length,
    users: users.length,
    reviews: reviews.length,
    jokes: await Joke.countDocuments(),
  };
}
