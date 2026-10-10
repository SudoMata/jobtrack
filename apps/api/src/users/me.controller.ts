import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MeResponseDto } from './dto/me-response.dto';

@Controller('me')
export class MeController {
  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser): MeResponseDto {
    // Fields are copied one by one: a field added to the user later is never exposed by accident.
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    };
  }
}
