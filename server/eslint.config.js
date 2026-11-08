const globals = require('globals');

module.exports = [
    {
        ignores: ['node_modules/**', 'dist/**'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
            'no-undef': 'error',
            'no-constant-condition': 'warn',
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },
];
