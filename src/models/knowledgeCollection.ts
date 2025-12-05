import { z } from 'zod';

/**
 * KnowledgeCollection Model
 * Represents a collection of documents with shared configuration.
 * Collections are scoped to an organization and optional sub-organization.
 */

export const KnowledgeCollectionSchema = z.object({
  id: z.string().describe('Unique identifier for the collection'),
  organizationId: z.string().describe('Owner organization ID'),
  subOrganizationId: z.string().optional().describe('Optional sub-org scope'),
  name: z.string().min(1).describe('Collection name'),
  description: z.string().optional().describe('Collection description'),
  metadata: z.record(z.unknown()).optional().describe('Flexible metadata'),
  
  // Embedding configuration
  embeddingConfig: z.object({
    model: z.string().describe('Embedding model identifier (e.g., "text-embedding-ada-002")'),
    dimensions: z.number().describe('Embedding vector dimensions'),
    chunkSize: z.number().default(512).describe('Default chunk size in tokens'),
    chunkOverlap: z.number().default(50).describe('Overlap between chunks'),
  }),
  
  // Versioning
  version: z.number().default(1).describe('Collection schema version'),
  
  // Lifecycle
  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
  status: z.enum(['active', 'indexing', 'archived']).default('active'),
  
  // Statistics
  stats: z.object({
    documentCount: z.number().default(0),
    chunkCount: z.number().default(0),
    totalSize: z.number().default(0).describe('Total size in bytes'),
  }).optional(),
});

export type KnowledgeCollection = z.infer<typeof KnowledgeCollectionSchema>;

/**
 * Factory function for creating new knowledge collections
 */
export function createKnowledgeCollection(
  data: Omit<KnowledgeCollection, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'version'>
): KnowledgeCollection {
  return KnowledgeCollectionSchema.parse({
    ...data,
    id: generateId('coll'),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
    stats: {
      documentCount: 0,
      chunkCount: 0,
      totalSize: 0,
    },
  });
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
