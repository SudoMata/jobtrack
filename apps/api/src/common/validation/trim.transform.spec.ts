import type { TransformFnParams } from 'class-transformer';
import { trim, trimToNull } from './trim.transform';

const params = (value: unknown): TransformFnParams => ({ value }) as TransformFnParams;

describe('trim', () => {
  it('removes the spaces around a text', () => {
    expect(trim(params('  Acme  '))).toBe('Acme');
  });

  it('leaves anything that is not a text untouched', () => {
    expect(trim(params(undefined))).toBeUndefined();
    expect(trim(params(null))).toBeNull();
    expect(trim(params(42))).toBe(42);
  });
});

describe('trimToNull', () => {
  it('removes the spaces around a text', () => {
    expect(trimToNull(params('  https://acme.com '))).toBe('https://acme.com');
  });

  it('turns a blank text into null', () => {
    expect(trimToNull(params(''))).toBeNull();
    expect(trimToNull(params('   '))).toBeNull();
  });

  it('leaves anything that is not a text untouched', () => {
    expect(trimToNull(params(undefined))).toBeUndefined();
    expect(trimToNull(params(null))).toBeNull();
  });
});
