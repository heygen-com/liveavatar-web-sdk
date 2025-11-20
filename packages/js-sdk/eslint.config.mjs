import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
import globals from 'globals';

const tsEslintConfig = tsEslint.config(
  eslint.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { project: './tsconfig.json' },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],

      // TODO: Enable this rule
      '@typescript-eslint/no-explicit-any': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'] },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'class', format: ['PascalCase'] },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
    }
  }
);

export default [
  {
    ignores: [
      'docs/**',
      'docs_html/**',
      'lib/**',
      'dist/**',
      'node_modules/**',
      'eslint.config.mjs',
      'rollup.config.js',
      'vitest.config.js',
    ],
  },
  ...[].concat(tsEslintConfig),
  {
    files: [
      '**/*.test.ts',
      'src/test/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'no-unused-expressions': 'off',
      'prefer-const': 'warn',
      'prefer-template': 'warn',
    },
  },
];
