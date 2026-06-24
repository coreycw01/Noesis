'use server';
/**
 * @fileOverview A Genkit flow that acts as a media metadata locator.
 * It uses AI to "search" for accurate details about books, videos, movies, 
 * articles, and other media types based on a user query.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const LocateMediaMetadataInputSchema = z.object({
  query: z.string().describe('The search query (title, author, ISBN, etc.)'),
  mediaType: z.enum([
    'book', 'audiobook', 'podcast', 'video', 'movie', 'article', 
    'course', 'lecture', 'documentary', 'interview', 'conversation', 'paper', 'other'
  ]).describe('The type of media to search for.'),
});

export type LocateMediaMetadataInput = z.infer<typeof LocateMediaMetadataInputSchema>;

const MediaMetadataSchema = z.object({
  title: z.string().describe('The primary title of the media.'),
  creator: z.string().describe('The primary creator (author, host, director, speaker).'),
  year: z.string().optional().describe('Year of publication or release.'),
  genre: z.string().optional().describe('Genre or primary topic.'),
  publisher: z.string().optional().describe('Publisher, platform, or institution.'),
  description: z.string().optional().describe('A concise 1-2 sentence description of the content or thesis.'),
  thumbnailUrl: z.string().optional().describe('A high-quality placeholder image URL related to this media (e.g. Unsplash or placeholder service).'),
  identifiers: z.object({
    id1: z.string().optional().describe('Primary identifier (ISBN, DOI, URL).'),
    id2: z.string().optional().describe('Secondary identifier (LCCN, ISSN, Alt URL).'),
  }).optional(),
});

const LocateMediaMetadataOutputSchema = z.object({
  results: z.array(MediaMetadataSchema).describe('A list of matched media items.'),
});

export type LocateMediaMetadataOutput = z.infer<typeof LocateMediaMetadataOutputSchema>;

const locateMediaPrompt = ai.definePrompt({
  name: 'locateMediaPrompt',
  input: { schema: LocateMediaMetadataInputSchema },
  output: { schema: LocateMediaMetadataOutputSchema },
  prompt: `You are a Media Librarian AI specialized in identifying scholarly and cultural sources.
Your goal is to provide accurate, high-fidelity metadata for the following search query.

Query: "{{{query}}}"
Target Type: {{{mediaType}}}

Instructions:
1. Identify the most likely matches for this query within the specified media category.
2. For Books/Audiobooks: Use data consistent with WorldCat, Library of Congress, or Google Books.
3. For Videos/Podcasts: Use data consistent with YouTube, Spotify, or platform-specific metadata.
4. For Movies/Documentaries: Use data consistent with IMDb or TMDB.
5. For Papers/Articles: Use data consistent with CrossRef, PubMed, or Google Scholar.
6. Provide a 'thumbnailUrl' that is a high-quality placeholder if a specific one isn't known, e.g., using Unsplash search terms.
7. Return up to 3 results, ordered by relevance.

Ensure the "creator" field matches the terminology of the type:
- Book: Author
- Movie: Director
- Podcast: Host
- Course: Instructor
- Conversation: Participants
- Paper: Authors
`,
});

export async function locateMediaMetadata(input: LocateMediaMetadataInput): Promise<LocateMediaMetadataOutput> {
  const { output } = await locateMediaPrompt(input);
  if (!output) throw new Error('Failed to locate media metadata.');
  return output;
}
