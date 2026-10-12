import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { HealthResponseDto } from './dto/health-response.dto';

/**
 * Liveness check used by the hosting platform: it only tells that the process answers.
 * It returns no application data and does not query the database.
 */
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  @Get()
  check(): HealthResponseDto {
    return { status: 'ok' };
  }
}
