import { fieldError } from '../common/validation/field-error';

/**
 * The follow-up date cannot be before the application date.
 * Both are calendar dates (`YYYY-MM-DD`), which compare correctly as texts.
 * A missing follow-up date is always fine.
 */
export function assertFollowUpNotBeforeApplication(
  appliedAt: string,
  nextFollowUpAt: string | null | undefined,
): void {
  if (nextFollowUpAt && nextFollowUpAt < appliedAt) {
    throw fieldError('nextFollowUpAt', 'nextFollowUpAt must not be before appliedAt');
  }
}
