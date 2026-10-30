import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ADMIN_USER_SELECT, AdminUser } from './admin-user.select';
import { AdminUsersService } from './admin-users.service';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';

const USER_ID = '4d6e2a10-8b3f-4c71-9e25-1a2b3c4d5e01';

function buildUser(): AdminUser {
  return {
    id: USER_ID,
    email: 'ada@example.com',
    displayName: 'Ada Lovelace',
    role: 'USER',
    accountStatus: 'ACTIVE',
    createdAt: new Date('2026-10-01T08:00:00.000Z'),
    updatedAt: new Date('2026-10-01T08:00:00.000Z'),
  };
}

function listQuery(fields: Partial<ListAdminUsersQueryDto> = {}): ListAdminUsersQueryDto {
  return Object.assign(new ListAdminUsersQueryDto(), fields);
}

describe('AdminUsersService', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const transaction = jest.fn();
  let service: AdminUsersService;

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation((queries: unknown[]) => Promise.all(queries));
    service = new AdminUsersService({
      user: { findMany, count, findUniqueOrThrow },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('lists every account, newest first, one page at a time, reading only the metadata', async () => {
      const user = buildUser();
      findMany.mockResolvedValue([user]);
      count.mockResolvedValue(1);

      const result = await service.findAll(listQuery());

      expect(findMany).toHaveBeenCalledWith({
        where: {},
        select: ADMIN_USER_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 20,
      });
      expect(count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        data: [user],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('searches the email or the display name, ignoring the case, for the page and the total', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);

      await service.findAll(listQuery({ search: 'ada' }));

      const where = {
        OR: [
          { email: { contains: 'ada', mode: 'insensitive' } },
          { displayName: { contains: 'ada', mode: 'insensitive' } },
        ],
      };
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
      expect(count).toHaveBeenCalledWith({ where });
    });

    it('ignores a blank search', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);

      await service.findAll(listQuery({ search: '' }));

      expect(count).toHaveBeenCalledWith({ where: {} });
    });

    it('skips the previous pages', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(100);

      await service.findAll(listQuery({ page: 3, limit: 10 }));

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('only reads account metadata and never loads a relation', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);

      await service.findAll(listQuery());

      expect(Object.keys(ADMIN_USER_SELECT).sort()).toEqual([
        'accountStatus',
        'createdAt',
        'displayName',
        'email',
        'id',
        'role',
        'updatedAt',
      ]);
      expect(findMany.mock.calls[0][0]).not.toHaveProperty('include');
    });
  });

  describe('findOne', () => {
    it('reads the account metadata of the user', async () => {
      const user = buildUser();
      findUniqueOrThrow.mockResolvedValue(user);

      await expect(service.findOne(USER_ID)).resolves.toBe(user);

      expect(findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: USER_ID },
        select: ADMIN_USER_SELECT,
      });
    });

    it('answers 404 for a user that does not exist', async () => {
      findUniqueOrThrow.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('failure', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await expect(service.findOne(USER_ID)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });
});
