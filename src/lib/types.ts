export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'partner';
  timestamp: string;
}
