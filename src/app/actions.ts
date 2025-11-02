'use server';

import { filterProfanity } from '@/ai/flows/profanity-filter';
import { getChatResponse } from '@/ai/flows/chat-response-flow';

export async function filterMessageAction(message: string) {
  if (!message.trim()) {
    return { filteredText: '', profanityDetected: false };
  }
  const result = await filterProfanity({ text: message });
  return result;
}

export async function getChatResponseAction(conversationHistory: string) {
    const result = await getChatResponse({ conversationHistory });
    return result.response;
}
