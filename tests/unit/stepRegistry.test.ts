/**
 * Step Registry Tests
 * Tests for step handler registration and lookup
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StepRegistry } from '../../src/workflows/stepRegistry';
import { BaseStepHandler } from '../../src/workflows/handlers/baseStepHandler';
import type { StepResult, StepExecutionContext } from '../../src/workflows/handlers/baseStepHandler';

class TestStepHandler extends BaseStepHandler {
  readonly type = 'TEST' as const;
  readonly description = 'Test handler';

  async execute(_params: Record<string, unknown>, _context: StepExecutionContext): Promise<StepResult> {
    return this.success({ message: 'Test executed' });
  }

  validateParams(_params: Record<string, unknown>): void {
    // No validation needed for test
  }

  getParamSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {},
    };
  }
}

class AnotherTestHandler extends BaseStepHandler {
  readonly type = 'ANOTHER' as const;
  readonly description = 'Another test handler';

  async execute(_params: Record<string, unknown>, _context: StepExecutionContext): Promise<StepResult> {
    return this.success({ message: 'Another executed' });
  }

  validateParams(_params: Record<string, unknown>): void {}

  getParamSchema(): Record<string, unknown> {
    return { type: 'object', properties: {} };
  }
}

describe('StepRegistry', () => {
  let registry: StepRegistry;

  beforeEach(() => {
    registry = new StepRegistry();
  });

  describe('Registration', () => {
    it('should register a handler', () => {
      const handler = new TestStepHandler();
      registry.register(handler);

      const retrieved = registry.get('TEST');
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('TEST');
    });

    it('should register multiple handlers', () => {
      const handler1 = new TestStepHandler();
      const handler2 = new AnotherTestHandler();

      registry.register(handler1);
      registry.register(handler2);

      expect(registry.get('TEST')).toBeDefined();
      expect(registry.get('ANOTHER')).toBeDefined();
    });

    it('should overwrite existing handler with same type', () => {
      const handler1 = new TestStepHandler();
      const handler2 = new TestStepHandler();

      registry.register(handler1);
      registry.register(handler2);

      const retrieved = registry.get('TEST');
      expect(retrieved).toBe(handler2);
    });
  });

  describe('Retrieval', () => {
    it('should return undefined for unknown type', () => {
      const handler = registry.get('UNKNOWN');
      expect(handler).toBeUndefined();
    });

    it('should retrieve registered handler', () => {
      const handler = new TestStepHandler();
      registry.register(handler);

      const retrieved = registry.get('TEST');
      expect(retrieved).toBe(handler);
    });
  });

  describe('Listing', () => {
    it('should list all registered handlers', () => {
      const handler1 = new TestStepHandler();
      const handler2 = new AnotherTestHandler();

      registry.register(handler1);
      registry.register(handler2);

      const handlers = registry.listHandlers();
      expect(handlers).toHaveLength(2);
      expect(handlers.map(h => h.type)).toContain('TEST');
      expect(handlers.map(h => h.type)).toContain('ANOTHER');
    });

    it('should return empty array when no handlers registered', () => {
      const handlers = registry.listHandlers();
      expect(handlers).toHaveLength(0);
    });
  });

  describe('Has', () => {
    it('should return true for registered handler', () => {
      const handler = new TestStepHandler();
      registry.register(handler);

      expect(registry.has('TEST')).toBe(true);
    });

    it('should return false for unregistered handler', () => {
      expect(registry.has('UNKNOWN')).toBe(false);
    });
  });

  describe('Unregister', () => {
    it('should unregister a handler', () => {
      const handler = new TestStepHandler();
      registry.register(handler);

      expect(registry.has('TEST')).toBe(true);
      registry.unregister('TEST');
      expect(registry.has('TEST')).toBe(false);
    });

    it('should handle unregistering non-existent handler', () => {
      expect(() => registry.unregister('UNKNOWN')).not.toThrow();
    });
  });

  describe('Clear', () => {
    it('should clear all handlers', () => {
      const handler1 = new TestStepHandler();
      const handler2 = new AnotherTestHandler();

      registry.register(handler1);
      registry.register(handler2);

      expect(registry.listHandlers()).toHaveLength(2);
      
      registry.clear();
      
      expect(registry.listHandlers()).toHaveLength(0);
    });
  });
});
