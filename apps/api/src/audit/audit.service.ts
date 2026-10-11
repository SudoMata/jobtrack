import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { AuditEntry } from './audit-entry';

@Injectable()
export class AuditService {
  /**
   * Records an audit event.
   *
   * It must be called with the transaction client of the action it describes, so that
   * the action and its trace are saved together or not at all. A failure is never
   * swallowed: it propagates and rolls the whole transaction back.
   */
  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata,
      },
    });
  }
}
