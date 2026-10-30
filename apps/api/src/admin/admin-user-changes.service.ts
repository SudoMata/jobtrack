import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { Prisma } from '../generated/prisma/client';
import { AccountStatus, AuditAction, AuditResourceType, Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_USER_SELECT, AdminUser } from './admin-user.select';
import { assertAnActiveAdminRemains, isActiveAdmin } from './assert-active-admin-remains';
import { LockedUser, lockUsersForChange } from './lock-users-for-change';

/**
 * The sensitive actions of an administrator: change a role, suspend or reactivate an account.
 * Each one runs in a single transaction that locks the rows involved, applies the change and
 * writes its audit event. If anything fails, nothing is kept (TECHNICAL_SPEC.md, section 16.1).
 */
@Injectable()
export class AdminUserChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async changeRole(actorId: string, targetId: string, role: Role): Promise<AdminUser> {
    if (actorId === targetId) {
      throw new ForbiddenException('Administrators cannot change their own role');
    }

    return this.prisma.$transaction(async (tx) => {
      const { target, activeAdminIds } = await this.lockAndCheck(tx, actorId, targetId);

      if (target.role === role) {
        throw new ConflictException('The user already has this role');
      }
      assertAnActiveAdminRemains({
        activeAdminIds,
        target,
        nextRole: role,
        nextAccountStatus: target.accountStatus,
      });

      const updated = await tx.user.update({
        where: { id: targetId },
        data: { role },
        select: ADMIN_USER_SELECT,
      });
      await this.auditService.record(tx, {
        actorUserId: actorId,
        action: AuditAction.ROLE_CHANGED,
        resourceType: AuditResourceType.USER,
        resourceId: targetId,
        metadata: { from: target.role, to: role },
      });

      return updated;
    });
  }

  async changeStatus(actorId: string, targetId: string, status: AccountStatus): Promise<AdminUser> {
    if (actorId === targetId) {
      throw new ForbiddenException('Administrators cannot change their own account status');
    }

    return this.prisma.$transaction(async (tx) => {
      const { target, activeAdminIds } = await this.lockAndCheck(tx, actorId, targetId);

      if (target.accountStatus === status) {
        throw new ConflictException('The account already has this status');
      }
      assertAnActiveAdminRemains({
        activeAdminIds,
        target,
        nextRole: target.role,
        nextAccountStatus: status,
      });

      const updated = await tx.user.update({
        where: { id: targetId },
        data: { accountStatus: status },
        select: ADMIN_USER_SELECT,
      });
      await this.auditService.record(tx, {
        actorUserId: actorId,
        action:
          status === AccountStatus.SUSPENDED
            ? AuditAction.USER_SUSPENDED
            : AuditAction.USER_REACTIVATED,
        resourceType: AuditResourceType.USER,
        resourceId: targetId,
        metadata: { from: target.accountStatus, to: status },
      });

      return updated;
    });
  }

  /**
   * Locks the rows involved, then checks what must hold at this very moment:
   * the actor is still an active administrator, and the target exists.
   */
  private async lockAndCheck(
    tx: Prisma.TransactionClient,
    actorId: string,
    targetId: string,
  ): Promise<{ target: LockedUser; activeAdminIds: string[] }> {
    const locked = await lockUsersForChange(tx, targetId);
    const activeAdminIds = locked.filter(isActiveAdmin).map((user) => user.id);

    // The role of the actor was read when the request was authenticated. Another administrator
    // may have demoted or suspended them since: their authority is checked again under the lock.
    if (!activeAdminIds.includes(actorId)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const target = locked.find((user) => user.id === targetId);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    return { target, activeAdminIds };
  }
}
