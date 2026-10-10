import { Prisma } from '../generated/prisma/client';
import type { User } from '../generated/prisma/client';
import { AccountStatus, Role } from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const USER_ID = '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60';
const EMAIL = 'candidate@example.com';

function buildUser(): User {
  return {
    id: USER_ID,
    email: EMAIL,
    role: Role.USER,
    accountStatus: AccountStatus.ACTIVE,
    displayName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('UsersService', () => {
  const findUnique = jest.fn();
  const create = jest.fn();
  let service: UsersService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new UsersService({ user: { findUnique, create } } as unknown as PrismaService);
  });

  it('returns the existing user without writing anything', async () => {
    const user = buildUser();
    findUnique.mockResolvedValue(user);

    await expect(service.findOrCreate(USER_ID, EMAIL)).resolves.toBe(user);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a missing user with only the id and the email', async () => {
    const user = buildUser();
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue(user);

    await expect(service.findOrCreate(USER_ID, EMAIL)).resolves.toBe(user);

    // No role and no status are passed: the database defaults apply, so nobody becomes ADMIN here.
    expect(create).toHaveBeenCalledWith({ data: { id: USER_ID, email: EMAIL } });
  });

  it('returns the row created by a concurrent request when the creation loses the race', async () => {
    const user = buildUser();
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(user);
    create.mockRejectedValue(uniqueViolation());

    await expect(service.findOrCreate(USER_ID, EMAIL)).resolves.toBe(user);
  });

  it('rethrows a unique violation that does not come from a concurrent creation', async () => {
    findUnique.mockResolvedValue(null);
    create.mockRejectedValue(uniqueViolation());

    await expect(service.findOrCreate(USER_ID, EMAIL)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it('rethrows any other error', async () => {
    findUnique.mockResolvedValue(null);
    create.mockRejectedValue(new Error('connection lost'));

    await expect(service.findOrCreate(USER_ID, EMAIL)).rejects.toThrow('connection lost');
  });
});
