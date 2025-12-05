import { z } from 'zod';

/**
 * DocumentChunk Model
 * Represents a semantic chunk of a document with embeddings for vector search.
 * Chunks are the atomic unit of retrieval in the RAG pipeline.
 */

export const DocumentChunkSchema = z.object({
  id: z.string().describe('Unique chunk identifier'),
  documentId: z.string().describe('Parent document ID'),
  collectionId: z.string().describe('Parent collection ID'),
  organizationId: z.string().describe('Owner organization ID'),
  subOrganizationId: z.string().optional().describe('Optional sub-org scope'),
  
  // Content
  text: z.string().describe('Chunk text content'),
  embedding: z.array(z.number()).optional().describe('Vector embedding for similarity search'),
  
  // Position in document
  position: z.object({
    index: z.number().describe('Chunk index in document (0-based)'),
    startChar: z.number().optional().describe('Start character position in original document'),
    endChar: z.number().optional().describe('End character position in original document'),
  }),
  
  // Metadata
  metadata: z.record(z.unknown()).describe('Flexible metadata (e.g., page numbers, sections)'),
  
  // Token information
  tokenCount: z.number().optional().describe('Number of tokens in chunk'),
  
  // Lifecycle
  createdAt: z.date().describe('Creation timestamp'),
  version: z.number().default(1).describe('Chunk version (matches document version)'),
});

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

/**
 * SearchResult Model
 * Represents a chunk returned from a similarity search with relevance score.
 */

export const SearchResultSchema = DocumentChunkSchema.extend({
  score: z.number().min(0).max(1).describe('Similarity score (0-1, higher is better)'),
  highlights: z.array(z.string()).optional().describe('Highlighted matching passages'),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Factory function for creating new chunks
 */
export function createDocumentChunk(
  data: Omit<DocumentChunk, 'id' | 'createdAt' | 'version'>
): DocumentChunk {
  return DocumentChunkSchema.parse({
    ...data,
    id: generateId('chunk'),
    version: 1,
    createdAt: new Date(),
  });
}

/**
 * Utility function to calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
