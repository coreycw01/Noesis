import 'server-only';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const GEMINI_KEY_ENV_NAMES = [
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'GENAI_API_KEY',
] as const;

export function getGeminiApiKey() {
  for (const name of GEMINI_KEY_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim()
    || process.env.GOOGLE_GENAI_MODEL?.trim()
    || 'googleai/gemini-2.5-flash';
}

export const ai = genkit({
  plugins: [googleAI({apiKey: getGeminiApiKey() || undefined})],
  model: getGeminiModel(),
});
