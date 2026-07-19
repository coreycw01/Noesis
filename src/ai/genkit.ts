import 'server-only';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.GOOGLE_GENAI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || '';
}

export const ai = genkit({
  plugins: [googleAI({apiKey: getGeminiApiKey() || undefined})],
  model: 'googleai/gemini-2.5-flash',
});
