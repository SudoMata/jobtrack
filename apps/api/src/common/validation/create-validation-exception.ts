import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * Builds the 400 response of a validation failure:
 * { message: 'Validation failed', errors: { field: ['reason', ...] } }.
 */
export function createValidationException(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    errors: flattenValidationErrors(errors),
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      result[path] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      Object.assign(result, flattenValidationErrors(error.children, path));
    }
  }

  return result;
}
