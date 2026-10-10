import { AccountStatus, Role } from '../../generated/prisma/enums';

/** Response of GET /api/me: who the caller is and what they may do. */
export class MeResponseDto {
  id!: string;
  email!: string;
  role!: Role;
  accountStatus!: AccountStatus;
}
