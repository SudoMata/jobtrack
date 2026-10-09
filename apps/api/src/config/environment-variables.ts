import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

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
}
