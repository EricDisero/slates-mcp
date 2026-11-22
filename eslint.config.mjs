import parser from '@typescript-eslint/parser';

const source = '**/*.{js,mjs,cjs,ts,mts,cts}';

export default [
  {
    ignores: [
      'packages/*/dist/**',
      'packages/mcp/dist-mcpb/**',
      'dist-*/**',
      'packages/shared/src/prompts/partials.generated.ts',
      'packages/shared/src/skills/content.ts',
      'packages/shared/src/skills/hyperframes-content.ts',
    ],
  },
  {
    files: ['{packages/*/{src,scripts},scripts}/**/*.{ts,mts,cts}'],
    languageOptions: { parser },
  },
  {
    files: [`packages/*/src/${source}`, `packages/*/scripts/${source}`, `scripts/${source}`],
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-constant-binary-expression': 'error',
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-sparse-arrays': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
    },
  },
];
