/**
 * Embedding Service Interface
 * Converts text into vector embeddings for semantic search
 */

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
  organizationId: string;
  dimensions?: number;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
  usage?: {
    tokens: number;
  };
}

export interface EmbeddingService {
  /**
   * Generate embeddings for one or more texts
   */
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /**
   * Generate a single embedding
   */
  embedSingle(text: string, organizationId: string): Promise<number[]>;

  /**
   * Get the dimensionality of embeddings produced by this service
   */
  getDimensions(): number;

  /**
   * Get the model name
   */
  getModel(): string;
}

/**
 * Mock embedding service for development
 */
export class MockEmbeddingService implements EmbeddingService {
  private dimensions: number;
  private model: string;

  constructor(dimensions = 384, model = 'mock-embedding-v1') {
    this.dimensions = dimensions;
    this.model = model;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const embeddings = await Promise.all(
      request.texts.map(text => this.generateEmbedding(text))
    );

    return {
      embeddings,
      model: request.model || this.model,
      dimensions: request.dimensions || this.dimensions,
      usage: {
        tokens: request.texts.reduce((sum, text) => sum + this.estimateTokens(text), 0),
      },
    };
  }

  async embedSingle(text: string, _organizationId: string): Promise<number[]> {
    return this.generateEmbedding(text);
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));

    const embedding: number[] = [];
    
    // Generate deterministic pseudo-random embedding based on text content
    let hash = this.hashCode(text);
    
    for (let i = 0; i < this.dimensions; i++) {
      // Use text hash and position to generate value
      const value = Math.sin(hash + i * 0.1) * 0.5 + 0.5;
      embedding.push(value);
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    }

    // Normalize to unit vector
    return this.normalize(embedding);
  }

  private normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map(val => val / norm);
  }

  private hashCode(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * OpenAI embedding service (future implementation)
 */
export class OpenAIEmbeddingService implements EmbeddingService {
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(apiKey: string, model = 'text-embedding-3-small', dimensions = 1536) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new Error(
      `OpenAI embedding service not yet implemented (apiKey configured: ${this.apiKey ? 'yes' : 'no'})`
    );
  }

  async embedSingle(text: string, organizationId: string): Promise<number[]> {
    const result = await this.embed({
      texts: [text],
      organizationId,
    });
    return result.embeddings[0] || [];
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }
}
