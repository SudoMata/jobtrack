import { Prisma } from '../../generated/prisma/client';
import { hasPrismaErrorCode, PrismaErrorCode } from './prisma-errors';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('failure', { code, clientVersion: 'test' });
}

describe('hasPrismaErrorCode', () => {
  it('recognizes a Prisma error with the expected code', () => {
    expect(hasPrismaErrorCode(prismaError('P2002'), PrismaErrorCode.UniqueViolation)).toBe(true);
  });

  it('rejects a Prisma error with another code', () => {
    expect(hasPrismaErrorCode(prismaError('P2003'), PrismaErrorCode.UniqueViolation)).toBe(false);
  });

  it('rejects an ordinary error', () => {
    expect(hasPrismaErrorCode(new Error('P2002'), PrismaErrorCode.UniqueViolation)).toBe(false);
  });

  it('rejects values that are not errors', () => {
    expect(hasPrismaErrorCode('P2002', PrismaErrorCode.UniqueViolation)).toBe(false);
    expect(hasPrismaErrorCode(undefined, PrismaErrorCode.UniqueViolation)).toBe(false);
  });
});
