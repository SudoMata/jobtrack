import { extractBearerToken } from './extract-bearer-token';

describe('extractBearerToken', () => {
  it('returns the token of a Bearer header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('accepts the scheme in any letter case', () => {
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it.each([undefined, '', 'Bearer', 'Bearer ', 'Basic abc', 'Bearer a b', 'abc'])(
    'returns null for %p',
    (header) => {
      expect(extractBearerToken(header)).toBeNull();
    },
  );
});
