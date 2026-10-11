import { AuditAction, AuditResourceType } from '../generated/prisma/enums';

/**
 * What an audit event may record about a change: the previous and the new value.
 * Nothing else is stored, in particular no email and no candidate data
 * (TECHNICAL_SPEC.md, section 42).
 */
export type AuditChange = {
  from: string;
  to: string;
};

export interface AuditEntry {
  /** The administrator who performed the action. */
  actorUserId: string;
  action: AuditAction;
  resourceType: AuditResourceType;

  /** Id of the resource the action was performed on. */
  resourceId: string;

  metadata?: AuditChange;
}
