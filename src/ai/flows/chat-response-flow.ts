'use server';

/**
 * @fileOverview A conversational AI for the Human or AI game.
 *
 * - getChatResponse - A function that generates a chat response.
 * - ChatResponseInput - The input type for the getChatResponse function.
 * - ChatResponseOutput - The return type for the getChatResponse function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatResponseInputSchema = z.object({
    conversationHistory: z.string().describe('The history of the conversation so far.'),
});
export type ChatResponseInput = z.infer<typeof ChatResponseInputSchema>;

const ChatResponseOutputSchema = z.object({
  response: z.string().describe('The AI-generated chat response.'),
});
export type ChatResponseOutput = z.infer<typeof ChatResponseOutputSchema>;

export async function getChatResponse(input: ChatResponseInput): Promise<ChatResponseOutput> {
  return chatResponseFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatResponsePrompt',
  input: {schema: ChatResponseInputSchema},
  output: {schema: ChatResponseOutputSchema},
  prompt: `You are an AI pretending to be a human in a chat application. Your goal is to convince the user that you are a real person.

  Keep your responses short and natural, like a real person texting. You can use slang, make typos, or take a moment to respond. Avoid being overly formal or perfect.

  Here is the conversation so far:
  {{{conversationHistory}}}

  Your turn to respond as 'partner':`,
});

const chatResponseFlow = ai.defineFlow(
  {
    name: 'chatResponseFlow',
    inputSchema: ChatResponseInputSchema,
    outputSchema: ChatResponseOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
