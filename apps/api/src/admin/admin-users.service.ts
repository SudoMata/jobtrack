import { Injectable } from '@nestjs/common';
import { orNotFound } from '../common/errors/or-not-found';
import { buildPaginated, Paginated } from '../common/pagination/paginated-response';
import { toSkipTake } from '../common/pagination/to-skip-take';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_USER_SELECT, AdminUser } from './admin-user.select';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';

/**
 * The user management an administrator can do: find an account and read its metadata.
 * Only the columns of ADMIN_USER_SELECT are ever read, and no relation is loaded:
 * the companies and the applications of a user are out of reach (TECHNICAL_SPEC.md, section 17).
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListAdminUsersQueryDto): Promise<Paginated<AdminUser>> {
    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // The page and the total are read in one transaction, so they describe the same data.
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: ADMIN_USER_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginated(users, total, query.page, query.limit);
  }

  findOne(id: string): Promise<AdminUser> {
    return orNotFound(
      this.prisma.user.findUniqueOrThrow({ where: { id }, select: ADMIN_USER_SELECT }),
      'User',
    );
  }
}
