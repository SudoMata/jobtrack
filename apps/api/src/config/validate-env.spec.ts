import { validateEnv } from './validate-env';

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:secret-password@db.example.com:6543/postgres',
  DATABASE_SSL_CA_PATH: 'certs/supabase-ca.crt',
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
};

describe('validateEnv', () => {
  it('accepts a minimal valid environment and applies the defaults', () => {
    const env = validateEnv(VALID_ENV);

    expect(env.PORT).toBe(3000);
    expect(env.RATE_LIMIT_PER_MINUTE).toBe(120);
    expect(env.TRUST_PROXY_HOPS).toBe(0);
  });

  it('converts numeric values that are given as text', () => {
    const env = validateEnv({ ...VALID_ENV, PORT: '4000', TRUST_PROXY_HOPS: '1' });

    expect(env.PORT).toBe(4000);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
  });

  it.each([
    ['PORT', 'abc'],
    ['PORT', '70000'],
    ['TRUST_PROXY_HOPS', '-1'],
    ['RATE_LIMIT_PER_MINUTE', '0'],
  ])('rejects %s=%s', (name, value) => {
    expect(() => validateEnv({ ...VALID_ENV, [name]: value })).toThrow(name);
  });

  it('rejects a missing database URL', () => {
    const withoutDatabaseUrl = {
      DATABASE_SSL_CA_PATH: VALID_ENV.DATABASE_SSL_CA_PATH,
      SUPABASE_URL: VALID_ENV.SUPABASE_URL,
    };
    expect(() => validateEnv(withoutDatabaseUrl)).toThrow('DATABASE_URL');
  });

  it('rejects a Supabase URL that does not use https', () => {
    expect(() =>
      validateEnv({ ...VALID_ENV, SUPABASE_URL: 'http://abcdefgh.supabase.co' }),
    ).toThrow('SUPABASE_URL');
  });

  it('never puts a value in the error message', () => {
    const invalid = { ...VALID_ENV, DATABASE_URL: 'mysql://user:secret-password@host/db' };

    let message = '';
    try {
      validateEnv(invalid);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('DATABASE_URL');
    expect(message).not.toContain('secret-password');
  });
});
