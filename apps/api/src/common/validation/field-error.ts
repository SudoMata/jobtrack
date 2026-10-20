import { BadRequestException } from '@nestjs/common';

/**
 * A 400 in the same shape as a validation failure, for a rule that only a service can check
 * (for instance because it needs to read the database).
 */
export function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    errors: { [field]: [message] },
  });
}
