/**
 * Base Step Handler
 * Abstract base class that all step handlers must extend.
 * Defines the interface for step validation and execution.
 */

import type { TemplateContext } from '../../utils/templateEngine.ts';
import type { Logger } from '../../utils/logger.ts';

/**
 * Result of a step execution
 */
export interface StepResult {
  success: boolean;
  output: unknown;
  metadata?: {
    duration?: number;
    tokensUsed?: number;
    apiCalls?: number;
    [key: string]: unknown;
  };
  error?: {
    message: string;
    code?: string;
    recoverable?: boolean;
  };
}

/**
 * Step execution context
 */
export interface StepExecutionContext {
  organizationId: string;
  subOrganizationId?: string;
  workflowId: string;
  executionId: string;
  templateContext: TemplateContext;
  logger: Logger;
}

/**
 * Base step handler interface
 */
export abstract class BaseStepHandler {
  abstract readonly type: string;
  abstract readonly description: string;

  /**
   * Validate step parameters
   * Throws an error if parameters are invalid
   */
  abstract validateParams(params: Record<string, unknown>): void;

  /**
   * Execute the step
   */
  abstract execute(
    params: Record<string, unknown>,
    context: StepExecutionContext
  ): Promise<StepResult>;

  /**
   * Get parameter schema documentation (for tooling/UI)
   */
  abstract getParamSchema(): Record<string, unknown>;

  /**
   * Helper to create a success result
   */
  protected success(output: unknown, metadata?: StepResult['metadata']): StepResult {
    return {
      success: true,
      output,
      metadata,
    };
  }

  /**
   * Helper to create a failure result
   */
  protected failure(message: string, code?: string, recoverable = false): StepResult {
    return {
      success: false,
      output: null,
      error: {
        message,
        code,
        recoverable,
      },
    };
  }

  /**
   * Helper to measure execution time
   */
  protected async measureExecution<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }
}
