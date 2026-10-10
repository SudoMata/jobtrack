import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { buildErrorResponse } from '../errors/build-error-response';

/**
 * The single exception filter of the API: every error goes through it.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { statusCode, body } = buildErrorResponse(exception);

    // The full detail of an unexpected failure stays in the server logs.
    if (statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }

    host.switchToHttp().getResponse<Response>().status(statusCode).json(body);
  }
}
