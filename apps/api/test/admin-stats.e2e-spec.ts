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
import { AccountStatus, Role } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakePrisma } from './support/fake-prisma';
import { TEST_SUPABASE_URL, createTestAuth } from './support/test-auth';

const ADMIN = { id: '0b9c1d2e-3f4a-4b5c-8d6e-7f8091a2b3c4', email: 'carol@example.com' };
const ALICE = { id: '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60', email: 'alice@example.com' };
const BOB = { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'bob@example.com' };

const daysAgo = (days: number): Date => new Date(Date.now() - days * 86_400_000);

describe('Admin statistics (e2e)', () => {
  const fake = createFakePrisma();
  let app: INestApplication;
  let adminToken: string;
  let aliceToken: string;
  let bobToken: string;

  beforeAll(async () => {
    const testAuth = await createTestAuth();
    adminToken = await testAuth.signToken(ADMIN.id, ADMIN.email);
    aliceToken = await testAuth.signToken(ALICE.id, ALICE.email);
    bobToken = await testAuth.signToken(BOB.id, BOB.email);

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
  });

  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
  const post = (path: string, token: string) =>
    request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`);

  async function createCompany(token: string): Promise<string> {
    const response = await post('/api/companies', token).send({ name: 'Acme' }).expect(201);

    return (response.body as { id: string }).id;
  }

  async function createApplication(
    token: string,
    status: string,
    companyId: string,
  ): Promise<void> {
    await post('/api/applications', token)
      .send({
        companyId,
        position: 'Private position',
        contractType: 'FULL_TIME',
        appliedAt: '2026-10-01',
        status,
        notes: 'Private notes of a candidate',
      })
      .expect(201);
  }

  it('requires a token', async () => {
    await request(app.getHttpServer()).get('/api/admin/stats').expect(401);
  });

  it('is forbidden to a normal user', async () => {
    const response = await get('/api/admin/stats', aliceToken).expect(403);

    expect(response.body).toEqual({ statusCode: 403, message: 'Insufficient permissions' });
  });

  it('counts the users and the applications of the whole platform', async () => {
    fake.seedUser({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'suspended@example.com',
      accountStatus: AccountStatus.SUSPENDED,
    });
    fake.seedUser({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'mid@example.com',
      createdAt: daysAgo(45),
    });
    fake.seedUser({
      id: '33333333-3333-4333-8333-333333333333',
      email: 'old@example.com',
      createdAt: daysAgo(100),
    });
    const aliceCompanyId = await createCompany(aliceToken);
    const bobCompanyId = await createCompany(bobToken);

    await createApplication(aliceToken, 'APPLIED', aliceCompanyId);
    await createApplication(aliceToken, 'INTERVIEW', aliceCompanyId);
    await createApplication(bobToken, 'REJECTED', bobCompanyId);

    const response = await get('/api/admin/stats', adminToken).expect(200);

    // Users: admin, suspended, mid, old, alice, bob.
    expect(response.body).toEqual({
      period: '30d',
      users: { total: 6, active: 5, suspended: 1, newUsers: 4 },
      applications: {
        total: 3,
        applicationsCreated: 3,
        byStatus: { APPLIED: 1, SCREENING: 0, INTERVIEW: 1, OFFER: 0, REJECTED: 1 },
      },
    });
  });

  it('applies the requested period to the new users only', async () => {
    fake.seedUser({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'mid@example.com',
      createdAt: daysAgo(45),
    });
    fake.seedUser({
      id: '33333333-3333-4333-8333-333333333333',
      email: 'old@example.com',
      createdAt: daysAgo(100),
    });

    const week = await get('/api/admin/stats?period=7d', adminToken).expect(200);
    const quarter = await get('/api/admin/stats?period=90d', adminToken).expect(200);

    const users = (body: unknown) => (body as { users: { total: number; newUsers: number } }).users;
    expect(users(week.body)).toEqual({ total: 3, newUsers: 1, active: 3, suspended: 0 });
    expect(users(quarter.body)).toEqual({ total: 3, newUsers: 2, active: 3, suspended: 0 });
    expect((quarter.body as { period: string }).period).toBe('90d');
  });

  it('only exposes counts: no email and no content of an application', async () => {
    const companyId = await createCompany(aliceToken);

    await createApplication(aliceToken, 'APPLIED', companyId);

    const response = await get('/api/admin/stats', adminToken).expect(200);
    const text = JSON.stringify(response.body);

    expect(Object.keys(response.body as object).sort()).toEqual([
      'applications',
      'period',
      'users',
    ]);
    expect(text).not.toContain('alice@example.com');
    expect(text).not.toContain('Private position');
    expect(text).not.toContain('Private notes');
  });

  it('rejects an unknown period with a 400', async () => {
    await get('/api/admin/stats?period=1d', adminToken).expect(400);
  });
});
