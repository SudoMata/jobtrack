import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { validateEnv } from './config/validate-env';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { CompaniesModule } from './companies/companies.module';
import { ApplicationsModule } from './applications/applications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // RateLimitModule must stay before AuthModule: global guards run in the order their
    // modules are declared, and a flood must be stopped before any token is verified
    // or any database query is made.
    RateLimitModule,
    CommonModule,
    PrismaModule,
    AuthModule,
    CompaniesModule,
    ApplicationsModule,
    HealthModule,
    DashboardModule,
    AdminModule,
  ],
})
export class AppModule {}
