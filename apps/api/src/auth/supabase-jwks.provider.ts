import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet } from 'jose';
import { EnvironmentVariables } from '../config/environment-variables';
import { getSupabaseAuthUrl } from './supabase-auth-url';

/** Injection token for the source of Supabase's public signing keys. */
export const SUPABASE_JWKS = Symbol('SUPABASE_JWKS');

export const supabaseJwksProvider: Provider = {
  provide: SUPABASE_JWKS,
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
    const authUrl = getSupabaseAuthUrl(config.get('SUPABASE_URL', { infer: true }));

    // Keys are downloaded on first use, cached, and refreshed automatically
    // when Supabase rotates them. Nothing is fetched at startup.
    return createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`));
  },
};
