import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthGuard } from './auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';
import { RolesGuard } from './roles.guard';
import { supabaseJwksProvider } from './supabase-jwks.provider';

@Module({
  imports: [UsersModule],
  providers: [
    supabaseJwksProvider,
    JwtVerifierService,
    // Global guards run in the order they are declared:
    // authentication first, then role authorization.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtVerifierService],
})
export class AuthModule {}
