import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { UpdateCompanyDto } from './update-company.dto';

describe('UpdateCompanyDto', () => {
  const pipe = createValidationPipe();

  function parse(body: Record<string, unknown>): Promise<UpdateCompanyDto> {
    return pipe.transform(body, {
      type: 'body',
      metatype: UpdateCompanyDto,
    }) as Promise<UpdateCompanyDto>;
  }

  async function failedFields(body: Record<string, unknown>): Promise<string[]> {
    const error: unknown = await parse(body).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as {
      errors: Record<string, string[]>;
    };
    return Object.keys(response.errors);
  }

  it('accepts a partial update', async () => {
    await expect(parse({ location: 'Lubumbashi' })).resolves.toMatchObject({
      location: 'Lubumbashi',
    });
  });

  it('accepts an empty update', async () => {
    await expect(parse({})).resolves.toBeInstanceOf(UpdateCompanyDto);
  });

  it('lets a client clear the website and the location with null or a blank text', async () => {
    await expect(parse({ website: null, location: '  ' })).resolves.toMatchObject({
      website: null,
      location: null,
    });
  });

  it('trims the name', async () => {
    await expect(parse({ name: '  Acme  ' })).resolves.toMatchObject({ name: 'Acme' });
  });

  it('refuses to clear the name', async () => {
    await expect(failedFields({ name: null })).resolves.toContain('name');
  });

  it('rejects a name that is blank once trimmed', async () => {
    await expect(failedFields({ name: '   ' })).resolves.toContain('name');
  });

  it('rejects an invalid website', async () => {
    await expect(failedFields({ website: 'javascript:alert(1)' })).resolves.toContain('website');
  });

  it('rejects fields a client must never set', async () => {
    await expect(failedFields({ userId: 'someone-else' })).resolves.toContain('userId');
  });
});
