import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { orNotFound } from './or-not-found';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('failure', { code, clientVersion: 'test' });
}

describe('orNotFound', () => {
  it('returns the value when the operation succeeds', async () => {
    await expect(orNotFound(Promise.resolve('found'), 'Company')).resolves.toBe('found');
  });

  it('turns "record not found" into a 404 that names the resource', async () => {
    const operation = Promise.reject(prismaError('P2025'));

    const error: unknown = await orNotFound(operation, 'Company').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).message).toBe('Company not found');
  });

  it('lets any other Prisma error through', async () => {
    const operation = Promise.reject(prismaError('P2003'));

    await expect(orNotFound(operation, 'Company')).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it('lets any other error through', async () => {
    const operation = Promise.reject(new Error('connection lost'));

    await expect(orNotFound(operation, 'Company')).rejects.toThrow('connection lost');
  });
});
