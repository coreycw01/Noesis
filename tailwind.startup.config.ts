import type { Config } from 'tailwindcss';
import workspaceConfig from './tailwind.config';

export default {
  ...workspaceConfig,
  content: [
    './src/app/{loading,error,global-error}.tsx',
    './src/app/(workspace)/noesis-persistent-workspace.tsx',
  ],
} satisfies Config;
