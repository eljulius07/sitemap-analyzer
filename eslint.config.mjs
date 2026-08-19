import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['out/**', 'release/**', 'dist/**', 'node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // Mirrors the tsconfig `noUnusedLocals` / `noUnusedParameters` intent.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      // Crawl/IPC code is full of detached async work — an unhandled rejection
      // in the main process kills the window silently.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowTypedFunctionExpressions: true }
      ],
      // The app ships with no telemetry; stray logging is a bug, not a feature.
      'no-console': 'error',
      eqeqeq: ['error', 'smart']
    }
  },

  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules
  },

  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/test/**/*.ts'],
    languageOptions: { globals: globals.node }
  },

  {
    files: ['*.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node }
  },

  {
    files: ['src/**/*.test.ts'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' }
  }
)
