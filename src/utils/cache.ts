/**
 * Cache utility for workflow and document caching
 */

export interface CacheOptions {
  ttlMs?: number;
  maxSize?: number;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;
  private maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.ttlMs = options.ttlMs || 300000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Increment hit counter
    entry.hits++;
    
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Evict if at capacity
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + (ttlMs || this.ttlMs),
      createdAt: now,
      hits: 0,
    };

    this.store.set(key, entry);
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const value = this.get(key);
    return value !== undefined;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Return iterator of keys (use with care; primarily for diagnostics)
   */
  keys(): IterableIterator<string> {
    return this.store.keys();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    totalHits: number;
    averageAge: number;
  } {
    const now = Date.now();
    let totalHits = 0;
    let totalAge = 0;

    for (const entry of this.store.values()) {
      totalHits += entry.hits;
      totalAge += now - entry.createdAt;
    }

    return {
      size: this.store.size,
      maxSize: this.maxSize,
      totalHits,
      averageAge: this.store.size > 0 ? totalAge / this.store.size : 0,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | undefined;
    let lruHits = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.hits < lruHits) {
        lruHits = entry.hits;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.store.delete(lruKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Workflow cache with specialized methods
 */
export class WorkflowCache<TWorkflow = Record<string, unknown>> {
  private cache = new Cache<TWorkflow>({ ttlMs: 600000, maxSize: 500 });

  getWorkflow(workflowId: string, version: number): TWorkflow | undefined {
    return this.cache.get(`workflow:${workflowId}:${version}`);
  }

  setWorkflow(workflowId: string, version: number, workflow: TWorkflow): void {
    this.cache.set(`workflow:${workflowId}:${version}`, workflow);
  }

  invalidateWorkflow(workflowId: string): void {
    const prefix = `workflow:${workflowId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
