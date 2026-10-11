import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['out/**', 'out-test/**', '.vscode-test/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { __dirname: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-undef': 'error' },
  },
);
