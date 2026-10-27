import { InferSchemaType, Model, Schema, model, models } from 'mongoose';
import { GENRES, JOKE_CATEGORIES } from './constants';

const movieSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  year: { type: Number, required: true, min: 1888, max: 2100 },
  genre: { type: String, required: true, enum: GENRES },
  rating: { type: Number, required: true, min: 0, max: 10 },
  director: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
});

movieSchema.index({ title: 1 });
movieSchema.index({ genre: 1, rating: -1 });
movieSchema.index({ rating: -1 });
movieSchema.index({ year: 1 });

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  age: { type: Number, required: true, min: 13, max: 120 },
  favorite_genre: { type: String, required: true, enum: GENRES },
});

userSchema.index({ age: 1 });
userSchema.index({ favorite_genre: 1 });

const reviewSchema = new Schema({
  movie_id: { type: Schema.Types.ObjectId, ref: 'Movie', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 10 },
  comment: { type: String, required: true, trim: true, maxlength: 1000 },
  date: { type: Date, required: true, default: Date.now },
});

reviewSchema.index({ movie_id: 1, date: -1 });
reviewSchema.index({ user_id: 1 });
reviewSchema.index({ rating: -1 });

const jokeSchema = new Schema(
  {
    jokeId: { type: String, required: true, unique: true },
    joke: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: JOKE_CATEGORIES },
    thumbsUp: { type: Number, default: 0, min: 0 },
    thumbsDown: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

jokeSchema.index({ category: 1 });
jokeSchema.index({ joke: 'text' });

const movieCacheSchema = new Schema({
  key: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

const conversationSchema = new Schema(
  {
    chatId: { type: String, required: true, unique: true },
    messages: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);

conversationSchema.index({ updatedAt: -1 });

const toolUsageSchema = new Schema({
  tool: { type: String, required: true },
  success: { type: Boolean, required: true },
  durationMs: { type: Number, required: true, min: 0 },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
});

toolUsageSchema.index({ tool: 1, createdAt: -1 });

const settingsSchema = new Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  jokeCategory: { type: String, required: true, enum: JOKE_CATEGORIES, default: 'dad' },
  pageSize: { type: Number, required: true, min: 5, max: 50, default: 10 },
});

type MovieRecord = InferSchemaType<typeof movieSchema>;
type UserRecord = InferSchemaType<typeof userSchema>;
type ReviewRecord = InferSchemaType<typeof reviewSchema>;
export type JokeRecord = InferSchemaType<typeof jokeSchema>;
type MovieCacheRecord = InferSchemaType<typeof movieCacheSchema>;
type ConversationRecord = InferSchemaType<typeof conversationSchema>;
type ToolUsageRecord = InferSchemaType<typeof toolUsageSchema>;
type SettingsRecord = InferSchemaType<typeof settingsSchema>;

export const Movie: Model<MovieRecord> = models.Movie || model('Movie', movieSchema);
export const User: Model<UserRecord> = models.User || model('User', userSchema);
export const Review: Model<ReviewRecord> = models.Review || model('Review', reviewSchema);
export const Joke: Model<JokeRecord> = models.Joke || model('Joke', jokeSchema);
export const MovieCache: Model<MovieCacheRecord> =
  models.MovieCache || model('MovieCache', movieCacheSchema);
export const Conversation: Model<ConversationRecord> =
  models.Conversation || model('Conversation', conversationSchema);
export const ToolUsage: Model<ToolUsageRecord> = models.ToolUsage || model('ToolUsage', toolUsageSchema);
export const Settings: Model<SettingsRecord> = models.Settings || model('Settings', settingsSchema);
