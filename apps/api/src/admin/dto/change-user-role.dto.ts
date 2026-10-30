import { IsEnum } from 'class-validator';
import { Role } from '../../generated/prisma/enums';

/** Body of PATCH /api/admin/users/:id/role. */
export class ChangeUserRoleDto {
  @IsEnum(Role)
  role!: Role;
}
