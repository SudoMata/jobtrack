import { StatusCount, buildDashboardStats } from '../dashboard/build-dashboard-stats';
import { AccountStatus } from '../generated/prisma/enums';
import { AdminStatsPeriod } from './admin-stats-period';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';

export interface AdminStatsInput {
  period: AdminStatsPeriod;
  usersByAccountStatus: { accountStatus: AccountStatus; count: number }[];
  newUsers: number;
  applicationsByStatus: StatusCount[];
  applicationsCreated: number;
}

/** Builds the admin statistics from the counts the database returned. */
export function buildAdminStats(input: AdminStatsInput): AdminStatsResponseDto {
  const countOf = (status: AccountStatus): number =>
    input.usersByAccountStatus.find((row) => row.accountStatus === status)?.count ?? 0;

  const totalUsers = input.usersByAccountStatus.reduce((sum, row) => sum + row.count, 0);
  const { total, byStatus } = buildDashboardStats(input.applicationsByStatus);

  return {
    period: input.period,
    users: {
      total: totalUsers,
      active: countOf(AccountStatus.ACTIVE),
      suspended: countOf(AccountStatus.SUSPENDED),
      newUsers: input.newUsers,
    },
    applications: { total, applicationsCreated: input.applicationsCreated, byStatus },
  };
}
