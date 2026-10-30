import type { AdminUser } from './admin-user.select';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';

/** Copies the fields one by one: only account metadata can leave through an admin endpoint. */
export function toAdminUserResponse(user: AdminUser): AdminUserResponseDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
