import { BadRequestException } from '@nestjs/common';
import { fieldError } from './field-error';

describe('fieldError', () => {
  it('builds a 400 in the documented validation error shape', () => {
    const error = fieldError('companyId', 'Company not found');

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual({
      message: 'Validation failed',
      errors: { companyId: ['Company not found'] },
    });
  });
});
