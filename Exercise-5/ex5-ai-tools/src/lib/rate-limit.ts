const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

let windowStart = 0;
let count = 0;

export function isRateLimited() {
  const now = Date.now();

  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    count = 0;
  }

  count += 1;
  return count > MAX_REQUESTS;
}
