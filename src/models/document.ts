import { z } from 'zod';

/**
 * Document Model
 * Represents a single document within a knowledge collection.
 * Documents are chunked for vector search and retrieval.
 */

export const DocumentSchema = z.object({
  id: z.string().describe('Unique document identifier'),
  collectionId: z.string().describe('Parent collection ID'),
  organizationId: z.string().describe('Owner organization ID'),
  subOrganizationId: z.string().optional().describe('Optional sub-org scope'),
  
  // Content
  name: z.string().describe('Document name or title'),
  contentType: z.string().describe('MIME type (e.g., "application/pdf", "text/plain")'),
  content: z.string().optional().describe('Raw text content (for text documents)'),
  
  // Source information
  source: z.object({
    type: z.enum(['upload', 'url', 'api', 'integration']).describe('How document was ingested'),
    url: z.string().optional().describe('Original URL if applicable'),
    uploadedBy: z.string().optional().describe('User ID who uploaded'),
  }),
  
  // Metadata
  metadata: z.record(z.unknown()).describe('Flexible metadata storage'),
  
  // Processing status
  processingStatus: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
  processingError: z.string().optional().describe('Error message if processing failed'),
  
  // Lifecycle
  createdAt: z.date().describe('Creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
  version: z.number().default(1).describe('Document version'),
  
  // Statistics
  stats: z.object({
    size: z.number().describe('Size in bytes'),
    chunkCount: z.number().default(0).describe('Number of chunks generated'),
    tokenCount: z.number().optional().describe('Total token count'),
  }).optional(),
});

export type Document = z.infer<typeof DocumentSchema>;

/**
 * Factory function for creating new documents
 */
export function createDocument(
  data: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'processingStatus'>
): Document {
  return DocumentSchema.parse({
    ...data,
    id: generateId('doc'),
    version: 1,
    processingStatus: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
