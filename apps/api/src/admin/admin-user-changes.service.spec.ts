import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditResourceType } from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { ADMIN_USER_SELECT, AdminUser } from './admin-user.select';
import { AdminUserChangesService } from './admin-user-changes.service';
import type { LockedUser } from './lock-users-for-change';

const ACTOR_ID = '0b9c1d2e-3f4a-4b5c-8d6e-7f8091a2b3c4';
const TARGET_ID = '4d6e2a10-8b3f-4c71-9e25-1a2b3c4d5e01';

const admin = (id: string): LockedUser => ({ id, role: 'ADMIN', accountStatus: 'ACTIVE' });
const regularUser = (id: string, accountStatus: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE'): LockedUser => ({
  id,
  role: 'USER',
  accountStatus,
});

const CREATED_AT = new Date('2026-01-01T10:00:00.000Z');
const UPDATED_AT = new Date('2026-01-02T10:00:00.000Z');

function updatedUser(): AdminUser {
  return {
    id: TARGET_ID,
    email: 'ada@example.com',
    displayName: null,
    role: 'ADMIN',
    accountStatus: 'ACTIVE',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  };
}

describe('AdminUserChangesService', () => {
  const queryRaw = jest.fn();
  const update = jest.fn();
  const record = jest.fn();
  const transaction = jest.fn();
  const tx = { $queryRaw: queryRaw, user: { update } };
  let service: AdminUserChangesService;

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    service = new AdminUserChangesService(
      { $transaction: transaction } as unknown as PrismaService,
      { record } as unknown as AuditService,
    );
  });

  describe('changeRole', () => {
    it('changes the role and writes the audit event with the same transaction', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID), regularUser(TARGET_ID)]);
      update.mockResolvedValue(updatedUser());

      await expect(service.changeRole(ACTOR_ID, TARGET_ID, 'ADMIN')).resolves.toEqual(
        updatedUser(),
      );

      expect(update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { role: 'ADMIN' },
        select: ADMIN_USER_SELECT,
      });
      expect(record).toHaveBeenCalledWith(tx, {
        actorUserId: ACTOR_ID,
        action: AuditAction.ROLE_CHANGED,
        resourceType: AuditResourceType.USER,
        resourceId: TARGET_ID,
        metadata: { from: 'USER', to: 'ADMIN' },
      });
    });

    it('can demote another administrator while the actor remains', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID), admin(TARGET_ID)]);
      update.mockResolvedValue({ ...updatedUser(), role: 'USER' });

      await expect(service.changeRole(ACTOR_ID, TARGET_ID, 'USER')).resolves.toMatchObject({
        role: 'USER',
      });
      expect(record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ metadata: { from: 'ADMIN', to: 'USER' } }),
      );
    });

    it('refuses that an administrator changes their own role, without opening a transaction', async () => {
      await expect(service.changeRole(ACTOR_ID, ACTOR_ID, 'USER')).rejects.toThrow(
        new ForbiddenException('Administrators cannot change their own role'),
      );

      expect(transaction).not.toHaveBeenCalled();
    });

    it('locks the rows it depends on before reading them', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID), regularUser(TARGET_ID)]);
      update.mockResolvedValue(updatedUser());

      await service.changeRole(ACTOR_ID, TARGET_ID, 'ADMIN');

      expect(queryRaw).toHaveBeenCalledTimes(1);
      const sql = (queryRaw.mock.calls[0][0] as string[]).join('?');
      expect(sql).toContain('FOR UPDATE');
      expect(queryRaw.mock.calls[0][1]).toBe(TARGET_ID);
    });

    it('refuses an actor who is no longer an active administrator', async () => {
      queryRaw.mockResolvedValue([admin('someone-else'), regularUser(TARGET_ID)]);

      await expect(service.changeRole(ACTOR_ID, TARGET_ID, 'ADMIN')).rejects.toThrow(
        new ForbiddenException('Insufficient permissions'),
      );

      expect(update).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });

    it('answers 404 for a user that does not exist', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID)]);

      await expect(service.changeRole(ACTOR_ID, TARGET_ID, 'ADMIN')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });

    it('answers 409 when the user already has the role, and writes nothing', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID), regularUser(TARGET_ID)]);

      await expect(service.changeRole(ACTOR_ID, TARGET_ID, 'USER')).rejects.toThrow(
        new ConflictException('The user already has this role'),
      );

      expect(update).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });

    it('lets an audit failure through, so that the transaction is rolled back', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID), regularUser(TARGET_ID)]);
      update.mockResolvedValue(updatedUser());
      record.mockRejectedValue(new Error('audit unavailable'));

      await expect(service.changeRole(ACTOR_ID, TARGET_ID, 'ADMIN')).rejects.toThrow(
        'audit unavailable',
      );
    });
  });

  describe('changeStatus', () => {
    it('suspends an account and records USER_SUSPENDED', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID), regularUser(TARGET_ID)]);
      update.mockResolvedValue({ ...updatedUser(), role: 'USER', accountStatus: 'SUSPENDED' });

      await service.changeStatus(ACTOR_ID, TARGET_ID, 'SUSPENDED');

      expect(update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { accountStatus: 'SUSPENDED' },
        select: ADMIN_USER_SELECT,
      });
      expect(record).toHaveBeenCalledWith(tx, {
        actorUserId: ACTOR_ID,
        action: AuditAction.USER_SUSPENDED,
        resourceType: AuditResourceType.USER,
        resourceId: TARGET_ID,
        metadata: { from: 'ACTIVE', to: 'SUSPENDED' },
      });
    });

    it('reactivates an account and records USER_REACTIVATED', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID), regularUser(TARGET_ID, 'SUSPENDED')]);
      update.mockResolvedValue(updatedUser());

      await service.changeStatus(ACTOR_ID, TARGET_ID, 'ACTIVE');

      expect(record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: AuditAction.USER_REACTIVATED,
          metadata: { from: 'SUSPENDED', to: 'ACTIVE' },
        }),
      );
    });

    it('can suspend another administrator while the actor remains', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID), admin(TARGET_ID)]);
      update.mockResolvedValue(updatedUser());

      await expect(service.changeStatus(ACTOR_ID, TARGET_ID, 'SUSPENDED')).resolves.toBeDefined();
    });

    it('refuses that an administrator changes their own account status', async () => {
      await expect(service.changeStatus(ACTOR_ID, ACTOR_ID, 'SUSPENDED')).rejects.toThrow(
        new ForbiddenException('Administrators cannot change their own account status'),
      );

      expect(transaction).not.toHaveBeenCalled();
    });

    it('refuses an actor who is no longer an active administrator', async () => {
      queryRaw.mockResolvedValue([regularUser(TARGET_ID)]);

      await expect(service.changeStatus(ACTOR_ID, TARGET_ID, 'SUSPENDED')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(record).not.toHaveBeenCalled();
    });

    it('answers 409 when the account already has the status, and writes nothing', async () => {
      queryRaw.mockResolvedValue([admin(ACTOR_ID), regularUser(TARGET_ID)]);

      await expect(service.changeStatus(ACTOR_ID, TARGET_ID, 'ACTIVE')).rejects.toThrow(
        new ConflictException('The account already has this status'),
      );

      expect(update).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });
  });
});
