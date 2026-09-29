export type MemoryCategory =
  | "preference"
  | "fact"
  | "instruction"
  | "context"
  | "general";

export interface MemoryItem {
  id: string;
  userId: string;
  content: string;
  category: MemoryCategory;
  tags: string[];
  importance?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
}
