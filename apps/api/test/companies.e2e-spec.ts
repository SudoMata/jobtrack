import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
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

const NOT_FOUND = { statusCode: 404, message: 'Company not found' };

interface CompanyBody {
  id: string;
  name: string;
  website: string | null;
  location: string | null;
}

describe('Companies (e2e)', () => {
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

  async function createCompany(token: string, body: Record<string, unknown>): Promise<CompanyBody> {
    const response = await post('/api/companies', token).send(body).expect(201);
    return response.body as CompanyBody;
  }

  describe('authentication', () => {
    it('requires a token', async () => {
      await request(app.getHttpServer()).get('/api/companies').expect(401);
      await request(app.getHttpServer()).post('/api/companies').send({ name: 'Acme' }).expect(401);
    });
  });

  describe('create', () => {
    it('creates a company and never exposes its owner', async () => {
      const response = await post('/api/companies', aliceToken)
        .send({ name: '  Acme  ', website: 'https://acme.com' })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Acme',
        website: 'https://acme.com',
        location: null,
      });
      expect(Object.keys(response.body as object).sort()).toEqual([
        'createdAt',
        'id',
        'location',
        'name',
        'updatedAt',
        'website',
      ]);
    });

    it('rejects an invalid payload with the documented error shape', async () => {
      const response = await post('/api/companies', aliceToken)
        .send({ name: '   ', website: 'javascript:alert(1)' })
        .expect(400);

      expect(response.body).toMatchObject({ statusCode: 400, message: 'Validation failed' });
      expect(Object.keys((response.body as { errors: object }).errors)).toEqual(
        expect.arrayContaining(['name', 'website']),
      );
    });

    it('rejects an attempt to choose the owner', async () => {
      const response = await post('/api/companies', aliceToken)
        .send({ name: 'Acme', userId: BOB.id })
        .expect(400);

      expect(Object.keys((response.body as { errors: object }).errors)).toContain('userId');
    });

    it('answers 409 for a name the user already has, ignoring case and spaces', async () => {
      await createCompany(aliceToken, { name: 'Acme' });

      const response = await post('/api/companies', aliceToken)
        .send({ name: '  ACME  ' })
        .expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        message: 'A company with this name already exists',
      });
    });

    it('lets two different users have a company with the same name', async () => {
      await createCompany(aliceToken, { name: 'Acme' });

      await post('/api/companies', bobToken).send({ name: 'Acme' }).expect(201);
    });
  });

  describe('list', () => {
    it('only lists the companies of the caller, ordered by name', async () => {
      await createCompany(aliceToken, { name: 'Zeta' });
      await createCompany(aliceToken, { name: 'acme' });
      await createCompany(aliceToken, { name: 'Beta' });
      await createCompany(bobToken, { name: 'Bobs company' });

      const response = await get('/api/companies', aliceToken).expect(200);
      const body = response.body as { data: CompanyBody[]; meta: object };

      expect(body.data.map((company) => company.name)).toEqual(['acme', 'Beta', 'Zeta']);
      expect(body.meta).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
    });

    it('paginates', async () => {
      await createCompany(aliceToken, { name: 'A' });
      await createCompany(aliceToken, { name: 'B' });
      await createCompany(aliceToken, { name: 'C' });

      const response = await get('/api/companies?page=2&limit=2', aliceToken).expect(200);
      const body = response.body as { data: CompanyBody[]; meta: object };

      expect(body.data.map((company) => company.name)).toEqual(['C']);
      expect(body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    });

    it('answers an empty page, not an error, beyond the last page', async () => {
      await createCompany(aliceToken, { name: 'A' });

      const response = await get('/api/companies?page=9', aliceToken).expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: { page: 9, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('searches by name without caring about the case, and only among the caller companies', async () => {
      await createCompany(aliceToken, { name: 'Zeta' });
      await createCompany(aliceToken, { name: 'Beta' });
      await createCompany(aliceToken, { name: 'Acme' });
      await createCompany(bobToken, { name: 'Meta' });

      const response = await get('/api/companies?search=ET', aliceToken).expect(200);
      const body = response.body as { data: CompanyBody[] };

      expect(body.data.map((company) => company.name)).toEqual(['Beta', 'Zeta']);
    });

    it('rejects invalid pagination with a 400', async () => {
      const response = await get('/api/companies?limit=1000', aliceToken).expect(400);

      expect(Object.keys((response.body as { errors: object }).errors)).toContain('limit');
    });
  });

  describe('isolation between users', () => {
    it('hides a company of someone else exactly like a company that does not exist', async () => {
      const company = await createCompany(aliceToken, { name: 'Acme' });

      const other = await get(`/api/companies/${company.id}`, bobToken).expect(404);
      const missing = await get(`/api/companies/${UNKNOWN_ID}`, bobToken).expect(404);

      expect(other.body).toEqual(NOT_FOUND);
      expect(missing.body).toEqual(NOT_FOUND);
    });

    it('refuses to modify or delete a company of someone else, and leaves it untouched', async () => {
      const company = await createCompany(aliceToken, { name: 'Acme' });

      const updated = await patch(`/api/companies/${company.id}`, bobToken)
        .send({ name: 'Hijacked' })
        .expect(404);
      const deleted = await del(`/api/companies/${company.id}`, bobToken).expect(404);

      expect(updated.body).toEqual(NOT_FOUND);
      expect(deleted.body).toEqual(NOT_FOUND);

      const stillThere = await get(`/api/companies/${company.id}`, aliceToken).expect(200);
      expect((stillThere.body as CompanyBody).name).toBe('Acme');
    });
  });

  describe('read, update and delete', () => {
    it('reads a company of the caller', async () => {
      const company = await createCompany(aliceToken, { name: 'Acme' });

      const response = await get(`/api/companies/${company.id}`, aliceToken).expect(200);

      expect(response.body).toMatchObject({ id: company.id, name: 'Acme' });
    });

    it('answers 400 for an identifier that is not a UUID', async () => {
      await get('/api/companies/not-a-uuid', aliceToken).expect(400);
    });

    it('updates only the fields that are sent', async () => {
      const company = await createCompany(aliceToken, {
        name: 'Acme',
        website: 'https://acme.com',
        location: 'Kinshasa',
      });

      const response = await patch(`/api/companies/${company.id}`, aliceToken)
        .send({ location: 'Lubumbashi' })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Acme',
        website: 'https://acme.com',
        location: 'Lubumbashi',
      });
    });

    it('clears the website when null is sent', async () => {
      const company = await createCompany(aliceToken, {
        name: 'Acme',
        website: 'https://acme.com',
      });

      const response = await patch(`/api/companies/${company.id}`, aliceToken)
        .send({ website: null })
        .expect(200);

      expect((response.body as CompanyBody).website).toBeNull();
    });

    it('refuses to clear the name', async () => {
      const company = await createCompany(aliceToken, { name: 'Acme' });

      await patch(`/api/companies/${company.id}`, aliceToken).send({ name: null }).expect(400);
    });

    it('lets a company change the case of its own name', async () => {
      const company = await createCompany(aliceToken, { name: 'acme' });

      const response = await patch(`/api/companies/${company.id}`, aliceToken)
        .send({ name: 'ACME' })
        .expect(200);

      expect((response.body as CompanyBody).name).toBe('ACME');
    });

    it('answers 409 when renaming to the name of another company of the user', async () => {
      await createCompany(aliceToken, { name: 'Acme' });
      const other = await createCompany(aliceToken, { name: 'Beta' });

      await patch(`/api/companies/${other.id}`, aliceToken).send({ name: 'ACME' }).expect(409);
    });

    it('deletes a company, then answers 404 for it', async () => {
      const company = await createCompany(aliceToken, { name: 'Acme' });

      await del(`/api/companies/${company.id}`, aliceToken).expect(204);
      await get(`/api/companies/${company.id}`, aliceToken).expect(404);
    });

    it('answers 409 when applications still use the company', async () => {
      const company = await createCompany(aliceToken, { name: 'Acme' });
      fake.companiesInUse.add(company.id);

      const response = await del(`/api/companies/${company.id}`, aliceToken).expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        message: 'This company is linked to applications and cannot be deleted',
      });
      await get(`/api/companies/${company.id}`, aliceToken).expect(200);
    });
  });
});
