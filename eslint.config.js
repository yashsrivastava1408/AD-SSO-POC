import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },

  js.configs.recommended,

  // Node-side code: servers, idp-core, the shared package, config files.
  {
    files: [
      'packages/*/server/**/*.js',
      'packages/idp-core/src/**/*.js',
      'packages/shared/src/**/*.js',
      '**/*.config.js',
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // React frontends.
  {
    files: ['packages/dashboard/src/**/*.{js,jsx}', 'packages/demo-storefront/src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: { react: { version: 'detect' } },
  },

  // Tests run under vitest, in either a node or jsdom environment. .jsx tests
  // reference components only inside JSX, so they need react's jsx-uses-vars
  // rule or eslint sees the import as unused.
  {
    files: ['**/test/**/*.{js,jsx}', '**/*.test.{js,jsx}', '**/vitest.setup.js'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'react/jsx-uses-vars': 'error',
    },
  },

  prettier,
];
