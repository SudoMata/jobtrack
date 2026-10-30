import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { AdminUserChangesService } from './admin-user-changes.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AdminStatsController, AdminUsersController],
  providers: [AdminStatsService, AdminUsersService, AdminUserChangesService],
})
export class AdminModule {}
