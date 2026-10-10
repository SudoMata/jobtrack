import { Injectable } from '@nestjs/common';
import { Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the application user for a verified identity, creating it on the first call.
   * The role and the account status always come from the database. A new user is
   * created with the database defaults (USER, ACTIVE): ADMIN is never granted here.
   */
  async findOrCreate(id: string, email: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.user.create({ data: { id, email } });
    } catch (error) {
      // Two first requests can arrive at the same time: the one that loses the race
      // finds the row created by the winner. Any other failure is a real error.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const created = await this.prisma.user.findUnique({ where: { id } });
        if (created) {
          return created;
        }
      }
      throw error;
    }
  }
}
