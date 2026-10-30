/**
 * The stricter rate limit of the sensitive administrative actions: 10 requests per minute
 * and per client IP, on each of these routes (TECHNICAL_SPEC.md, section 41).
 */
export const ADMIN_WRITE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
