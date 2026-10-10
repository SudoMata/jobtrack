import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { buildErrorResponse } from './build-error-response';

describe('buildErrorResponse', () => {
  it('keeps the status and the message of an HTTP exception', () => {
    expect(buildErrorResponse(new NotFoundException('Application not found'))).toEqual({
      statusCode: 404,
      body: { statusCode: 404, message: 'Application not found' },
    });
  });

  it('handles an HTTP exception built from a plain string', () => {
    expect(buildErrorResponse(new HttpException('Teapot', 418))).toEqual({
      statusCode: 418,
      body: { statusCode: 418, message: 'Teapot' },
    });
  });

  it('keeps the machine-readable code', () => {
    const exception = new ForbiddenException({
      statusCode: 403,
      message: 'Account suspended',
      code: 'ACCOUNT_SUSPENDED',
    });

    expect(buildErrorResponse(exception).body).toEqual({
      statusCode: 403,
      message: 'Account suspended',
      code: 'ACCOUNT_SUSPENDED',
    });
  });

  it('keeps the field errors of a validation failure', () => {
    const exception = new BadRequestException({
      message: 'Validation failed',
      errors: { position: ['position should not be empty'] },
    });

    expect(buildErrorResponse(exception).body).toEqual({
      statusCode: 400,
      message: 'Validation failed',
      errors: { position: ['position should not be empty'] },
    });
  });

  it('joins a list of messages into a single message', () => {
    expect(buildErrorResponse(new BadRequestException(['first', 'second'])).body.message).toBe(
      'first; second',
    );
  });

  it('never leaks the details of an unexpected error', () => {
    const result = buildErrorResponse(new Error('postgres://user:secret-password@db.internal/app'));

    expect(result).toEqual({
      statusCode: 500,
      body: { statusCode: 500, message: 'Internal server error' },
    });
  });

  it('treats a thrown value that is not an Error as an internal error', () => {
    expect(buildErrorResponse('boom').statusCode).toBe(500);
  });
});
