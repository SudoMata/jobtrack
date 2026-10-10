import { Module } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service';
import { supabaseJwksProvider } from './supabase-jwks.provider';

@Module({
  providers: [supabaseJwksProvider, JwtVerifierService],
  exports: [JwtVerifierService],
})
export class AuthModule {}
