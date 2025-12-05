/**
 * Retrieval Service Interface
 * Abstraction for vector search and document retrieval
 */

import type { SearchResult } from '../../models/documentChunk.ts';

export interface SearchRequest {
  collectionId: string;
  query: string;
  topK: number;
  minScore?: number;
  filters?: Record<string, unknown>;
  organizationId: string;
  subOrganizationId?: string;
}

export interface RetrievalService {
  /**
   * Search for relevant document chunks
   */
  search(request: SearchRequest): Promise<SearchResult[]>;

  /**
   * Get embedding for a text query
   */
  getEmbedding(text: string): Promise<number[]>;
}
