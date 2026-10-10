import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import type { KeyLike } from 'jose';
import { EnvironmentVariables } from '../config/environment-variables';
import { JwtVerifierService } from './jwt-verifier.service';

const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const USER_ID = '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60';

interface TokenOptions {
  claims?: Record<string, unknown>;
  subject?: string;
  issuer?: string;
  audience?: string;
  expiration?: string | number;
  key?: KeyLike;
}

describe('JwtVerifierService', () => {
  let privateKey: KeyLike;
  let service: JwtVerifierService;

  beforeAll(async () => {
    const pair = await generateKeyPair('ES256');
    privateKey = pair.privateKey;

    const publicJwk = { ...(await exportJWK(pair.publicKey)), alg: 'ES256', kid: 'test-key' };
    const localJwks = createLocalJWKSet({ keys: [publicJwk] });
    const config = { get: () => SUPABASE_URL } as unknown as ConfigService<
      EnvironmentVariables,
      true
    >;

    service = new JwtVerifierService(config, localJwks);
  });

  function signToken(options: TokenOptions = {}): Promise<string> {
    return new SignJWT({ email: 'Candidate@Example.com', ...options.claims })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(options.subject ?? USER_ID)
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(options.expiration ?? '5m')
      .sign(options.key ?? privateKey);
  }

  it('returns the identity of a valid token, with a lowercase email', async () => {
    const identity = await service.verify(await signToken());

    expect(identity).toEqual({ id: USER_ID, email: 'candidate@example.com' });
  });

  it('rejects an expired token', async () => {
    const expired = await signToken({ expiration: Math.floor(Date.now() / 1000) - 60 });

    await expect(service.verify(expired)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token from another issuer', async () => {
    const token = await signToken({ issuer: 'https://evil.example.com/auth/v1' });

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await signToken({ audience: 'something-else' });

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token signed with an unknown key', async () => {
    const other = await generateKeyPair('ES256');
    const token = await signToken({ key: other.privateKey });

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token that uses a symmetric algorithm', async () => {
    const forged = await new SignJWT({ email: 'candidate@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('a-shared-secret-of-sufficient-length'));

    await expect(service.verify(forged)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token without an email', async () => {
    const token = await signToken({ claims: { email: undefined } });

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token whose subject is not a UUID', async () => {
    const token = await signToken({ subject: 'not-a-uuid' });

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects something that is not a token at all', async () => {
    await expect(service.verify('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
