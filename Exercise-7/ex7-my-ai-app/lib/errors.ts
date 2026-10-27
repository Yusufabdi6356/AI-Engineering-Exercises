export class FriendlyError extends Error {}

export function friendlyMessage(error: unknown, fallback: string): string {
  return error instanceof FriendlyError ? error.message : fallback;
}
