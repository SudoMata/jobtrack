import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminStatsPeriod, periodStart } from './admin-stats-period';
import { buildAdminStats } from './build-admin-stats';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';

/**
 * Platform statistics for administrators.
 *
 * These are the only queries of the project that are not filtered by owner, because the
 * subject is the whole platform. They only COUNT: no row of an application is ever read,
 * so no candidate content can reach an administrator (TECHNICAL_SPEC.md, section 17).
 */
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(period: AdminStatsPeriod, now: Date = new Date()): Promise<AdminStatsResponseDto> {
    const since = periodStart(period, now);

    // The four counts are read in one transaction, so they describe the same moment.
    const [usersByAccountStatus, newUsers, applicationsByStatus, applicationsCreated] =
      await this.prisma.$transaction([
        this.prisma.user.groupBy({
          by: ['accountStatus'],
          orderBy: { accountStatus: 'asc' },
          _count: { _all: true },
        }),
        this.prisma.user.count({ where: { createdAt: { gte: since } } }),
        this.prisma.application.groupBy({
          by: ['status'],
          orderBy: { status: 'asc' },
          _count: { _all: true },
        }),
        this.prisma.application.count({ where: { createdAt: { gte: since } } }),
      ]);

    return buildAdminStats({
      period,
      usersByAccountStatus: usersByAccountStatus.map((row) => ({
        accountStatus: row.accountStatus,
        count: typeof row._count === 'object' && row._count !== null ? (row._count._all ?? 0) : 0,
      })),
      newUsers,
      applicationsByStatus: applicationsByStatus.map((row) => ({
        status: row.status,
        count: typeof row._count === 'object' && row._count !== null ? (row._count._all ?? 0) : 0,
      })),
      applicationsCreated,
    });
  }
}
