import { IsIn } from 'class-validator';
import { ADMIN_STATS_PERIODS, DEFAULT_ADMIN_STATS_PERIOD } from '../admin-stats-period';
import type { AdminStatsPeriod } from '../admin-stats-period';

/** Query string of GET /api/admin/stats. */
export class AdminStatsQueryDto {
  /** The period of "new users" and "applications created". 30 days when it is left out. */
  @IsIn(ADMIN_STATS_PERIODS)
  period: AdminStatsPeriod = DEFAULT_ADMIN_STATS_PERIOD;
}
