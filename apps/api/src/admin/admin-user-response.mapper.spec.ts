import type { AdminUser } from './admin-user.select';
import { toAdminUserResponse } from './admin-user-response.mapper';

describe('toAdminUserResponse', () => {
  it('returns the account metadata and nothing else', () => {
    const user = {
      id: '4d6e2a10-8b3f-4c71-9e25-1a2b3c4d5e01',
      email: 'ada@example.com',
      displayName: null,
      role: 'USER',
      accountStatus: 'ACTIVE',
      createdAt: new Date('2026-10-01T08:00:00.000Z'),
      updatedAt: new Date('2026-10-02T08:00:00.000Z'),
      somethingInternal: 'must not leave',
    } as AdminUser;

    const response = toAdminUserResponse(user);

    expect(Object.keys(response).sort()).toEqual([
      'accountStatus',
      'createdAt',
      'displayName',
      'email',
      'id',
      'role',
      'updatedAt',
    ]);
    expect(response.displayName).toBeNull();
  });
});
