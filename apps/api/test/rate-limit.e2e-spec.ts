import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { CommonModule } from '../src/common/common.module';
import { RateLimitModule } from '../src/common/rate-limit/rate-limit.module';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/prisma/prisma.service';

const LIMIT = 3;

describe('Rate limiting and health check (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              SUPABASE_URL: 'https://abcdefgh.supabase.co',
              RATE_LIMIT_PER_MINUTE: LIMIT,
            }),
          ],
        }),
        // Same order as in AppModule: rate limiting must run before authentication.
        RateLimitModule,
        CommonModule,
        AuthModule,
        HealthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers 429 once the limit is exceeded, before authentication is even checked', async () => {
    const server = app.getHttpServer();

    // Unauthenticated requests are answered 401 until the limit is reached...
    for (let i = 0; i < LIMIT; i++) {
      await request(server).get('/api/me').expect(401);
    }

    // ...then 429. If authentication ran first, this would stay 401 forever.
    const response = await request(server).get('/api/me').expect(429);

    expect(response.body).toEqual({ statusCode: 429, message: 'Too many requests' });
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('never rate-limits the health check', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < LIMIT * 3; i++) {
      await request(server).get('/api/health').expect(200);
    }
  });

  it('serves the health check without authentication', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });
});
