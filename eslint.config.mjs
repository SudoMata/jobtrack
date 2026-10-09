// ESLint is configured once, at the repository root (TECHNICAL_SPEC.md, section 7).
// `@typescript-eslint/no-explicit-any` is an error in the recommended preset:
// any use of `any` must be justified with an explicit disable comment.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
];
