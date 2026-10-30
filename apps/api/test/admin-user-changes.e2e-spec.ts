import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminModule } from '../src/admin/admin.module';
import { AuthModule } from '../src/auth/auth.module';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwks.provider';
import { CommonModule } from '../src/common/common.module';
import { Role } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakePrisma } from './support/fake-prisma';
import { TEST_SUPABASE_URL, createTestAuth } from './support/test-auth';

const CAROL = { id: '0b9c1d2e-3f4a-4b5c-8d6e-7f8091a2b3c4', email: 'carol@example.com' };
const DAVE = { id: '1c0d2e3f-4a5b-4c6d-9e7f-8091a2b3c4d5', email: 'dave@example.com' };
const ADA = { id: '4d6e2a10-8b3f-4c71-9e25-1a2b3c4d5e01', email: 'ada@example.com' };
const GRACE = { id: '5e7f3b21-9c40-4d82-8f36-2b3c4d5e6f02', email: 'grace@example.com' };
const UNKNOWN_ID = '11111111-1111-4111-8111-111111111111';

describe('Admin user changes (e2e)', () => {
  const fake = createFakePrisma();
  let app: INestApplication;
  let carolToken: string;
  let daveToken: string;
  let adaToken: string;

  beforeAll(async () => {
    const testAuth = await createTestAuth();
    carolToken = await testAuth.signToken(CAROL.id, CAROL.email);
    daveToken = await testAuth.signToken(DAVE.id, DAVE.email);
    adaToken = await testAuth.signToken(ADA.id, ADA.email);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ SUPABASE_URL: TEST_SUPABASE_URL })],
        }),
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

  beforeEach(() => {
    fake.reset();
    fake.seedUser({ ...CAROL, role: Role.ADMIN });
    fake.seedUser({ ...DAVE, role: Role.ADMIN });
    fake.seedUser(ADA);
    fake.seedUser(GRACE);
  });

  const patch = (path: string, token: string) =>
    request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${token}`);
  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);

  const role = (id: string, token: string) => patch(`/api/admin/users/${id}/role`, token);
  const status = (id: string, token: string) => patch(`/api/admin/users/${id}/status`, token);

  describe('access', () => {
    it('requires a token', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/users/${ADA.id}/role`)
        .send({ role: 'ADMIN' })
        .expect(401);
    });

    it('is forbidden to a normal user, who cannot even promote themselves', async () => {
      await role(GRACE.id, adaToken).send({ role: 'ADMIN' }).expect(403);
      await role(ADA.id, adaToken).send({ role: 'ADMIN' }).expect(403);
      await status(GRACE.id, adaToken).send({ status: 'SUSPENDED' }).expect(403);

      expect(fake.auditLogsOf()).toEqual([]);
    });
  });

  describe('roles', () => {
    it('promotes a user and records the change in the audit log', async () => {
      const response = await role(ADA.id, carolToken).send({ role: 'ADMIN' }).expect(200);

      expect(response.body).toMatchObject({ id: ADA.id, role: 'ADMIN', accountStatus: 'ACTIVE' });
      expect(fake.auditLogsOf()).toEqual([
        {
          actorUserId: CAROL.id,
          action: 'ROLE_CHANGED',
          resourceType: 'USER',
          resourceId: ADA.id,
          metadata: { from: 'USER', to: 'ADMIN' },
        },
      ]);
    });

    it('takes effect immediately, in both directions', async () => {
      await get('/api/admin/stats', adaToken).expect(403);

      await role(ADA.id, carolToken).send({ role: 'ADMIN' }).expect(200);
      await get('/api/admin/stats', adaToken).expect(200);

      await role(ADA.id, carolToken).send({ role: 'USER' }).expect(200);
      await get('/api/admin/stats', adaToken).expect(403);
    });

    it('demotes another administrator', async () => {
      const response = await role(DAVE.id, carolToken).send({ role: 'USER' }).expect(200);

      expect((response.body as { role: string }).role).toBe('USER');
      await get('/api/admin/stats', daveToken).expect(403);
    });

    it('refuses that an administrator changes their own role', async () => {
      const response = await role(CAROL.id, carolToken).send({ role: 'USER' }).expect(403);

      expect(response.body).toEqual({
        statusCode: 403,
        message: 'Administrators cannot change their own role',
      });
      expect(fake.auditLogsOf()).toEqual([]);
    });

    it('answers 409 when the user already has the role, and records nothing', async () => {
      const response = await role(ADA.id, carolToken).send({ role: 'USER' }).expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        message: 'The user already has this role',
      });
      expect(fake.auditLogsOf()).toEqual([]);
    });

    it('keeps an active administrator: a demoted one cannot act any more', async () => {
      await role(DAVE.id, carolToken).send({ role: 'USER' }).expect(200);

      // Dave still holds a valid token, but his role in the database is now USER.
      await role(CAROL.id, daveToken).send({ role: 'USER' }).expect(403);
      await status(CAROL.id, daveToken).send({ status: 'SUSPENDED' }).expect(403);

      const carol = await get(`/api/admin/users/${CAROL.id}`, carolToken).expect(200);
      expect(carol.body).toMatchObject({ role: 'ADMIN', accountStatus: 'ACTIVE' });
    });

    it('rejects an invalid body and unknown fields', async () => {
      await role(ADA.id, carolToken).send({ role: 'SUPERUSER' }).expect(400);
      await role(ADA.id, carolToken).send({ role: 'ADMIN', accountStatus: 'ACTIVE' }).expect(400);
      await role(ADA.id, carolToken).send({}).expect(400);
    });

    it('answers 404 for a user that does not exist, and 400 for a malformed identifier', async () => {
      await role(UNKNOWN_ID, carolToken).send({ role: 'ADMIN' }).expect(404);
      await role('not-a-uuid', carolToken).send({ role: 'ADMIN' }).expect(400);
    });
  });

  describe('account status', () => {
    it('suspends an account at once, and reactivates it', async () => {
      await get('/api/me', adaToken).expect(200);

      const suspended = await status(ADA.id, carolToken).send({ status: 'SUSPENDED' }).expect(200);
      expect(suspended.body).toMatchObject({ id: ADA.id, accountStatus: 'SUSPENDED' });

      const blocked = await get('/api/me', adaToken).expect(403);
      expect(blocked.body).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });

      await status(ADA.id, carolToken).send({ status: 'ACTIVE' }).expect(200);
      await get('/api/me', adaToken).expect(200);

      expect(fake.auditLogsOf().map((entry) => [entry.action, entry.metadata])).toEqual([
        ['USER_SUSPENDED', { from: 'ACTIVE', to: 'SUSPENDED' }],
        ['USER_REACTIVATED', { from: 'SUSPENDED', to: 'ACTIVE' }],
      ]);
    });

    it('can suspend another administrator', async () => {
      await status(DAVE.id, carolToken).send({ status: 'SUSPENDED' }).expect(200);

      await get('/api/admin/stats', daveToken).expect(403);
    });

    it('refuses that an administrator changes their own account status', async () => {
      const response = await status(CAROL.id, carolToken).send({ status: 'SUSPENDED' }).expect(403);

      expect(response.body).toEqual({
        statusCode: 403,
        message: 'Administrators cannot change their own account status',
      });
      expect(fake.auditLogsOf()).toEqual([]);
    });

    it('answers 409 when the account already has the status, and records nothing', async () => {
      const response = await status(ADA.id, carolToken).send({ status: 'ACTIVE' }).expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        message: 'The account already has this status',
      });
      expect(fake.auditLogsOf()).toEqual([]);
    });

    it('rejects an invalid status', async () => {
      await status(ADA.id, carolToken).send({ status: 'BANNED' }).expect(400);
    });
  });

  describe('atomicity', () => {
    it('keeps the role unchanged when the audit event cannot be written', async () => {
      fake.failNextAuditWrite();

      const response = await role(ADA.id, carolToken).send({ role: 'ADMIN' }).expect(500);

      expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error' });
      const ada = await get(`/api/admin/users/${ADA.id}`, carolToken).expect(200);
      expect(ada.body).toMatchObject({ role: 'USER' });
      expect(fake.auditLogsOf()).toEqual([]);
    });

    it('keeps the account active when the audit event cannot be written', async () => {
      fake.failNextAuditWrite();

      await status(ADA.id, carolToken).send({ status: 'SUSPENDED' }).expect(500);

      await get('/api/me', adaToken).expect(200);
      expect(fake.auditLogsOf()).toEqual([]);
    });
  });
});
