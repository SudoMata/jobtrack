/** The periods the admin statistics can be computed over, with their length in days. */
export const ADMIN_STATS_PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

export type AdminStatsPeriod = keyof typeof ADMIN_STATS_PERIOD_DAYS;

export const ADMIN_STATS_PERIODS = Object.keys(ADMIN_STATS_PERIOD_DAYS) as AdminStatsPeriod[];

export const DEFAULT_ADMIN_STATS_PERIOD: AdminStatsPeriod = '30d';

const DAY_IN_MS = 86_400_000;

/** The start of a rolling window that ends now (TECHNICAL_SPEC.md, section 24). */
export function periodStart(period: AdminStatsPeriod, now: Date = new Date()): Date {
  return new Date(now.getTime() - ADMIN_STATS_PERIOD_DAYS[period] * DAY_IN_MS);
}
