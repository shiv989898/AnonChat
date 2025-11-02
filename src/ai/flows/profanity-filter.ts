'use server';

/**
 * @fileOverview A profanity filter AI agent.
 *
 * - filterProfanity - A function that filters profanity from text.
 * - FilterProfanityInput - The input type for the filterProfanity function.
 * - FilterProfanityOutput - The return type for the filterProfanity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FilterProfanityInputSchema = z.object({
  text: z.string().describe('The text to filter for profanity.'),
});
export type FilterProfanityInput = z.infer<typeof FilterProfanityInputSchema>;

const FilterProfanityOutputSchema = z.object({
  filteredText: z.string().describe('The text with profanity filtered out.'),
  profanityDetected: z
    .boolean()
    .describe('Whether or not profanity was detected.'),
});
export type FilterProfanityOutput = z.infer<typeof FilterProfanityOutputSchema>;

export async function filterProfanity(input: FilterProfanityInput): Promise<FilterProfanityOutput> {
  return filterProfanityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'filterProfanityPrompt',
  input: {schema: FilterProfanityInputSchema},
  output: {schema: FilterProfanityOutputSchema},
  prompt: `You are a profanity filter that replaces common swear words with asterisks.

  You will receive text as input, and return the text with profanity filtered out.
  If profanity is detected, set the profanityDetected output field to true, otherwise set it to false.

  Input text: {{{text}}}`,
});

const filterProfanityFlow = ai.defineFlow(
  {
    name: 'filterProfanityFlow',
    inputSchema: FilterProfanityInputSchema,
    outputSchema: FilterProfanityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
