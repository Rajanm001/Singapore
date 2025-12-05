/**
 * Memory-based Retrieval Service (Stub Implementation)
 * In-memory implementation for development and testing
 */

import type { RetrievalService, SearchRequest } from './retrievalService.ts';
import type { SearchResult } from '../../models/documentChunk.ts';
import { cosineSimilarity } from '../../models/documentChunk.ts';

export class MemoryRetrievalService implements RetrievalService {
  private mockChunks: SearchResult[] = [];

  constructor() {
    this.initializeMockData();
  }

  async search(request: SearchRequest): Promise<SearchResult[]> {
    // Get query embedding
    const queryEmbedding = await this.getEmbedding(request.query);

    // Filter by collection
    let candidates = this.mockChunks.filter(
      (chunk) => chunk.collectionId === request.collectionId
    );

    // Apply metadata filters if provided
    if (request.filters) {
      candidates = candidates.filter((chunk) => this.matchesFilters(chunk, request.filters!));
    }

    // Calculate similarities and rank
    const results = candidates
      .map((chunk) => {
        const score = chunk.embedding
          ? cosineSimilarity(queryEmbedding, chunk.embedding)
          : 0.5; // Default score if no embedding

        return {
          ...chunk,
          score,
        };
      })
      .filter((result) => !request.minScore || result.score >= request.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, request.topK);

    return results;
  }

  async getEmbedding(text: string): Promise<number[]> {
    // Mock embedding: simple hash-based pseudo-vector
    // In production, this would call OpenAI, Cohere, etc.
    const dimensions = 384;
    const embedding: number[] = [];
    
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash = hash & hash;
    }

    for (let i = 0; i < dimensions; i++) {
      const value = Math.sin(hash + i) * 0.5 + 0.5;
      embedding.push(value);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / norm);
  }

  private matchesFilters(chunk: SearchResult, filters: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (chunk.metadata && chunk.metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private initializeMockData(): void {
    // Mock data for refund policy collection
    const refundPolicyChunks = [
      {
        id: 'chunk_1',
        documentId: 'doc_refund_policy',
        collectionId: 'coll_policies',
        organizationId: 'org_demo',
        text: 'Our refund policy for digital products allows for a full refund within 14 days of purchase if the product has not been downloaded or accessed. Once a digital product is downloaded, it is non-refundable due to the nature of digital goods.',
        position: { index: 0 },
        metadata: { category: 'refund', product_type: 'digital' },
        createdAt: new Date(),
        version: 1,
        score: 0,
        embedding: Array(384).fill(0).map(() => Math.random()),
      },
      {
        id: 'chunk_2',
        documentId: 'doc_refund_policy',
        collectionId: 'coll_policies',
        organizationId: 'org_demo',
        text: 'For physical products, we offer a 30-day return window. Items must be unused and in original packaging. Customers are responsible for return shipping costs unless the item is defective.',
        position: { index: 1 },
        metadata: { category: 'refund', product_type: 'physical' },
        createdAt: new Date(),
        version: 1,
        score: 0,
        embedding: Array(384).fill(0).map(() => Math.random()),
      },
      {
        id: 'chunk_3',
        documentId: 'doc_refund_policy',
        collectionId: 'coll_policies',
        organizationId: 'org_demo',
        text: 'To request a refund, please contact our support team at support@example.com with your order number and reason for the refund. Refunds are typically processed within 5-7 business days.',
        position: { index: 2 },
        metadata: { category: 'refund', product_type: 'all' },
        createdAt: new Date(),
        version: 1,
        score: 0,
        embedding: Array(384).fill(0).map(() => Math.random()),
      },
    ];

    this.mockChunks = refundPolicyChunks;
  }

  /**
   * Add mock chunks for testing
   */
  addMockChunk(chunk: SearchResult): void {
    this.mockChunks.push(chunk);
  }

  /**
   * Clear all mock data
   */
  clearMockData(): void {
    this.mockChunks = [];
  }
}
