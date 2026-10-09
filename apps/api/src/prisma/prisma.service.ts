import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { EnvironmentVariables } from '../config/environment-variables';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      // The connection is encrypted and the server certificate is verified
      // against Supabase's CA. Verification is never disabled.
      ssl: {
        ca: readFileSync(config.get('DATABASE_SSL_CA_PATH', { infer: true }), 'utf8'),
        rejectUnauthorized: true,
      },
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Database connection verified');
    } catch (error) {
      // A database that is temporarily unreachable (paused project, network)
      // must not prevent the API from starting.
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Database connection check failed: ${reason}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
