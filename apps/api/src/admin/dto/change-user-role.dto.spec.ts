import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ChangeUserRoleDto } from './change-user-role.dto';

describe('ChangeUserRoleDto', () => {
  const pipe = createValidationPipe();

  function parse(body: Record<string, unknown>): Promise<ChangeUserRoleDto> {
    return pipe.transform(body, {
      type: 'body',
      metatype: ChangeUserRoleDto,
    }) as Promise<ChangeUserRoleDto>;
  }

  it.each(['USER', 'ADMIN'])('accepts the role %s', async (role) => {
    await expect(parse({ role })).resolves.toMatchObject({ role });
  });

  it.each([
    {},
    { role: 'SUPERUSER' },
    { role: 'admin' },
    { role: null },
    { role: 'USER', id: 'x' },
  ])('rejects %j', async (body) => {
    await expect(parse(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
