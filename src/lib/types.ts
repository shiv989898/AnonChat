import type { Timestamp } from "firebase/firestore";

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'partner' | 'system' | string;
  timestamp: string | Date | Timestamp;
}

export type PartnerType = "ai" | "human";

export type ChatSession = {
    id: string;
    user1Id: string;
    user2Id: string | null;
    startTime: Timestamp;
    endTime: Timestamp | null;
    status: 'waiting' | 'active' | 'guessing' | 'finished';
    partnerType: PartnerType;
    messages: Message[];
    user1Guess?: PartnerType;
    user2Guess?: PartnerType;
};
