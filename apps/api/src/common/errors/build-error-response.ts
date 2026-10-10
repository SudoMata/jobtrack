import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorResponseBody } from './error-response-body';

export interface BuiltErrorResponse {
  statusCode: number;
  body: ErrorResponseBody;
}

const INTERNAL_ERROR_MESSAGE = 'Internal server error';

/**
 * Turns anything that was thrown into the response the client receives.
 * HTTP exceptions are written on purpose to be seen by clients, so they are kept.
 * Anything else is an unexpected failure: the client only gets a generic message.
 */
export function buildErrorResponse(exception: unknown): BuiltErrorResponse {
  if (!(exception instanceof HttpException)) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL_ERROR_MESSAGE },
    };
  }

  const statusCode = exception.getStatus();
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return { statusCode, body: { statusCode, message: response } };
  }

  const { message, errors, code } = response as Record<string, unknown>;
  const body: ErrorResponseBody = {
    statusCode,
    message: toMessage(message, exception.message),
  };

  if (errors !== undefined) {
    body.errors = errors as Record<string, string[]>;
  }
  if (typeof code === 'string') {
    body.code = code;
  }

  return { statusCode, body };
}

function toMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message)) {
    return message.join('; ');
  }
  return fallback;
}
