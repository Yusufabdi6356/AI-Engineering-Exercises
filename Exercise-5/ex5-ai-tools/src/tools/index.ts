import type { InferUITools, UIDataTypes, UIMessage, UIToolInvocation } from 'ai';
import { getJokes } from './get-jokes';
import { queryDatabase } from './query-database';
import { searchMovie } from './search-movie';

export const tools = { queryDatabase, searchMovie, getJokes };

export type ChatMessage = UIMessage<unknown, UIDataTypes, InferUITools<typeof tools>>;
export type QueryDatabasePart = UIToolInvocation<typeof queryDatabase>;
export type SearchMoviePart = UIToolInvocation<typeof searchMovie>;
export type GetJokesPart = UIToolInvocation<typeof getJokes>;
