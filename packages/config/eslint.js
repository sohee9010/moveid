// MoveID 공통 ESLint 설정 (flat config).
// 루트 eslint.config.js 에서 한 번에 전체 모노레포를 검사한다.
import path from 'node:path';

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/dist_keycloak/',
    '**/coverage/',
    '**/storybook-static/',
    'playwright-report/',
    'test-results/',
  ]),

  js.configs.recommended,

  // 타입 정보를 쓰는 규칙: 처리하지 않은 Promise(no-floating-promises) 등
  // React Query·OIDC 처럼 비동기가 많은 코드에서 실수를 잡아 준다.
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', 'packages/config/*.js'],
        },
        tsconfigRootDir: path.resolve(import.meta.dirname, '../..'),
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // React 앱 코드
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // 서식은 Prettier 가 담당하므로 충돌하는 규칙을 끈다 (항상 마지막).
  prettier,
);
