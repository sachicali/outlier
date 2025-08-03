module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  ignorePatterns: [
    'node_modules/',
    'client/',  // Client has its own ESLint config
    'server/node_modules/',
    'coverage/',
    'dist/',
    'build/',
    '*.config.js',
    'test/setup.js',
    'server/logs/',
    'memory-bank/',
    '.github/',
  ],
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    'comma-dangle': ['error', 'always-multiline'],
    'no-trailing-spaces': 'error',
    'indent': ['error', 2],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
  },
  overrides: [
    {
      files: ['server/**/*.js'],
      rules: {
        'no-console': 'off', // Allow console in server code
      },
    },
    {
      files: ['test/**/*.js', 'scripts/**/*.js'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};