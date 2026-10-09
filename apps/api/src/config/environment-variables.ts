import { IsInt, Max, Min } from 'class-validator';

/**
 * Describes every environment variable the API needs.
 * Variables are added here when the feature that uses them is implemented.
 */
export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;
}
