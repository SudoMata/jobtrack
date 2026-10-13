import { NotFoundException } from '@nestjs/common';
import { hasPrismaErrorCode, PrismaErrorCode } from './prisma-errors';

/**
 * The ownership helper (TECHNICAL_SPEC.md, section 31).
 *
 * Every query on an owned resource filters by the owner (`where: { id, userId }`).
 * When nothing matches, Prisma reports "record not found": this turns it into the
 * same 404 whether the resource does not exist or belongs to someone else,
 * so that identifiers cannot be probed.
 */
export async function orNotFound<T>(operation: Promise<T>, resource: string): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (hasPrismaErrorCode(error, PrismaErrorCode.RecordNotFound)) {
      throw new NotFoundException(`${resource} not found`);
    }
    throw error;
  }
}
