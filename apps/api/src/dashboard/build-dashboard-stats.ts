import { ApplicationStatus } from '../generated/prisma/enums';
import { DashboardStatsResponseDto } from './dto/dashboard-stats-response.dto';

export interface StatusCount {
  status: ApplicationStatus;
  count: number;
}

/**
 * Builds the dashboard statistics from the counts the database returned.
 * Every status appears in the result, even when no application has it, and the list
 * of statuses comes from the enumeration itself: nothing is written by hand.
 */
export function buildDashboardStats(counts: StatusCount[]): DashboardStatsResponseDto {
  const byStatus = Object.fromEntries(
    Object.values(ApplicationStatus).map((status) => [status, 0]),
  ) as Record<ApplicationStatus, number>;

  for (const { status, count } of counts) {
    byStatus[status] = count;
  }

  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);

  return { total, byStatus };
}
