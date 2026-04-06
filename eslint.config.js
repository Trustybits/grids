import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  // Ignore build output, deps, and generated files
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'functions/node_modules/**',
      'functions/lib/**',
      'coverage/**',
      '*.d.ts',
      'public/**',
    ],
  },

  // Vue 3 essential rules
  ...pluginVue.configs['flat/essential'],

  // TypeScript recommended rules
  vueTsConfigs.recommended,

  // Project-specific overrides
  {
    rules: {
      // ── TypeScript ──────────────────────────────────────────────────
      // Warn on `any` but don't block — the codebase has some intentional
      // anys that will be cleaned up incrementally
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow unused vars that start with _ (common for intentional ignores)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Allow non-null assertions — Firebase sometimes requires them
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // ── Vue ─────────────────────────────────────────────────────────
      // Enforce component name casing
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],

      // Prevent v-html XSS vectors
      'vue/no-v-html': 'error',

      // Require explicit emits declarations
      'vue/require-explicit-emits': 'error',

      // Enforce <script setup> macro order
      'vue/define-macros-order': [
        'error',
        { order: ['defineProps', 'defineEmits', 'defineOptions'] },
      ],

      // ── General ─────────────────────────────────────────────────────
      // Prefer const over let where possible
      'prefer-const': 'error',

      // No console.log in production code (use the toast store instead)
      // Warn rather than error so existing logs don't block CI immediately
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Catch common async mistakes
      'no-return-await': 'error',
    },
  },

  // Relax rules for test files — mocks and test helpers have different needs
  {
    files: ['src/**/__tests__/**/*.ts', 'src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },
)
