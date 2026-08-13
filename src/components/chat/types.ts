/** A PDF / Markdown / plain-text file attached to a message. */
export interface DocumentAttachment {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  documents?: DocumentAttachment[];
  thinking?: string;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}
