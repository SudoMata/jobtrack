import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { CreateCompanyDto } from './create-company.dto';

describe('CreateCompanyDto', () => {
  const pipe = createValidationPipe();

  function parse(body: Record<string, unknown>): Promise<CreateCompanyDto> {
    return pipe.transform(body, {
      type: 'body',
      metatype: CreateCompanyDto,
    }) as Promise<CreateCompanyDto>;
  }

  async function failedFields(body: Record<string, unknown>): Promise<string[]> {
    const error: unknown = await parse(body).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as {
      errors: Record<string, string[]>;
    };
    return Object.keys(response.errors);
  }

  it('accepts a name alone', async () => {
    await expect(parse({ name: 'Acme' })).resolves.toMatchObject({ name: 'Acme' });
  });

  it('accepts a website and a location', async () => {
    await expect(
      parse({ name: 'Acme', website: 'https://acme.com', location: 'Kinshasa' }),
    ).resolves.toMatchObject({ website: 'https://acme.com', location: 'Kinshasa' });
  });

  it('trims the name', async () => {
    await expect(parse({ name: '  Acme  ' })).resolves.toMatchObject({ name: 'Acme' });
  });

  it('turns a blank website and a blank location into null', async () => {
    await expect(parse({ name: 'Acme', website: '   ', location: '' })).resolves.toMatchObject({
      website: null,
      location: null,
    });
  });

  it('rejects a missing name', async () => {
    await expect(failedFields({})).resolves.toContain('name');
  });

  it('rejects a name that is blank once trimmed', async () => {
    await expect(failedFields({ name: '   ' })).resolves.toContain('name');
  });

  it('rejects a name longer than 150 characters', async () => {
    await expect(failedFields({ name: 'a'.repeat(151) })).resolves.toContain('name');
  });

  it.each(['javascript:alert(1)', 'ftp://example.com', 'not a url', 'example.com'])(
    'rejects the website %p',
    async (website) => {
      await expect(failedFields({ name: 'Acme', website })).resolves.toContain('website');
    },
  );

  it('rejects a website longer than 2048 characters', async () => {
    const website = `https://example.com/${'a'.repeat(2050)}`;

    await expect(failedFields({ name: 'Acme', website })).resolves.toContain('website');
  });

  it('rejects fields a client must never set', async () => {
    await expect(failedFields({ name: 'Acme', userId: 'someone-else', id: 'x' })).resolves.toEqual(
      expect.arrayContaining(['userId', 'id']),
    );
  });
});