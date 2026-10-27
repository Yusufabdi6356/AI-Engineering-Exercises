export function missingKeys(keys: string[], action: string): string | null {
  const missing = keys.filter((key) => !process.env[key]);

  if (missing.length === 0) {
    return null;
  }

  const list = new Intl.ListFormat('en', { type: 'conjunction' }).format(missing);
  return `Add ${list} to .env.local to ${action}.`;
}
