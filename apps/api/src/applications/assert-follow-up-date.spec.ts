import { BadRequestException } from '@nestjs/common';
import { assertFollowUpNotBeforeApplication } from './assert-follow-up-date';

describe('assertFollowUpNotBeforeApplication', () => {
  it('accepts a follow-up on the application date or after it', () => {
    expect(() => assertFollowUpNotBeforeApplication('2026-10-10', '2026-10-10')).not.toThrow();
    expect(() => assertFollowUpNotBeforeApplication('2026-10-10', '2026-11-01')).not.toThrow();
  });

  it('accepts a missing follow-up date', () => {
    expect(() => assertFollowUpNotBeforeApplication('2026-10-10', undefined)).not.toThrow();
    expect(() => assertFollowUpNotBeforeApplication('2026-10-10', null)).not.toThrow();
  });

  it('rejects a follow-up before the application date, on the nextFollowUpAt field', () => {
    let error: unknown;
    try {
      assertFollowUpNotBeforeApplication('2026-10-10', '2026-10-09');
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      errors: { nextFollowUpAt: ['nextFollowUpAt must not be before appliedAt'] },
    });
  });
});
