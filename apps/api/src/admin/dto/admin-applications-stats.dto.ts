import { ApplicationStatus } from '../../generated/prisma/enums';

/** Platform-wide application figures: counts only, never the content of an application. */
export class AdminApplicationsStatsDto {
  total!: number;

  /** Applications created during the requested period. */
  applicationsCreated!: number;

  /** Every status is present, even at zero. */
  byStatus!: Record<ApplicationStatus, number>;
}
