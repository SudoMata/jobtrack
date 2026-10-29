import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../generated/prisma/enums';
import { AdminStatsService } from './admin-stats.service';
import { AdminStatsQueryDto } from './dto/admin-stats-query.dto';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';

/** Platform statistics. Every route of this controller is reserved to administrators. */
@Controller('admin/stats')
@Roles(Role.ADMIN)
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get()
  getStats(@Query() query: AdminStatsQueryDto): Promise<AdminStatsResponseDto> {
    return this.adminStatsService.getStats(query.period);
  }
}
