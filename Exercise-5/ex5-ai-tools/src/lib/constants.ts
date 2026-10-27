export const GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Drama',
  'Fantasy',
  'Horror',
  'Romance',
  'Sci-Fi',
  'Thriller',
] as const;

export const JOKE_CATEGORIES = ['dad', 'programming', 'general'] as const;

export const PAGE_SIZES = [5, 10, 20] as const;

export type JokeCategory = (typeof JOKE_CATEGORIES)[number];
