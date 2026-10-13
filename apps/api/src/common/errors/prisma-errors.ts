import { Prisma } from '../../generated/prisma/client';

/** The Prisma error codes the application reacts to. */
export const PrismaErrorCode = {
  UniqueViolation: 'P2002',
  ForeignKeyViolation: 'P2003',
  RecordNotFound: 'P2025',
} as const;

export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
