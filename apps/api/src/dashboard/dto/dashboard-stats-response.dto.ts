import { ApplicationStatus } from '../../generated/prisma/enums';

/** Response of GET /api/dashboard/stats. */
export class DashboardStatsResponseDto {
  /** The number of applications of the user, all statuses together. */
  total!: number;

  /** The number of applications in each status. Every status is present, even at zero. */
  byStatus!: Record<ApplicationStatus, number>;
}
