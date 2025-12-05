/**
 * Document Processor
 * Handles document chunking and preprocessing for RAG
 */

import type { Document } from '../../models/document.ts';
import type { DocumentChunk } from '../../models/documentChunk.ts';
import { createLogger } from '../../utils/logger.ts';

export interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize?: number;
  separator?: string;
}

export interface ProcessingResult {
  chunks: Omit<DocumentChunk, 'id' | 'embedding' | 'createdAt'>[];
  metadata: {
    totalChunks: number;
    totalTokens: number;
    processingTimeMs: number;
  };
}

export class DocumentProcessor {
  private logger = createLogger('DocumentProcessor');

  /**
   * Process a document into chunks
   */
  async processDocument(
    document: Document,
    options: ChunkingOptions
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    if (!document.content) {
      throw new Error('Document content is required for processing');
    }
    const content = document.content;
    
    this.logger.info('Processing document', {
      documentId: document.id,
      contentLength: content.length,
      chunkSize: options.chunkSize,
    });

    // Split into chunks
    const chunks = this.chunkText(content, options);

    // Create chunk records
    const chunkRecords = chunks.map((chunk, index) => ({
      documentId: document.id,
      collectionId: document.collectionId,
      organizationId: document.organizationId,
      subOrganizationId: document.subOrganizationId,
      text: chunk.text,
      position: {
        index,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
      },
      metadata: {
        ...document.metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
      },
      tokenCount: this.estimateTokens(chunk.text),
      version: document.version,
    }));

    const totalTokens = chunkRecords.reduce((sum, c) => sum + (c.tokenCount || 0), 0);
    const processingTimeMs = Date.now() - startTime;

    this.logger.info('Document processed', {
      documentId: document.id,
      totalChunks: chunkRecords.length,
      totalTokens,
      processingTimeMs,
    });

    return {
      chunks: chunkRecords,
      metadata: {
        totalChunks: chunkRecords.length,
        totalTokens,
        processingTimeMs,
      },
    };
  }

  /**
   * Chunk text with overlap
   */
  private chunkText(
    text: string,
    options: ChunkingOptions
  ): Array<{ text: string; startChar: number; endChar: number }> {
    const { chunkSize, chunkOverlap, minChunkSize = 100, separator = '\n\n' } = options;
    
    // First try to split by paragraphs
    const paragraphs = text.split(separator).filter(p => p.trim().length > 0);
    
    const chunks: Array<{ text: string; startChar: number; endChar: number }> = [];
    let currentChunk = '';
    let currentStart = 0;
    let position = 0;

    for (const paragraph of paragraphs) {
      const paragraphWithSep = paragraph + separator;
      
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraphWithSep.length > chunkSize && currentChunk.length >= minChunkSize) {
        // Save current chunk
        chunks.push({
          text: currentChunk.trim(),
          startChar: currentStart,
          endChar: position,
        });

        // Start new chunk with overlap
        const overlapText = this.getOverlap(currentChunk, chunkOverlap);
        currentChunk = overlapText + paragraphWithSep;
        currentStart = position - overlapText.length;
      } else {
        currentChunk += paragraphWithSep;
        if (currentChunk.length === paragraphWithSep.length) {
          currentStart = position;
        }
      }

      position += paragraphWithSep.length;
    }

    // Add final chunk
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push({
        text: currentChunk.trim(),
        startChar: currentStart,
        endChar: position,
      });
    }

    // If text is too short or no good split points, return as single chunk
    if (chunks.length === 0) {
      chunks.push({
        text: text.trim(),
        startChar: 0,
        endChar: text.length,
      });
    }

    return chunks;
  }

  /**
   * Get overlap text from end of chunk
   */
  private getOverlap(text: string, overlapSize: number): string {
    if (overlapSize === 0 || text.length <= overlapSize) {
      return '';
    }

    const overlapText = text.slice(-overlapSize);
    
    // Try to start at a word boundary
    const firstSpace = overlapText.indexOf(' ');
    if (firstSpace > 0 && firstSpace < overlapSize / 2) {
      return overlapText.slice(firstSpace + 1);
    }

    return overlapText;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Average: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Clean and normalize text
   */
  cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\t/g, ' ')              // Convert tabs to spaces
      .replace(/ +/g, ' ')              // Collapse multiple spaces
      .replace(/\n{3,}/g, '\n\n')       // Limit consecutive newlines
      .trim();
  }

  /**
   * Extract metadata from document content
   */
  extractMetadata(text: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Detect language (simple heuristic)
    const englishWords = ['the', 'and', 'is', 'in', 'to', 'of'];
    const lowerText = text.toLowerCase();
    const englishWordCount = englishWords.filter(word => lowerText.includes(word)).length;
    
    if (englishWordCount >= 3) {
      metadata.language = 'en';
    }

    // Count sentences (rough approximation)
    const sentenceCount = (text.match(/[.!?]+/g) || []).length;
    metadata.sentenceCount = sentenceCount;

    // Count words
    const wordCount = text.split(/\s+/).length;
    metadata.wordCount = wordCount;

    // Detect if document contains code
    const codeIndicators = ['function', 'const', 'class', 'import', '{', '}', '=>'];
    const codeIndicatorCount = codeIndicators.filter(indicator => 
      text.includes(indicator)
    ).length;
    
    if (codeIndicatorCount >= 3) {
      metadata.containsCode = true;
    }

    return metadata;
  }
}
