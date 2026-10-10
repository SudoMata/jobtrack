import type { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user';

/** An HTTP request that went through the AuthGuard. */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
