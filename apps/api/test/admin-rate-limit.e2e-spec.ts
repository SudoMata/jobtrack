import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminModule } from '../src/admin/admin.module';
import { AuthModule } from '../src/auth/auth.module';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwks.provider';
import { CommonModule } from '../src/common/common.module';
import { RateLimitModule } from '../src/common/rate-limit/rate-limit.module';
import { Role } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakePrisma } from './support/fake-prisma';
import { TEST_SUPABASE_URL, createTestAuth } from './support/test-auth';

const CAROL = { id: '0b9c1d2e-3f4a-4b5c-8d6e-7f8091a2b3c4', email: 'carol@example.com' };
const ADA = { id: '4d6e2a10-8b3f-4c71-9e25-1a2b3c4d5e01', email: 'ada@example.com' };

describe('Rate limit of the administrative actions (e2e)', () => {
  const fake = createFakePrisma();
  let app: INestApplication;
  let carolToken: string;

  beforeAll(async () => {
    const testAuth = await createTestAuth();
    carolToken = await testAuth.signToken(CAROL.id, CAROL.email);

    fake.seedUser({ ...CAROL, role: Role.ADMIN });
    fake.seedUser(ADA);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          // The general limit is high: only the stricter one of the admin actions can be reached.
          load: [() => ({ SUPABASE_URL: TEST_SUPABASE_URL, RATE_LIMIT_PER_MINUTE: 1000 })],
        }),
        RateLimitModule,
        CommonModule,
        AuthModule,
        AdminModule,
      ],
    })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(testAuth.jwks)
      .overrideProvider(PrismaService)
      .useValue(fake.client)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows 10 role changes per minute, then answers 429, while the reads stay open', async () => {
    const changeRole = () =>
      request(app.getHttpServer())
        .patch(`/api/admin/users/${ADA.id}/role`)
        .set('Authorization', `Bearer ${carolToken}`)
        .send({ role: 'USER' }); // Ada is already a USER: every call is a 409 that still counts.

    for (let i = 0; i < 10; i++) {
      await changeRole().expect(409);
    }

    const limited = await changeRole().expect(429);
    expect(limited.body).toEqual({ statusCode: 429, message: 'Too many requests' });

    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${carolToken}`)
      .expect(200);
  });
});
