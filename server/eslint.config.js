import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Express error middleware must keep its 4-arg signature; `_`-prefixed
      // params and caught errors are intentionally unused.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Supabase rows are untyped at the boundary; `any` is used deliberately there.
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Sequential awaits are intentional in a few places (rate-limited bulk
      // operations); those sites carry an explicit disable comment.
      'no-await-in-loop': 'warn',
    },
  },
);
