import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Exclude build output, packaged Electron output, the live-build chroot
  // (vendors a full node_modules + chroot with self-referential symlinks),
  // and the server NestJS package (it has its own lint config).
  globalIgnores([
    'dist',
    'dist2',
    'server/dist',
    'server',
    'electron/.staging',
    'electron/server-bundle',
    'electron/dist',
    'live-build',
    'release',
    'node_modules',
    'usb-launcher',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: { 'unused-imports': unusedImports },
    rules: {
      // The unused-imports plugin auto-removes truly unused imports on
      // `eslint --fix`, which the base TS rule can't do. We delegate
      // import-checking to it and keep the TS rule for variable-level
      // checks under the standard underscore-prefix convention.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['warn', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Deliberate `any` is sometimes the right answer (third-party API
      // responses, ambient OS-shim types). Surface as a warning so it's
      // visible but doesn't block the build.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Fast-refresh export-only hints don't affect production builds;
      // downgrade so structural app files (which legitimately export
      // helpers alongside components) don't fail the lint.
      'react-refresh/only-export-components': 'warn',
      // React 19's set-state-in-effect rule fires on legitimate
      // load-on-mount patterns; downgrade pending a per-site review.
      'react-hooks/set-state-in-effect': 'warn',
      // React 19 strict purity rules fire on Date.now() / Math.random()
      // in render and on prop mutations. Real concerns but limited to
      // a couple of legacy hotel-display components; downgrade so lint
      // passes while those get rewritten.
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/purity': 'off',
    },
  },
])
