export class FriendlyError extends Error {}

export function friendlyMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  return error instanceof FriendlyError ? error.message : fallback;
}
