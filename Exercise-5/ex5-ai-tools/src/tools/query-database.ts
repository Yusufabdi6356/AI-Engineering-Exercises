import { tool } from 'ai';
import { type PipelineStage, Types, isObjectIdOrHexString } from 'mongoose';
import { z } from 'zod';
import { GENRES } from '@/lib/constants';
import { connectToDatabase } from '@/lib/db';
import { FriendlyError } from '@/lib/errors';
import { Movie, Review, User } from '@/lib/models';
import { escapeRegex } from '@/lib/regex';
import { getSettings } from '@/lib/settings';
import { trackUsage } from '@/lib/usage';

type FieldType = 'id' | 'text' | 'number' | 'genre' | 'date';
type Row = Record<string, string | number | null>;
type MongoFilter = Record<string, Record<string, unknown>>;
type MongoSort = Record<string, 1 | -1>;

const FIELDS: Record<'movies' | 'users' | 'reviews', Record<string, FieldType>> = {
  movies: {
    id: 'id',
    title: 'text',
    year: 'number',
    genre: 'genre',
    rating: 'number',
    director: 'text',
    description: 'text',
  },
  users: { id: 'id', name: 'text', email: 'text', age: 'number', favorite_genre: 'genre' },
  reviews: { id: 'id', movie_id: 'id', user_id: 'id', rating: 'number', comment: 'text', date: 'date' },
};

const COMPARISONS = {
  equals: '$eq',
  notEquals: '$ne',
  greaterThan: '$gt',
  greaterThanOrEqual: '$gte',
  lessThan: '$lt',
  lessThanOrEqual: '$lte',
} as const;

const scalar = z.union([z.string().max(200), z.number()]);

export const queryInputSchema = z.object({
  collection: z.enum(['movies', 'users', 'reviews']),
  operation: z
    .enum(['find', 'count', 'countBy'])
    .default('find')
    .describe('find lists documents, count returns how many match, countBy counts matches per value of groupBy'),
  filters: z
    .array(
      z.object({
        field: z.string().describe('A field of the collection, for example genre, age or rating'),
        operator: z.enum([
          'equals',
          'notEquals',
          'greaterThan',
          'greaterThanOrEqual',
          'lessThan',
          'lessThanOrEqual',
          'contains',
          'in',
        ]),
        value: z.union([scalar, z.array(scalar).max(20)]),
      }),
    )
    .max(5)
    .default([]),
  groupBy: z.string().optional().describe('Field to group by when operation is countBy, for example genre'),
  sortBy: z.string().optional().describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().min(1).default(1),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Only set this when the user asks for a number of results. Otherwise leave it empty to use the saved setting'),
});

export type QueryInput = z.infer<typeof queryInputSchema>;
type Collection = QueryInput['collection'];
type Filter = QueryInput['filters'][number];

export type QueryResult = {
  collection: Collection;
  operation: QueryInput['operation'];
  mongoQuery: string;
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  durationMs: number;
};

function fieldType(collection: Collection, field: string) {
  const type = FIELDS[collection][field];
  if (!type) {
    throw new FriendlyError(
      `"${field}" is not a field of ${collection}. Use one of: ${Object.keys(FIELDS[collection]).join(', ')}.`,
    );
  }
  return type;
}

function mongoField(field: string) {
  return field === 'id' ? '_id' : field;
}

function castValue(type: FieldType, field: string, value: string | number) {
  if (type === 'number') {
    const number = typeof value === 'number' ? value : Number.parseFloat(value);
    if (Number.isNaN(number)) throw new FriendlyError(`${field} needs a number, but got "${value}".`);
    return number;
  }

  if (type === 'genre') {
    const genre = GENRES.find(name => name.toLowerCase() === String(value).trim().toLowerCase());
    if (!genre) throw new FriendlyError(`"${value}" is not a known genre. Genres are: ${GENRES.join(', ')}.`);
    return genre;
  }

  if (type === 'id') {
    if (!isObjectIdOrHexString(value)) throw new FriendlyError(`"${value}" is not a valid ${field}.`);
    return new Types.ObjectId(String(value));
  }

  if (type === 'date') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new FriendlyError(`"${value}" is not a valid date.`);
    return date;
  }

  return String(value);
}

function buildFilter(collection: Collection, filters: Filter[]) {
  const filter: MongoFilter = {};

  for (const { field, operator, value } of filters) {
    const type = fieldType(collection, field);
    const condition = (filter[mongoField(field)] ??= {});

    if (operator === 'in') {
      const values = Array.isArray(value) ? value : [value];
      condition.$in = values.map(item => castValue(type, field, item));
      continue;
    }

    if (Array.isArray(value)) {
      throw new FriendlyError(`The ${operator} filter on ${field} needs one value, not a list.`);
    }

    if (operator === 'contains') {
      if (type !== 'text') throw new FriendlyError(`"contains" only works on text fields, not on ${field}.`);
      condition.$regex = escapeRegex(String(value).trim());
      condition.$options = 'i';
      continue;
    }

    if (operator !== 'equals' && operator !== 'notEquals' && type !== 'number' && type !== 'date') {
      throw new FriendlyError(`"${operator}" only works on number and date fields, not on ${field}.`);
    }

    condition[COMPARISONS[operator]] = castValue(type, field, value);
  }

  return filter;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

async function countMatching(collection: Collection, filter: MongoFilter) {
  if (collection === 'movies') return Movie.countDocuments(filter);
  if (collection === 'users') return User.countDocuments(filter);
  return Review.countDocuments(filter);
}

async function findRows(collection: Collection, filter: MongoFilter, sort: MongoSort, skip: number, limit: number) {
  if (collection === 'movies') {
    const movies = await Movie.find(filter).sort(sort).skip(skip).limit(limit).lean();
    return movies.map<Row>(movie => ({
      id: String(movie._id),
      title: movie.title,
      year: movie.year,
      genre: movie.genre,
      rating: movie.rating,
      director: movie.director,
      description: movie.description,
    }));
  }

  if (collection === 'users') {
    const users = await User.find(filter).sort(sort).skip(skip).limit(limit).lean();
    return users.map<Row>(user => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      age: user.age,
      favorite_genre: user.favorite_genre,
    }));
  }

  const reviews = await Review.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate<{ movie_id: { _id: Types.ObjectId; title: string } | null }>('movie_id', 'title')
    .populate<{ user_id: { _id: Types.ObjectId; name: string } | null }>('user_id', 'name')
    .lean();

  return reviews.map<Row>(review => ({
    id: String(review._id),
    movie: review.movie_id?.title ?? null,
    user: review.user_id?.name ?? null,
    rating: review.rating,
    comment: review.comment,
    date: formatValue(review.date),
    movie_id: review.movie_id ? String(review.movie_id._id) : null,
    user_id: review.user_id ? String(review.user_id._id) : null,
  }));
}

function buildSort(collection: Collection, sortBy: string | undefined, sortOrder: 'asc' | 'desc'): MongoSort {
  if (!sortBy) return { _id: 1 };
  fieldType(collection, sortBy);
  const direction = sortOrder === 'asc' ? 1 : -1;
  return sortBy === 'id' ? { _id: direction } : { [sortBy]: direction, _id: 1 };
}

export async function runQuery(input: QueryInput): Promise<QueryResult> {
  const started = Date.now();
  const { collection, operation, page, groupBy } = input;
  const filter = buildFilter(collection, input.filters);
  const sort = buildSort(collection, input.sortBy, input.sortOrder);

  if (operation === 'countBy') {
    if (!groupBy) throw new FriendlyError('countBy needs a groupBy field, for example genre.');
    fieldType(collection, groupBy);
  }

  await connectToDatabase();
  const pageSize = input.pageSize ?? (await getSettings()).pageSize;
  const result = { collection, operation, page: 1, pageSize, totalPages: 1 };

  try {
    if (operation === 'count') {
      const total = await countMatching(collection, filter);
      return {
        ...result,
        mongoQuery: `db.${collection}.countDocuments(${JSON.stringify(filter)})`,
        rows: [{ count: total }],
        total,
        durationMs: Date.now() - started,
      };
    }

    if (operation === 'countBy' && groupBy) {
      const pipeline: PipelineStage[] = [
        { $match: filter },
        { $group: { _id: `$${mongoField(groupBy)}`, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ];
      const model = collection === 'movies' ? Movie : collection === 'users' ? User : Review;
      const groups = await model.aggregate<{ _id: unknown; count: number }>(pipeline);
      return {
        ...result,
        mongoQuery: `db.${collection}.aggregate(${JSON.stringify(pipeline)})`,
        rows: groups.map(group => ({ [groupBy]: formatValue(group._id), count: group.count })),
        total: groups.reduce((sum, group) => sum + group.count, 0),
        durationMs: Date.now() - started,
      };
    }

    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      findRows(collection, filter, sort, skip, pageSize),
      countMatching(collection, filter),
    ]);

    return {
      ...result,
      mongoQuery: `db.${collection}.find(${JSON.stringify(filter)}).sort(${JSON.stringify(sort)}).skip(${skip}).limit(${pageSize})`,
      rows,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      durationMs: Date.now() - started,
    };
  } catch (error) {
    console.error('[queryDatabase]', error);
    throw new FriendlyError('The database query failed. Please try again in a moment.');
  }
}

export const queryDatabase = tool({
  description:
    'Answer questions about the local MongoDB database by running a safe, validated query. ' +
    'Collections and fields: movies (id, title, year, genre, rating 0-10, director, description), ' +
    'users (id, name, email, age, favorite_genre), reviews (id, movie_id, user_id, rating 1-10, comment, date). ' +
    `Genres: ${GENRES.join(', ')}. ` +
    'Use operation countBy with groupBy to count per value, for example movies per genre. ' +
    'Results are paginated: ask for the next page with page.',
  inputSchema: queryInputSchema,
  execute: async input => trackUsage('queryDatabase', () => runQuery(input)),
});
