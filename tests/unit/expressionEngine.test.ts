/**
 * Expression Engine Unit Tests
 * Tests for safe boolean expression evaluation
 */

import { describe, it, expect } from 'vitest';
import { evaluateExpression } from '../../src/utils/expressionEngine';
import type { TemplateContext } from '../../src/utils/templateEngine';

describe('ExpressionEngine', () => {
  const mockContext: TemplateContext = {
    input: {
      priority: 'high',
      count: 5,
      score: 0.85,
      enabled: true,
      name: 'Test User',
      tags: ['urgent', 'verified'],
    },
    steps: {
      s01_search: {
        output: {
          results: [
            { text: 'Result 1', score: 0.92 },
            { text: 'Result 2', score: 0.78 },
          ],
          count: 2,
        },
        metadata: {
          duration: 342,
        },
      },
      s02_classify: {
        output: {
          category: 'refund',
          confidence: 0.88,
          tags: ['financial', 'customer-service'],
        },
      },
    },
    context: {
      workflowId: 'wf_test',
      userId: 'user_123',
    },
  };

  describe('Comparison Operators', () => {
    it('evaluates equality (==) correctly', () => {
      expect(evaluateExpression('input.priority == "high"', mockContext)).toBe(true);
      expect(evaluateExpression('input.priority == "low"', mockContext)).toBe(false);
      expect(evaluateExpression('input.count == 5', mockContext)).toBe(true);
      expect(evaluateExpression('input.count == 10', mockContext)).toBe(false);
    });

    it('evaluates inequality (!=) correctly', () => {
      expect(evaluateExpression('input.priority != "low"', mockContext)).toBe(true);
      expect(evaluateExpression('input.priority != "high"', mockContext)).toBe(false);
    });

    it('evaluates greater than (>) correctly', () => {
      expect(evaluateExpression('input.score > 0.8', mockContext)).toBe(true);
      expect(evaluateExpression('input.score > 0.9', mockContext)).toBe(false);
    });

    it('evaluates greater than or equal (>=) correctly', () => {
      expect(evaluateExpression('input.score >= 0.85', mockContext)).toBe(true);
      expect(evaluateExpression('input.score >= 0.9', mockContext)).toBe(false);
    });

    it('evaluates less than (<) correctly', () => {
      expect(evaluateExpression('input.count < 10', mockContext)).toBe(true);
      expect(evaluateExpression('input.count < 3', mockContext)).toBe(false);
    });

    it('evaluates less than or equal (<=) correctly', () => {
      expect(evaluateExpression('input.count <= 5', mockContext)).toBe(true);
      expect(evaluateExpression('input.count <= 4', mockContext)).toBe(false);
    });
  });

  describe('String Operations', () => {
    it('evaluates contains operation', () => {
      expect(evaluateExpression('input.name contains "Test"', mockContext)).toBe(true);
      expect(evaluateExpression('input.name contains "Invalid"', mockContext)).toBe(false);
    });

    it('evaluates startsWith operation', () => {
      expect(evaluateExpression('input.name startsWith "Test"', mockContext)).toBe(true);
      expect(evaluateExpression('input.name startsWith "User"', mockContext)).toBe(false);
    });

    it('evaluates endsWith operation', () => {
      expect(evaluateExpression('input.name endsWith "User"', mockContext)).toBe(true);
      expect(evaluateExpression('input.name endsWith "Test"', mockContext)).toBe(false);
    });
  });

  describe('Logical Operators', () => {
    it('evaluates AND (&&) correctly', () => {
      expect(evaluateExpression('input.score > 0.8 && input.count > 3', mockContext)).toBe(true);
      expect(evaluateExpression('input.score > 0.8 && input.count > 10', mockContext)).toBe(false);
      expect(evaluateExpression('input.score > 0.9 && input.count > 3', mockContext)).toBe(false);
    });

    it('evaluates OR (||) correctly', () => {
      expect(evaluateExpression('input.score > 0.9 || input.count > 3', mockContext)).toBe(true);
      expect(evaluateExpression('input.score > 0.8 || input.count < 0', mockContext)).toBe(true);
      expect(evaluateExpression('input.score > 0.9 || input.count > 10', mockContext)).toBe(false);
    });

    it('evaluates complex logical expressions', () => {
      expect(
        evaluateExpression(
          'input.priority == "high" && (input.score > 0.8 || input.count > 10)',
          mockContext
        )
      ).toBe(true);

      expect(
        evaluateExpression(
          '(input.priority == "low" || input.priority == "high") && input.enabled == true',
          mockContext
        )
      ).toBe(true);
    });
  });

  describe('Nested Path Resolution', () => {
    it('resolves nested object paths', () => {
      expect(evaluateExpression('steps.s01_search.output.count == 2', mockContext)).toBe(true);
      expect(evaluateExpression('steps.s02_classify.output.category == "refund"', mockContext)).toBe(
        true
      );
    });

    it('resolves array indexing', () => {
      expect(evaluateExpression('steps.s01_search.output.results[0].score > 0.9', mockContext)).toBe(
        true
      );
      expect(evaluateExpression('steps.s01_search.output.results[1].score > 0.9', mockContext)).toBe(
        false
      );
    });

    it('handles deeply nested paths', () => {
      expect(
        evaluateExpression('steps.s02_classify.output.confidence >= 0.85', mockContext)
      ).toBe(true);
    });
  });

  describe('Boolean Values', () => {
    it('evaluates boolean literals', () => {
      expect(evaluateExpression('input.enabled == true', mockContext)).toBe(true);
      expect(evaluateExpression('input.enabled == false', mockContext)).toBe(false);
    });

    it('handles boolean comparisons', () => {
      expect(evaluateExpression('input.enabled != false', mockContext)).toBe(true);
    });
  });

  describe('Null Checks', () => {
    it('handles null values', () => {
      const contextWithNull: TemplateContext = {
        input: { value: null },
        steps: {},
        context: {},
      };

      expect(evaluateExpression('input.value == null', contextWithNull)).toBe(true);
      expect(evaluateExpression('input.value != null', contextWithNull)).toBe(false);
    });

    it('handles undefined paths as false', () => {
      expect(evaluateExpression('input.nonexistent == "value"', mockContext)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('returns false for invalid expressions', () => {
      expect(evaluateExpression('invalid syntax !!!', mockContext)).toBe(false);
      expect(evaluateExpression('', mockContext)).toBe(false);
    });

    it('handles malformed comparisons gracefully', () => {
      // Should return false rather than throwing
      expect(evaluateExpression('input.score >', mockContext)).toBe(false);
      expect(evaluateExpression('> 0.8', mockContext)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles whitespace correctly', () => {
      expect(evaluateExpression('  input.score  >  0.8  ', mockContext)).toBe(true);
      expect(evaluateExpression('input.priority=="high"', mockContext)).toBe(true);
    });

    it('handles quoted strings with spaces', () => {
      expect(evaluateExpression('input.name == "Test User"', mockContext)).toBe(true);
    });

    it('handles numeric comparisons correctly', () => {
      expect(evaluateExpression('input.score > 0', mockContext)).toBe(true);
      expect(evaluateExpression('input.count < 100', mockContext)).toBe(true);
    });
  });
});
