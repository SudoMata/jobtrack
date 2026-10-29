import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApplicationsModule } from '../src/applications/applications.module';
import { AuthModule } from '../src/auth/auth.module';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwks.provider';
import { CommonModule } from '../src/common/common.module';
import { CompaniesModule } from '../src/companies/companies.module';
import { DashboardModule } from '../src/dashboard/dashboard.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakePrisma } from './support/fake-prisma';
import { TEST_SUPABASE_URL, createTestAuth } from './support/test-auth';

const ALICE = { id: '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60', email: 'alice@example.com' };
const BOB = { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'bob@example.com' };

const NO_APPLICATION = { APPLIED: 0, SCREENING: 0, INTERVIEW: 0, OFFER: 0, REJECTED: 0 };

describe('Dashboard (e2e)', () => {
  const fake = createFakePrisma();
  let app: INestApplication;
  let aliceToken: string;
  let bobToken: string;

  beforeAll(async () => {
    const testAuth = await createTestAuth();
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
        DashboardModule,
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
  });

  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
  const post = (path: string, token: string) =>
    request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`);
  const patch = (path: string, token: string) =>
    request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${token}`);
  const del = (path: string, token: string) =>
    request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${token}`);

  async function createCompany(token: string, name: string): Promise<string> {
    const response = await post('/api/companies', token).send({ name }).expect(201);
    return (response.body as { id: string }).id;
  }

  async function createApplication(
    token: string,
    companyId: string,
    status: string,
  ): Promise<string> {
    const response = await post('/api/applications', token)
      .send({
        companyId,
        position: 'Developer',
        contractType: 'FULL_TIME',
        appliedAt: '2026-10-01',
        status,
      })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  it('requires a token', async () => {
    await request(app.getHttpServer()).get('/api/dashboard/stats').expect(401);
  });

  it('answers zero everywhere, with every status present, when there is no application', async () => {
    const response = await get('/api/dashboard/stats', aliceToken).expect(200);

    expect(response.body).toEqual({ total: 0, byStatus: NO_APPLICATION });
  });

  it('counts the applications of the caller by status, and their total', async () => {
    const company = await createCompany(aliceToken, 'Acme');
    await createApplication(aliceToken, company, 'APPLIED');
    await createApplication(aliceToken, company, 'APPLIED');
    await createApplication(aliceToken, company, 'INTERVIEW');

    const response = await get('/api/dashboard/stats', aliceToken).expect(200);

    expect(response.body).toEqual({
      total: 3,
      byStatus: { ...NO_APPLICATION, APPLIED: 2, INTERVIEW: 1 },
    });
  });

  it('follows the status changes and the deletions', async () => {
    const company = await createCompany(aliceToken, 'Acme');
    const first = await createApplication(aliceToken, company, 'APPLIED');
    await createApplication(aliceToken, company, 'APPLIED');

    await patch(`/api/applications/${first}/status`, aliceToken)
      .send({ status: 'OFFER' })
      .expect(200);
    const afterChange = await get('/api/dashboard/stats', aliceToken).expect(200);

    await del(`/api/applications/${first}`, aliceToken).expect(204);
    const afterDeletion = await get('/api/dashboard/stats', aliceToken).expect(200);

    expect(afterChange.body).toEqual({
      total: 2,
      byStatus: { ...NO_APPLICATION, APPLIED: 1, OFFER: 1 },
    });
    expect(afterDeletion.body).toEqual({
      total: 1,
      byStatus: { ...NO_APPLICATION, APPLIED: 1 },
    });
  });

  it('never counts the applications of someone else', async () => {
    const aliceCompany = await createCompany(aliceToken, 'Acme');
    const bobCompany = await createCompany(bobToken, 'Acme');
    await createApplication(aliceToken, aliceCompany, 'APPLIED');
    await createApplication(bobToken, bobCompany, 'REJECTED');
    await createApplication(bobToken, bobCompany, 'REJECTED');

    const alice = await get('/api/dashboard/stats', aliceToken).expect(200);
    const bob = await get('/api/dashboard/stats', bobToken).expect(200);

    expect(alice.body).toEqual({ total: 1, byStatus: { ...NO_APPLICATION, APPLIED: 1 } });
    expect(bob.body).toEqual({ total: 2, byStatus: { ...NO_APPLICATION, REJECTED: 2 } });
  });
});
