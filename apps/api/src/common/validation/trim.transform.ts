import type { TransformFnParams } from 'class-transformer';

/** Removes the spaces around a text. Anything that is not a text is left untouched. */
export function trim({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Same as `trim`, and turns a blank text into null ("no value"). */
export function trimToNull({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Same as `trim`, and converts a text to uppercase (for codes such as currencies). */
export function trimUppercase({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}
