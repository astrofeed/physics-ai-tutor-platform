export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  thinking?: string;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  folderId: string | null;
}

export interface ConversationFolder {
  id: string;
  name: string;
}
