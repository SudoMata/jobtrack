import { AccountStatus, Role } from '../../generated/prisma/enums';

/** A user as an administrator sees them: account metadata only. */
export class AdminUserResponseDto {
  id!: string;
  email!: string;
  displayName!: string | null;
  role!: Role;
  accountStatus!: AccountStatus;
  createdAt!: Date;
  updatedAt!: Date;
}
