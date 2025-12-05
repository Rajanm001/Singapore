/**
 * Step Registry
 * Central registry for workflow step handlers.
 * New step types can be registered at runtime for extensibility.
 */

import type { StepType } from '../models/workflowStep.ts';
import type { BaseStepHandler } from './handlers/baseStepHandler.ts';
import { ConfigurationError } from '../utils/errors.ts';

export class StepRegistry {
  private handlers = new Map<string, BaseStepHandler>();

  /**
   * Register a step handler
   */
  register(handlerOrType: BaseStepHandler | StepType, handler?: BaseStepHandler): void {
    let type: string;
    let handlerInstance: BaseStepHandler;

    if (typeof handlerOrType === 'string') {
      // Called as register(type, handler)
      type = handlerOrType;
      handlerInstance = handler!;
    } else {
      // Called as register(handler)
      type = handlerOrType.type;
      handlerInstance = handlerOrType;
    }

    this.handlers.set(type, handlerInstance);
  }

  /**
   * Get a step handler by type
   */
  get(type: string): BaseStepHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Get a step handler by type (throws if not found)
   */
  getHandler(type: StepType): BaseStepHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new ConfigurationError(`No handler registered for step type '${type}'`);
    }
    return handler;
  }

  /**
   * Check if a handler is registered
   */
  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /**
   * Check if a handler is registered (alias)
   */
  hasHandler(type: StepType): boolean {
    return this.handlers.has(type);
  }

  /**
   * List all registered handlers
   */
  listHandlers(): BaseStepHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get all registered step types
   */
  getRegisteredTypes(): StepType[] {
    return Array.from(this.handlers.keys()) as StepType[];
  }

  /**
   * Get all registered step types as strings (alias for compatibility)
   */
  getAllTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Unregister a handler (useful for testing)
   */
  unregister(type: string): boolean {
    return this.handlers.delete(type);
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Global step registry instance
 */
export const globalStepRegistry = new StepRegistry();
