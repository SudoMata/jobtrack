import { IsEnum } from 'class-validator';
import { AccountStatus } from '../../generated/prisma/enums';

/** Body of PATCH /api/admin/users/:id/status. */
export class ChangeUserStatusDto {
  @IsEnum(AccountStatus)
  status!: AccountStatus;
}
