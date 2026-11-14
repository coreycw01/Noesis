import type { Config } from 'tailwindcss';
import workspaceConfig from './tailwind.config';

export default {
  ...workspaceConfig,
  content: [
    './src/app/{layout,loading,error,global-error}.tsx',
    './src/app/{p,privacy,terms,account-deletion}/**/*.tsx',
    './src/components/LegalPage.tsx',
    './src/components/ui/badge.tsx',
  ],
} satisfies Config;
