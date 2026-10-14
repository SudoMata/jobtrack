import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';

export const TEST_SUPABASE_URL = 'https://abcdefgh.supabase.co';

export interface TestAuth {
  /** A key set that replaces Supabase's public keys in tests. */
  jwks: ReturnType<typeof createLocalJWKSet>;

  /** Signs an access token for the given user, like Supabase would. */
  signToken(userId: string, email: string): Promise<string>;
}

export async function createTestAuth(): Promise<TestAuth> {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const publicJwk = { ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test-key' };

  return {
    jwks: createLocalJWKSet({ keys: [publicJwk] }),
    signToken: (userId, email) =>
      new SignJWT({ email })
        .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
        .setSubject(userId)
        .setIssuer(`${TEST_SUPABASE_URL}/auth/v1`)
        .setAudience('authenticated')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey),
  };
}
