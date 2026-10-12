import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EnvironmentVariables } from '../../config/environment-variables';

/** Length of the counting window, in milliseconds. */
const WINDOW_MS = 60_000;

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        errorMessage: 'Too many requests',
        throttlers: [
          {
            ttl: WINDOW_MS,
            limit: config.get('RATE_LIMIT_PER_MINUTE', { infer: true }),
          },
        ],
      }),
    }),
  ],
  // Registered globally: every route is limited unless marked @SkipThrottle().
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
