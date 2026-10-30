import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminModule } from '../src/admin/admin.module';
import { ApplicationsModule } from '../src/applications/applications.module';
import { AuthModule } from '../src/auth/auth.module';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwks.provider';
import { CommonModule } from '../src/common/common.module';
import { CompaniesModule } from '../src/companies/companies.module';
import { Role } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakePrisma } from './support/fake-prisma';
import { TEST_SUPABASE_URL, createTestAuth } from './support/test-auth';

const daysAgo = (days: number): Date => new Date(Date.now() - days * 86_400_000);

const ADMIN = { id: '0b9c1d2e-3f4a-4b5c-8d6e-7f8091a2b3c4', email: 'carol@example.com' };
const ADA = {
  id: '4d6e2a10-8b3f-4c71-9e25-1a2b3c4d5e01',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  createdAt: daysAgo(3),
};
const GRACE = {
  id: '5e7f3b21-9c40-4d82-8f36-2b3c4d5e6f02',
  email: 'grace@example.com',
  displayName: 'Grace Hopper',
  createdAt: daysAgo(2),
};
const LINUS = {
  id: '6f804c32-ad51-4e93-9047-3c4d5e6f7a03',
  email: 'linus@example.com',
  displayName: null,
  createdAt: daysAgo(1),
};
const UNKNOWN_ID = '11111111-1111-4111-8111-111111111111';

interface ListBody {
  data: { id: string; email: string }[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

describe('Admin users (e2e)', () => {
  const fake = createFakePrisma();
  let app: INestApplication;
  let adminToken: string;
  let adaToken: string;

  beforeAll(async () => {
    const testAuth = await createTestAuth();
    adminToken = await testAuth.signToken(ADMIN.id, ADMIN.email);
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
        CompaniesModule,
        ApplicationsModule,
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
    fake.seedUser({ ...ADMIN, role: Role.ADMIN });
    fake.seedUser(ADA);
    fake.seedUser(GRACE);
    fake.seedUser(LINUS);
  });

  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
  const post = (path: string, token: string) =>
    request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`);

  const emails = (body: unknown): string[] => (body as ListBody).data.map((user) => user.email);

  describe('access', () => {
    it('requires a token', async () => {
      await request(app.getHttpServer()).get('/api/admin/users').expect(401);
      await request(app.getHttpServer()).get(`/api/admin/users/${ADA.id}`).expect(401);
    });

    it('is forbidden to a normal user', async () => {
      await get('/api/admin/users', adaToken).expect(403);
      await get(`/api/admin/users/${GRACE.id}`, adaToken).expect(403);
    });
  });

  describe('list', () => {
    it('lists the accounts, newest first, with their metadata only', async () => {
      const response = await get('/api/admin/users', adminToken).expect(200);
      const body = response.body as ListBody;

      expect(emails(body)).toEqual([
        'carol@example.com',
        'linus@example.com',
        'grace@example.com',
        'ada@example.com',
      ]);
      expect(Object.keys(body.data[0]).sort()).toEqual([
        'accountStatus',
        'createdAt',
        'displayName',
        'email',
        'id',
        'role',
        'updatedAt',
      ]);
      expect(body.meta).toEqual({ page: 1, limit: 20, total: 4, totalPages: 1 });
    });

    it('paginates', async () => {
      const response = await get('/api/admin/users?limit=2&page=2', adminToken).expect(200);

      expect(emails(response.body)).toEqual(['grace@example.com', 'ada@example.com']);
      expect((response.body as ListBody).meta).toEqual({
        page: 2,
        limit: 2,
        total: 4,
        totalPages: 2,
      });
    });

    it('searches the email and the display name, ignoring the case', async () => {
      const byName = await get('/api/admin/users?search=LOVELACE', adminToken).expect(200);
      const byEmail = await get('/api/admin/users?search=GRACE@', adminToken).expect(200);
      const everyone = await get('/api/admin/users?search=example.com', adminToken).expect(200);
      const nobody = await get('/api/admin/users?search=zzz', adminToken).expect(200);

      expect(emails(byName.body)).toEqual(['ada@example.com']);
      expect(emails(byEmail.body)).toEqual(['grace@example.com']);
      expect((everyone.body as ListBody).meta.total).toBe(4);
      expect(nobody.body).toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it('answers an empty page, not an error, beyond the last page', async () => {
      const response = await get('/api/admin/users?page=9', adminToken).expect(200);

      expect((response.body as ListBody).data).toEqual([]);
    });

    it.each(['limit=1000', 'page=0', 'role=ADMIN', 'accountStatus=SUSPENDED'])(
      'rejects the invalid query %s with a 400',
      async (query) => {
        await get(`/api/admin/users?${query}`, adminToken).expect(400);
      },
    );
  });

  describe('detail', () => {
    it('shows the account metadata of any user', async () => {
      const response = await get(`/api/admin/users/${GRACE.id}`, adminToken).expect(200);

      expect(response.body).toEqual({
        id: GRACE.id,
        email: 'grace@example.com',
        displayName: 'Grace Hopper',
        role: 'USER',
        accountStatus: 'ACTIVE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('never reveals the companies or the applications of a user', async () => {
      const company = await post('/api/companies', adaToken)
        .send({ name: 'Private company' })
        .expect(201);
      await post('/api/applications', adaToken)
        .send({
          companyId: (company.body as { id: string }).id,
          position: 'Private position',
          contractType: 'FULL_TIME',
          appliedAt: '2026-10-01',
          status: 'APPLIED',
          notes: 'Private notes of a candidate',
        })
        .expect(201);

      const response = await get(`/api/admin/users/${ADA.id}`, adminToken).expect(200);
      const text = JSON.stringify(response.body);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'accountStatus',
        'createdAt',
        'displayName',
        'email',
        'id',
        'role',
        'updatedAt',
      ]);
      expect(text).not.toContain('Private');
    });

    it('answers 404 for a user that does not exist, and 400 for a malformed identifier', async () => {
      const unknown = await get(`/api/admin/users/${UNKNOWN_ID}`, adminToken).expect(404);
      await get('/api/admin/users/not-a-uuid', adminToken).expect(400);

      expect(unknown.body).toEqual({ statusCode: 404, message: 'User not found' });
    });
  });
});
