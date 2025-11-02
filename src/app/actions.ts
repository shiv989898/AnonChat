'use server';

import { filterProfanity } from '@/ai/flows/profanity-filter';

export async function filterMessageAction(message: string) {
  if (!message.trim()) {
    return { filteredText: '', profanityDetected: false };
  }
  const result = await filterProfanity({ text: message });
  return result;
}
