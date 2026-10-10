import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import type { KeyLike } from 'jose';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { Public } from '../src/auth/decorators/public.decorator';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwks.provider';
import { CommonModule } from '../src/common/common.module';
import type { User } from '../src/generated/prisma/client';
import { AccountStatus, Role } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const USER_ID = '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60';

/** Test-only routes, so that role and public-route behavior can be exercised. */
@Controller('test-admin')
@Roles(Role.ADMIN)
class AdminOnlyController {
  @Get()
  read(): { ok: boolean } {
    return { ok: true };
  }
}

@Public()
@Controller('test-public')
class PublicController {
  @Get()
  read(): { ok: boolean } {
    return { ok: true };
  }

  @Get('boom')
  boom(): never {
    throw new Error('postgres://user:secret-password@db.internal/app');
  }
}

describe('Authentication and authorization (e2e)', () => {
  const users = new Map<string, User>();

  const findUnique = jest.fn(({ where }: { where: { id: string } }) =>
    Promise.resolve(users.get(where.id) ?? null),
  );
  const create = jest.fn(({ data }: { data: { id: string; email: string } }) => {
    const now = new Date();
    const user: User = {
      ...data,
      role: Role.USER,
      accountStatus: AccountStatus.ACTIVE,
      displayName: null,
      createdAt: now,
      updatedAt: now,
    };
    users.set(user.id, user);
    return Promise.resolve(user);
  });

  let app: INestApplication;
  let privateKey: KeyLike;

  function seedUser(overrides: Partial<User> = {}): void {
    const now = new Date();
    users.set(USER_ID, {
      id: USER_ID,
      email: 'candidate@example.com',
      role: Role.USER,
      accountStatus: AccountStatus.ACTIVE,
      displayName: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  }

  function signToken(claims: Record<string, unknown> = {}): Promise<string> {
    return new SignJWT({ email: 'Candidate@Example.com', ...claims })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(USER_ID)
      .setIssuer(`${SUPABASE_URL}/auth/v1`)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  }

  beforeAll(async () => {
    const pair = await generateKeyPair('ES256');
    privateKey = pair.privateKey;
    const publicJwk = { ...(await exportJWK(pair.publicKey)), alg: 'ES256', kid: 'test-key' };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ SUPABASE_URL })],
        }),
        CommonModule,
        AuthModule,
      ],
      controllers: [AdminOnlyController, PublicController],
    })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(createLocalJWKSet({ keys: [publicJwk] }))
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique, create } })
      .compile();

    // Logs are silenced: the 500 test below throws on purpose.
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    users.clear();
    jest.clearAllMocks();
  });

  it('rejects a request without a token', async () => {
    const response = await request(app.getHttpServer()).get('/api/me').expect(401);

    expect(response.body).toEqual({ statusCode: 401, message: 'Authentication required' });
  });

  it('rejects an invalid token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);

    expect(response.body).toEqual({ statusCode: 401, message: 'Invalid or expired token' });
  });

  it('creates the application user on the first request and returns it', async () => {
    const token = await signToken();

    const response = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      id: USER_ID,
      email: 'candidate@example.com',
      role: 'USER',
      accountStatus: 'ACTIVE',
    });
    expect(users.has(USER_ID)).toBe(true);
  });

  it('does not create the user again on the next requests', async () => {
    const token = await signToken();

    await request(app.getHttpServer()).get('/api/me').set('Authorization', `Bearer ${token}`);
    await request(app.getHttpServer()).get('/api/me').set('Authorization', `Bearer ${token}`);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a suspended account with the ACCOUNT_SUSPENDED code', async () => {
    seedUser({ accountStatus: AccountStatus.SUSPENDED });
    const token = await signToken();

    const response = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body).toEqual({
      statusCode: 403,
      message: 'Account suspended',
      code: 'ACCOUNT_SUSPENDED',
    });
  });

  it('ignores a role claimed in the token and uses the database role', async () => {
    seedUser({ role: Role.USER });
    const token = await signToken({ role: 'admin', app_metadata: { role: 'admin' } });

    const response = await request(app.getHttpServer())
      .get('/api/test-admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body).toEqual({ statusCode: 403, message: 'Insufficient permissions' });
  });

  it('lets an administrator reach an admin route', async () => {
    seedUser({ role: Role.ADMIN });
    const token = await signToken();

    await request(app.getHttpServer())
      .get('/api/test-admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('keeps a public route open without a token', async () => {
    await request(app.getHttpServer()).get('/api/test-public').expect(200);
  });

  it('answers an unknown route with the standard error shape', async () => {
    const response = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404);

    expect(response.body).toMatchObject({ statusCode: 404 });
  });

  it('never leaks the details of an unexpected error', async () => {
    const response = await request(app.getHttpServer()).get('/api/test-public/boom').expect(500);

    expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(JSON.stringify(response.body)).not.toContain('secret-password');
  });
});
