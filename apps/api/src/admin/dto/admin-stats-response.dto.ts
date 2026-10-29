import { AdminStatsPeriod } from '../admin-stats-period';
import { AdminApplicationsStatsDto } from './admin-applications-stats.dto';
import { AdminUsersStatsDto } from './admin-users-stats.dto';

/** Response of GET /api/admin/stats. */
export class AdminStatsResponseDto {
  /** The period that "newUsers" and "applicationsCreated" cover. */
  period!: AdminStatsPeriod;

  users!: AdminUsersStatsDto;
  applications!: AdminApplicationsStatsDto;
}
