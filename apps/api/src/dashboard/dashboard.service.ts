import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildDashboardStats } from './build-dashboard-stats';
import { DashboardStatsResponseDto } from './dto/dashboard-stats-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The statistics of one user, computed from the persisted applications.
   * A single grouped query counts them by status, so the figures always agree.
   */
  async getStats(userId: string): Promise<DashboardStatsResponseDto> {
    const rows = await this.prisma.application.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    });

    return buildDashboardStats(rows.map((row) => ({ status: row.status, count: row._count._all })));
  }
}
