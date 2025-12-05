/**
 * Execution Context Manager
 * Manages workflow execution context and state
 */

import type { TemplateContext } from '../utils/templateEngine.ts';
import { createLogger } from '../utils/logger.ts';

export interface ExecutionState {
  currentStepId: string;
  visitedSteps: Set<string>;
  stepOutputs: Map<string, unknown>;
  startTime: number;
  metrics: {
    stepsExecuted: number;
    errors: number;
    retries: number;
    totalDuration: number;
  };
}

export class ExecutionContextManager {
  private logger = createLogger('ExecutionContextManager');
  private contexts = new Map<string, ExecutionState>();

  /**
   * Initialize execution context
   */
  initializeContext(
    executionId: string,
    entryStepId: string,
    inputPayload: Record<string, unknown>
  ): TemplateContext {
    this.logger.info('Initializing execution context', {
      executionId,
      entryStepId,
    });

    const state: ExecutionState = {
      currentStepId: entryStepId,
      visitedSteps: new Set(),
      stepOutputs: new Map(),
      startTime: Date.now(),
      metrics: {
        stepsExecuted: 0,
        errors: 0,
        retries: 0,
        totalDuration: 0,
      },
    };

    this.contexts.set(executionId, state);

    return {
      input: inputPayload,
      steps: {},
      context: {
        executionId,
        startedAt: new Date(state.startTime).toISOString(),
      },
    };
  }

  /**
   * Update context with step result
   */
  updateContext(
    executionId: string,
    stepId: string,
    output: unknown,
    templateContext: TemplateContext
  ): TemplateContext {
    const state = this.contexts.get(executionId);
    if (!state) {
      throw new Error(`No context found for execution ${executionId}`);
    }

    // Mark step as visited
    state.visitedSteps.add(stepId);
    state.stepOutputs.set(stepId, output);
    state.metrics.stepsExecuted++;

    // Update template context
    templateContext.steps[stepId] = {
      output,
      metadata: {
        executedAt: new Date().toISOString(),
        stepId,
      },
    };

    return templateContext;
  }

  /**
   * Get current execution state
   */
  getState(executionId: string): ExecutionState | undefined {
    return this.contexts.get(executionId);
  }

  /**
   * Check if step has been visited (detect loops)
   */
  hasVisitedStep(executionId: string, stepId: string): boolean {
    const state = this.contexts.get(executionId);
    if (!state) return false;
    return state.visitedSteps.has(stepId);
  }

  /**
   * Record error
   */
  recordError(executionId: string): void {
    const state = this.contexts.get(executionId);
    if (state) {
      state.metrics.errors++;
    }
  }

  /**
   * Record retry
   */
  recordRetry(executionId: string): void {
    const state = this.contexts.get(executionId);
    if (state) {
      state.metrics.retries++;
    }
  }

  /**
   * Get execution duration
   */
  getDuration(executionId: string): number {
    const state = this.contexts.get(executionId);
    if (!state) return 0;
    return Date.now() - state.startTime;
  }

  /**
   * Get execution metrics
   */
  getMetrics(executionId: string): ExecutionState['metrics'] | undefined {
    const state = this.contexts.get(executionId);
    if (!state) return undefined;

    return {
      ...state.metrics,
      totalDuration: this.getDuration(executionId),
    };
  }

  /**
   * Clean up context
   */
  cleanup(executionId: string): void {
    this.logger.info('Cleaning up execution context', { executionId });
    this.contexts.delete(executionId);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * Get step output
   */
  getStepOutput(executionId: string, stepId: string): unknown {
    const state = this.contexts.get(executionId);
    if (!state) return undefined;
    return state.stepOutputs.get(stepId);
  }

  /**
   * Check if execution is still running
   */
  isActive(executionId: string): boolean {
    return this.contexts.has(executionId);
  }

  /**
   * Set current step
   */
  setCurrentStep(executionId: string, stepId: string): void {
    const state = this.contexts.get(executionId);
    if (state) {
      state.currentStepId = stepId;
    }
  }

  /**
   * Get visited steps count
   */
  getVisitedStepsCount(executionId: string): number {
    const state = this.contexts.get(executionId);
    if (!state) return 0;
    return state.visitedSteps.size;
  }

  /**
   * Export context for debugging
   */
  exportContext(executionId: string): Record<string, unknown> | undefined {
    const state = this.contexts.get(executionId);
    if (!state) return undefined;

    return {
      currentStepId: state.currentStepId,
      visitedSteps: Array.from(state.visitedSteps),
      stepOutputs: Object.fromEntries(state.stepOutputs.entries()),
      metrics: state.metrics,
      duration: this.getDuration(executionId),
    };
  }
}
