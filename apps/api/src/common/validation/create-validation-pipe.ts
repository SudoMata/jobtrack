import { ValidationPipe } from '@nestjs/common';
import { createValidationException } from './create-validation-exception';

/**
 * The global validation rules of the API (TECHNICAL_SPEC.md, section 26).
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // Properties that are not part of the DTO are rejected, not silently ignored:
    // a client can never send a field it is not allowed to set (status, role, userId...).
    whitelist: true,
    forbidNonWhitelisted: true,
    // Payloads are converted into DTO instances.
    transform: true,
    exceptionFactory: createValidationException,
  });
}
