import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';
import { createValidationPipe } from './create-validation-pipe';

class SampleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  position!: string;
}

class ChildDto {
  @IsString()
  name!: string;
}

class ParentDto {
  @ValidateNested()
  @Type(() => ChildDto)
  child!: ChildDto;
}

describe('createValidationPipe', () => {
  const pipe = createValidationPipe();

  async function failureOf(value: unknown, metatype: new () => object): Promise<unknown> {
    const error: unknown = await pipe
      .transform(value, { type: 'body', metatype })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse();
  }

  it('accepts a valid payload and returns a DTO instance', async () => {
    await expect(
      pipe.transform({ position: 'Developer' }, { type: 'body', metatype: SampleDto }),
    ).resolves.toBeInstanceOf(SampleDto);
  });

  it('reports an invalid field in the documented error shape', async () => {
    await expect(failureOf({ position: '' }, SampleDto)).resolves.toEqual({
      message: 'Validation failed',
      errors: { position: ['position should not be empty'] },
    });
  });

  it('rejects properties that are not part of the DTO', async () => {
    await expect(failureOf({ position: 'Developer', status: 'OFFER' }, SampleDto)).resolves.toEqual(
      {
        message: 'Validation failed',
        errors: { status: ['property status should not exist'] },
      },
    );
  });

  it('reports nested errors with their full path', async () => {
    await expect(failureOf({ child: { name: 42 } }, ParentDto)).resolves.toEqual({
      message: 'Validation failed',
      errors: { 'child.name': ['name must be a string'] },
    });
  });
});
