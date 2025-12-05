/**
 * Rate Limiter
 * Protect workflow execution from abuse
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (organizationId: string, workflowId: string) => string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

export class RateLimiter {
  private requests = new Map<string, number[]>();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
    };
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(
    organizationId: string,
    workflowId: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const key = this.config.keyGenerator(organizationId, workflowId);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests in window
    let timestamps = this.requests.get(key) || [];
    
    // Remove expired timestamps
    timestamps = timestamps.filter(ts => ts > windowStart);

    const remaining = Math.max(0, this.config.maxRequests - timestamps.length);
    const allowed = remaining > 0;

    if (allowed) {
      timestamps.push(now);
      this.requests.set(key, timestamps);
    }

    const resetAt = new Date(now + this.config.windowMs);

    return {
      allowed,
      info: {
        limit: this.config.maxRequests,
        remaining: allowed ? remaining - 1 : 0,
        resetAt,
      },
    };
  }

  /**
   * Reset limits for a key
   */
  reset(organizationId: string, workflowId: string): void {
    const key = this.config.keyGenerator(organizationId, workflowId);
    this.requests.delete(key);
  }

  /**
   * Clear all limits
   */
  clearAll(): void {
    this.requests.clear();
  }

  /**
   * Get current usage
   */
  getUsage(organizationId: string, workflowId: string): number {
    const key = this.config.keyGenerator(organizationId, workflowId);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const timestamps = this.requests.get(key) || [];
    return timestamps.filter(ts => ts > windowStart).length;
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator(organizationId: string, workflowId: string): string {
    return `${organizationId}:${workflowId}`;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const activeTimestamps = timestamps.filter(ts => ts > windowStart);
      
      if (activeTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, activeTimestamps);
      }
    }
  }
}

/**
 * Circuit Breaker
 * Prevent cascading failures
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindowMs: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureTime?: number;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      
      // After 3 successes, close the circuit
      if (this.successCount >= 3) {
        this.reset();
      }
    } else {
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }

    if (this.state === 'half-open') {
      this.state = 'open';
      this.successCount = 0;
    }
  }

  /**
   * Check if should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }
}

/**
 * Timeout Manager
 * Manage execution timeouts
 */

export class TimeoutManager {
  private timeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Set timeout for execution
   */
  setTimeout(
    executionId: string,
    timeoutMs: number,
    callback: () => void
  ): void {
    // Clear existing timeout
    this.clearTimeout(executionId);

    // Set new timeout
    const timeout = setTimeout(() => {
      this.timeouts.delete(executionId);
      callback();
    }, timeoutMs);

    this.timeouts.set(executionId, timeout);
  }

  /**
   * Clear timeout
   */
  clearTimeout(executionId: string): void {
    const timeout = this.timeouts.get(executionId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(executionId);
    }
  }

  /**
   * Clear all timeouts
   */
  clearAll(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }

  /**
   * Check if timeout exists
   */
  hasTimeout(executionId: string): boolean {
    return this.timeouts.has(executionId);
  }

  /**
   * Get active timeout count
   */
  getActiveCount(): number {
    return this.timeouts.size;
  }
}
