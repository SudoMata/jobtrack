import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApplicationsModule } from '../src/applications/applications.module';
import { AuthModule } from '../src/auth/auth.module';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwks.provider';
import { CommonModule } from '../src/common/common.module';
import { CompaniesModule } from '../src/companies/companies.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakePrisma } from './support/fake-prisma';
import { TEST_SUPABASE_URL, createTestAuth } from './support/test-auth';

const ALICE = { id: '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60', email: 'alice@example.com' };
const BOB = { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'bob@example.com' };
const UNKNOWN_ID = '11111111-1111-4111-8111-111111111111';

const NOT_FOUND = { statusCode: 404, message: 'Application not found' };

interface ApplicationBody {
  id: string;
  position: string;
  status: string;
  appliedAt: string;
  nextFollowUpAt: string | null;
  salary: { amount: string; currency: string } | null;
  company: { id: string; name: string };
}

interface ListBody {
  data: ApplicationBody[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

describe('Applications (e2e)', () => {
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
    overrides: Record<string, unknown> = {},
  ): Promise<ApplicationBody> {
    const response = await post('/api/applications', token)
      .send({
        companyId,
        position: 'Developer',
        contractType: 'FULL_TIME',
        appliedAt: '2026-10-01',
        status: 'APPLIED',
        ...overrides,
      })
      .expect(201);
    return response.body as ApplicationBody;
  }

  const positions = (body: unknown): string[] =>
    (body as ListBody).data.map((application) => application.position);

  it('requires a token', async () => {
    await request(app.getHttpServer()).get('/api/applications').expect(401);
    await request(app.getHttpServer()).post('/api/applications').send({}).expect(401);
  });

  describe('create', () => {
    it('creates an application with its company and the first line of its history', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');

      const response = await post('/api/applications', aliceToken)
        .send({
          companyId,
          position: '  Backend developer  ',
          contractType: 'FULL_TIME',
          appliedAt: '2026-10-01',
          status: 'APPLIED',
          salary: { amount: '3500', currency: 'usd' },
        })
        .expect(201);
      const body = response.body as ApplicationBody;

      expect(body).toMatchObject({
        position: 'Backend developer',
        appliedAt: '2026-10-01',
        status: 'APPLIED',
        priority: 'NORMAL',
        source: 'MANUAL',
        salary: { amount: '3500.00', currency: 'USD' },
        company: { id: companyId, name: 'Acme' },
      });
      expect(Object.keys(body).sort()).toEqual([
        'appliedAt',
        'company',
        'contractType',
        'createdAt',
        'id',
        'jobUrl',
        'location',
        'nextFollowUpAt',
        'notes',
        'position',
        'priority',
        'salary',
        'source',
        'status',
        'updatedAt',
        'workMode',
      ]);
      expect(fake.historyOf(body.id)).toEqual([
        { fromStatus: null, toStatus: 'APPLIED', changedByUserId: ALICE.id },
      ]);
    });

    it('rejects an invalid payload with the documented error shape', async () => {
      const response = await post('/api/applications', aliceToken)
        .send({ position: '   ', salary: { amount: '-5', currency: 'US' } })
        .expect(400);

      expect(response.body).toMatchObject({ statusCode: 400, message: 'Validation failed' });
      expect(Object.keys((response.body as { errors: object }).errors)).toEqual(
        expect.arrayContaining(['companyId', 'position', 'salary.amount', 'salary.currency']),
      );
    });

    it('rejects an attempt to set the owner or the source', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');

      const response = await post('/api/applications', aliceToken)
        .send({
          companyId,
          position: 'Developer',
          contractType: 'FULL_TIME',
          appliedAt: '2026-10-01',
          status: 'APPLIED',
          userId: BOB.id,
          source: 'EMAIL',
        })
        .expect(400);

      expect(Object.keys((response.body as { errors: object }).errors)).toEqual(
        expect.arrayContaining(['userId', 'source']),
      );
    });

    it('rejects a date in the future and a follow-up before the application date', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const base = {
        companyId,
        position: 'Developer',
        contractType: 'FULL_TIME',
        status: 'APPLIED',
      };

      const future = await post('/api/applications', aliceToken)
        .send({ ...base, appliedAt: '2999-01-01' })
        .expect(400);
      const followUp = await post('/api/applications', aliceToken)
        .send({ ...base, appliedAt: '2026-10-10', nextFollowUpAt: '2026-10-09' })
        .expect(400);

      expect(Object.keys((future.body as { errors: object }).errors)).toContain('appliedAt');
      expect(Object.keys((followUp.body as { errors: object }).errors)).toContain('nextFollowUpAt');
    });

    it('answers the same 400 for the company of someone else and for a company that does not exist', async () => {
      const bobsCompany = await createCompany(bobToken, 'Bobs company');
      const payload = {
        position: 'Developer',
        contractType: 'FULL_TIME',
        appliedAt: '2026-10-01',
        status: 'APPLIED',
      };

      const foreign = await post('/api/applications', aliceToken)
        .send({ ...payload, companyId: bobsCompany })
        .expect(400);
      const unknown = await post('/api/applications', aliceToken)
        .send({ ...payload, companyId: UNKNOWN_ID })
        .expect(400);

      expect(foreign.body).toEqual(unknown.body);
      expect(foreign.body).toMatchObject({ errors: { companyId: ['Company not found'] } });
    });
  });

  describe('list', () => {
    async function seed(): Promise<void> {
      const acme = await createCompany(aliceToken, 'Acme');
      const beta = await createCompany(aliceToken, 'Beta');
      await createApplication(aliceToken, acme, {
        position: 'Developer',
        appliedAt: '2026-10-01',
        status: 'APPLIED',
        workMode: 'REMOTE',
      });
      await createApplication(aliceToken, beta, {
        position: 'Designer',
        appliedAt: '2026-10-05',
        status: 'INTERVIEW',
      });
      await createApplication(aliceToken, acme, {
        position: 'QA engineer',
        appliedAt: '2026-10-03',
        status: 'OFFER',
        location: 'Kinshasa',
      });
    }

    it('lists the applications of the caller, newest first, with the page information', async () => {
      await seed();

      const response = await get('/api/applications', aliceToken).expect(200);

      expect(positions(response.body)).toEqual(['Designer', 'QA engineer', 'Developer']);
      expect((response.body as ListBody).meta).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
    });

    it('sorts the oldest first when asked to', async () => {
      await seed();

      const response = await get('/api/applications?sort=appliedAt_asc', aliceToken).expect(200);

      expect(positions(response.body)).toEqual(['Developer', 'QA engineer', 'Designer']);
    });

    it('filters by status and by work mode', async () => {
      await seed();

      const byStatus = await get('/api/applications?status=INTERVIEW', aliceToken).expect(200);
      const byMode = await get('/api/applications?workMode=REMOTE', aliceToken).expect(200);

      expect(positions(byStatus.body)).toEqual(['Designer']);
      expect(positions(byMode.body)).toEqual(['Developer']);
    });

    it('filters by location with a partial match that ignores the case', async () => {
      await seed();

      const response = await get('/api/applications?location=KIN', aliceToken).expect(200);

      expect(positions(response.body)).toEqual(['QA engineer']);
    });

    it('searches the company name and the position, ignoring the case', async () => {
      await seed();

      const byCompany = await get('/api/applications?search=ACME', aliceToken).expect(200);
      const byPosition = await get('/api/applications?search=design', aliceToken).expect(200);

      expect(positions(byCompany.body)).toEqual(['QA engineer', 'Developer']);
      expect(positions(byPosition.body)).toEqual(['Designer']);
    });

    it('combines the search and the filters', async () => {
      await seed();

      const response = await get('/api/applications?search=acme&status=OFFER', aliceToken).expect(
        200,
      );

      expect(positions(response.body)).toEqual(['QA engineer']);
    });

    it('paginates and reports the total, like a Kanban column does', async () => {
      await seed();

      const response = await get('/api/applications?limit=2&page=2', aliceToken).expect(200);

      expect(positions(response.body)).toEqual(['Developer']);
      expect((response.body as ListBody).meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('answers an empty page, not an error, beyond the last page', async () => {
      await seed();

      const response = await get('/api/applications?page=9', aliceToken).expect(200);

      expect((response.body as ListBody).data).toEqual([]);
    });

    it('never lists the applications of someone else', async () => {
      await seed();
      const bobsCompany = await createCompany(bobToken, 'Acme');
      await createApplication(bobToken, bobsCompany, { position: 'Bobs application' });

      const alice = await get('/api/applications?search=acme', aliceToken).expect(200);
      const bob = await get('/api/applications', bobToken).expect(200);

      expect(positions(alice.body)).not.toContain('Bobs application');
      expect(positions(bob.body)).toEqual(['Bobs application']);
      expect((bob.body as ListBody).meta.total).toBe(1);
    });

    it.each(['sort=company_asc', 'limit=1000', 'status=HIRED', 'page=0'])(
      'rejects the invalid query %s with a 400',
      async (query) => {
        await get(`/api/applications?${query}`, aliceToken).expect(400);
      },
    );
  });

  describe('isolation between users', () => {
    it('hides an application of someone else exactly like one that does not exist', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);

      const foreign = await get(`/api/applications/${application.id}`, bobToken).expect(404);
      const missing = await get(`/api/applications/${UNKNOWN_ID}`, bobToken).expect(404);

      expect(foreign.body).toEqual(NOT_FOUND);
      expect(missing.body).toEqual(NOT_FOUND);
    });

    it('refuses to modify, change the status of, or delete an application of someone else', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);

      const updated = await patch(`/api/applications/${application.id}`, bobToken)
        .send({ position: 'Hijacked' })
        .expect(404);
      const status = await patch(`/api/applications/${application.id}/status`, bobToken)
        .send({ status: 'REJECTED' })
        .expect(404);
      const deleted = await del(`/api/applications/${application.id}`, bobToken).expect(404);

      expect(updated.body).toEqual(NOT_FOUND);
      expect(status.body).toEqual(NOT_FOUND);
      expect(deleted.body).toEqual(NOT_FOUND);

      const intact = await get(`/api/applications/${application.id}`, aliceToken).expect(200);
      expect(intact.body).toMatchObject({ position: 'Developer', status: 'APPLIED' });
      expect(fake.historyOf(application.id)).toHaveLength(1);
    });
  });

  describe('read, update and delete', () => {
    it('reads an application of the caller, with its company', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);

      const response = await get(`/api/applications/${application.id}`, aliceToken).expect(200);

      expect(response.body).toMatchObject({
        id: application.id,
        company: { id: companyId, name: 'Acme' },
      });
    });

    it('answers 400 for an identifier that is not a UUID', async () => {
      await get('/api/applications/not-a-uuid', aliceToken).expect(400);
    });

    it('updates only the fields that are sent', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId, { location: 'Kinshasa' });

      const response = await patch(`/api/applications/${application.id}`, aliceToken)
        .send({ priority: 'HIGH', notes: 'Call back on Monday' })
        .expect(200);

      expect(response.body).toMatchObject({
        position: 'Developer',
        location: 'Kinshasa',
        priority: 'HIGH',
        notes: 'Call back on Monday',
      });
    });

    it('refuses the status in a general update: it has its own endpoint', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);

      const response = await patch(`/api/applications/${application.id}`, aliceToken)
        .send({ status: 'OFFER' })
        .expect(400);

      expect(Object.keys((response.body as { errors: object }).errors)).toContain('status');
      expect(fake.historyOf(application.id)).toHaveLength(1);
    });

    it('replaces and clears the salary, and clears optional fields with null', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId, {
        salary: { amount: '3500', currency: 'USD' },
        location: 'Kinshasa',
      });

      const replaced = await patch(`/api/applications/${application.id}`, aliceToken)
        .send({ salary: { amount: '4000.5', currency: 'EUR' } })
        .expect(200);
      const cleared = await patch(`/api/applications/${application.id}`, aliceToken)
        .send({ salary: null, location: null })
        .expect(200);

      expect((replaced.body as ApplicationBody).salary).toEqual({
        amount: '4000.50',
        currency: 'EUR',
      });
      expect(cleared.body).toMatchObject({ salary: null, location: null });
    });

    it('checks a new follow-up date against the stored application date', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId, {
        appliedAt: '2026-10-10',
      });

      const response = await patch(`/api/applications/${application.id}`, aliceToken)
        .send({ nextFollowUpAt: '2026-10-09' })
        .expect(400);

      expect(Object.keys((response.body as { errors: object }).errors)).toContain('nextFollowUpAt');
    });

    it('can move an application to another company of the caller, but not to one of someone else', async () => {
      const acme = await createCompany(aliceToken, 'Acme');
      const beta = await createCompany(aliceToken, 'Beta');
      const bobsCompany = await createCompany(bobToken, 'Bobs company');
      const application = await createApplication(aliceToken, acme);

      const moved = await patch(`/api/applications/${application.id}`, aliceToken)
        .send({ companyId: beta })
        .expect(200);
      const refused = await patch(`/api/applications/${application.id}`, aliceToken)
        .send({ companyId: bobsCompany })
        .expect(400);

      expect(moved.body).toMatchObject({ company: { id: beta, name: 'Beta' } });
      expect(refused.body).toMatchObject({ errors: { companyId: ['Company not found'] } });
    });

    it('deletes an application with its history, then answers 404 for it', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);

      await del(`/api/applications/${application.id}`, aliceToken).expect(204);

      await get(`/api/applications/${application.id}`, aliceToken).expect(404);
      expect(fake.historyOf(application.id)).toEqual([]);
    });
  });

  describe('status', () => {
    it('changes the status and records every change in the history', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);

      const response = await patch(`/api/applications/${application.id}/status`, aliceToken)
        .send({ status: 'INTERVIEW' })
        .expect(200);

      expect(response.body).toMatchObject({ id: application.id, status: 'INTERVIEW' });
      expect(fake.historyOf(application.id)).toEqual([
        { fromStatus: null, toStatus: 'APPLIED', changedByUserId: ALICE.id },
        { fromStatus: 'APPLIED', toStatus: 'INTERVIEW', changedByUserId: ALICE.id },
      ]);
    });

    it('allows any transition, including leaving a final status', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);

      await patch(`/api/applications/${application.id}/status`, aliceToken)
        .send({ status: 'REJECTED' })
        .expect(200);
      await patch(`/api/applications/${application.id}/status`, aliceToken)
        .send({ status: 'APPLIED' })
        .expect(200);

      expect(fake.historyOf(application.id)).toHaveLength(3);
    });

    it('answers 409 when the application already has the status, and records nothing', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);

      const response = await patch(`/api/applications/${application.id}/status`, aliceToken)
        .send({ status: 'APPLIED' })
        .expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        message: 'The application already has this status',
      });
      expect(fake.historyOf(application.id)).toHaveLength(1);
    });

    it('rejects an invalid status', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);

      await patch(`/api/applications/${application.id}/status`, aliceToken)
        .send({ status: 'HIRED' })
        .expect(400);
    });

    it('leaves the status unchanged when its history cannot be written', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const application = await createApplication(aliceToken, companyId);
      fake.failNextHistoryWrite();

      const failed = await patch(`/api/applications/${application.id}/status`, aliceToken)
        .send({ status: 'OFFER' })
        .expect(500);

      expect(failed.body).toEqual({ statusCode: 500, message: 'Internal server error' });
      const intact = await get(`/api/applications/${application.id}`, aliceToken).expect(200);
      expect((intact.body as ApplicationBody).status).toBe('APPLIED');
      expect(fake.historyOf(application.id)).toHaveLength(1);
    });
  });

  describe('companies that are in use', () => {
    it('refuses to delete a company that has applications, and tells how many', async () => {
      const companyId = await createCompany(aliceToken, 'Acme');
      const first = await createApplication(aliceToken, companyId, { position: 'First' });
      const second = await createApplication(aliceToken, companyId, { position: 'Second' });

      const two = await del(`/api/companies/${companyId}`, aliceToken).expect(409);
      expect(two.body).toEqual({
        statusCode: 409,
        message: 'This company is linked to 2 applications and cannot be deleted',
      });

      await del(`/api/applications/${first.id}`, aliceToken).expect(204);
      const one = await del(`/api/companies/${companyId}`, aliceToken).expect(409);
      expect(one.body).toEqual({
        statusCode: 409,
        message: 'This company is linked to 1 application and cannot be deleted',
      });

      await del(`/api/applications/${second.id}`, aliceToken).expect(204);
      await del(`/api/companies/${companyId}`, aliceToken).expect(204);
    });
  });
});
