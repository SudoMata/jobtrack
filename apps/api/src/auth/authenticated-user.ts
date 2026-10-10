import { AccountStatus, Role } from '../generated/prisma/enums';

/**
 * The user attached to a request once the AuthGuard has accepted it.
 * Role and account status come from the database, never from the token.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
}
