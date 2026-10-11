import type { Prisma } from '../generated/prisma/client';
import { AuditAction, AuditResourceType } from '../generated/prisma/enums';
import { AuditEntry } from './audit-entry';
import { AuditService } from './audit.service';

const ACTOR_ID = '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60';
const TARGET_ID = '9a1d7e52-2c3b-4f08-8e6a-0d5b7c4a1e93';

const ENTRY: AuditEntry = {
  actorUserId: ACTOR_ID,
  action: AuditAction.ROLE_CHANGED,
  resourceType: AuditResourceType.USER,
  resourceId: TARGET_ID,
  metadata: { from: 'USER', to: 'ADMIN' },
};

describe('AuditService', () => {
  const create = jest.fn();
  const tx = { auditLog: { create } } as unknown as Prisma.TransactionClient;
  const service = new AuditService();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('writes the event with the transaction client it is given', async () => {
    create.mockResolvedValue({});

    await service.record(tx, ENTRY);

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: ACTOR_ID,
        action: AuditAction.ROLE_CHANGED,
        resourceType: AuditResourceType.USER,
        resourceId: TARGET_ID,
        metadata: { from: 'USER', to: 'ADMIN' },
      },
    });
  });

  it('lets a failure propagate so that the surrounding transaction is rolled back', async () => {
    create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.record(tx, ENTRY)).rejects.toThrow('database unavailable');
  });
});
