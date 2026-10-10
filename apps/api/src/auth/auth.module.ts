import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthGuard } from './auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';
import { supabaseJwksProvider } from './supabase-jwks.provider';

@Module({
  imports: [UsersModule],
  providers: [
    supabaseJwksProvider,
    JwtVerifierService,
    // Registered globally: every route requires authentication unless marked @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [JwtVerifierService],
})
export class AuthModule {}
