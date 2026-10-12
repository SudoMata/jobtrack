import { IsInt, IsNotEmpty, IsString, IsUrl, Matches, Max, Min } from 'class-validator';

/**
 * Describes every environment variable the API needs at runtime.
 * Variables are added here when the feature that uses them is implemented.
 * DIRECT_URL is not listed: only the Prisma CLI reads it (see prisma.config.ts).
 */
export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must be a PostgreSQL connection string',
  })
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_SSL_CA_PATH!: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  SUPABASE_URL!: string;

  /** Maximum number of requests per minute and per client IP address. */
  @IsInt()
  @Min(1)
  @Max(10000)
  RATE_LIMIT_PER_MINUTE: number = 120;

  /**
   * Number of reverse proxies between the internet and the API.
   * It must be the exact number: too high lets clients forge their IP address,
   * too low makes every client share the proxy's address.
   */
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY_HOPS: number = 0;
}
