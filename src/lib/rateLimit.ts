import "server-only";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 20;

type Bucket = { count: number; resetAt: number };

declare global {
  // Kept on globalThis (like the usual Prisma-singleton trick) so the
  // store survives Turbopack/Fast Refresh re-evaluating this module in
  // dev — a plain module-level Map would otherwise reset on every edit,
  // not just on server restart as intended.
  var __publicChatRateLimitStore: Map<string, Bucket> | undefined;
}

const store = globalThis.__publicChatRateLimitStore ?? new Map<string, Bucket>();
globalThis.__publicChatRateLimitStore = store;

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
