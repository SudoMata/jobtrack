import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail, isUUID } from 'class-validator';
import { jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { EnvironmentVariables } from '../config/environment-variables';
import { AuthenticatedIdentity } from './authenticated-identity';
import { getSupabaseAuthUrl } from './supabase-auth-url';
import { SUPABASE_JWKS } from './supabase-jwks.provider';

/** Audience of the access tokens Supabase issues to signed-in users. */
const SUPABASE_AUDIENCE = 'authenticated';

/** Only asymmetric algorithms are accepted (TECHNICAL_SPEC.md, section 4.2). */
const ALLOWED_ALGORITHMS = ['ES256', 'RS256'];

@Injectable()
export class JwtVerifierService {
  private readonly issuer: string;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    @Inject(SUPABASE_JWKS) private readonly jwks: JWTVerifyGetKey,
  ) {
    this.issuer = getSupabaseAuthUrl(config.get('SUPABASE_URL', { infer: true }));
  }

  /**
   * Verifies an access token and returns the identity it carries.
   * Every failure produces the same generic 401, so a client learns nothing
   * about why a token was rejected.
   */
  async verify(token: string): Promise<AuthenticatedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: SUPABASE_AUDIENCE,
        algorithms: ALLOWED_ALGORITHMS,
      });

      return this.toIdentity(payload);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private toIdentity(payload: JWTPayload): AuthenticatedIdentity {
    const { sub, email } = payload;

    if (typeof sub !== 'string' || !isUUID(sub)) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (typeof email !== 'string' || !isEmail(email)) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return { id: sub, email: email.toLowerCase() };
  }
}
