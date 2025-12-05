/**
 * Template Engine Unit Tests
 * Tests for safe variable resolution in workflow configurations
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTemplate,
  resolveTemplateObject,
  hasTemplateVariables,
  extractTemplateVariables,
  type TemplateContext,
} from '../../src/utils/templateEngine';

describe('TemplateEngine', () => {
  const mockContext: TemplateContext = {
    input: {
      question: 'What is your refund policy?',
      userId: 'user_123',
      metadata: {
        source: 'web',
        timestamp: '2025-12-04T10:00:00Z',
      },
    },
    steps: {
      s01_retrieve: {
        output: {
          results: [
            { text: 'Refund policy chunk 1', score: 0.89 },
            { text: 'Refund policy chunk 2', score: 0.76 },
          ],
          count: 2,
        },
        metadata: {
          duration: 342,
        },
      },
      s02_generate: {
        output: {
          text: 'Based on our refund policy...',
          usage: {
            promptTokens: 150,
            completionTokens: 100,
            totalTokens: 250,
          },
        },
      },
    },
    context: {
      workflowId: 'wf_test',
      executionId: 'exec_123',
      organizationId: 'org_demo',
    },
  };

  describe('resolveTemplate', () => {
    it('resolves simple input variables', () => {
      const template = 'Question: {{input.question}}';
      const result = resolveTemplate(template, mockContext);
      expect(result).toBe('Question: What is your refund policy?');
    });

    it('resolves nested object paths', () => {
      const template = 'Source: {{input.metadata.source}}';
      const result = resolveTemplate(template, mockContext);
      expect(result).toBe('Source: web');
    });

    it('resolves array indexing', () => {
      const template = 'First result: {{steps.s01_retrieve.output.results[0].text}}';
      const result = resolveTemplate(template, mockContext);
      expect(result).toBe('First result: Refund policy chunk 1');
    });

    it('resolves multiple variables in one template', () => {
      const template = 'User {{input.userId}} asked: {{input.question}}';
      const result = resolveTemplate(template, mockContext);
      expect(result).toBe('User user_123 asked: What is your refund policy?');
    });

    it('handles missing variables gracefully', () => {
      const template = 'Value: {{input.nonexistent}}';
      const result = resolveTemplate(template, mockContext);
      expect(result).toBe('Value: '); // Empty for undefined
    });

    it('handles null/undefined values', () => {
      const contextWithNull: TemplateContext = {
        input: { value: null },
        steps: {},
        context: {},
      };
      const result = resolveTemplate('Value: {{input.value}}', contextWithNull);
      expect(result).toBe('Value: '); // Empty string for null
    });

    it('formats numbers correctly', () => {
      const template = 'Score: {{steps.s01_retrieve.output.results[0].score}}';
      const result = resolveTemplate(template, mockContext);
      expect(result).toBe('Score: 0.89');
    });

    it('formats objects as JSON', () => {
      const template = 'Usage: {{steps.s02_generate.output.usage}}';
      const result = resolveTemplate(template, mockContext);
      expect(result).toContain('promptTokens');
      expect(result).toContain('250');
    });

    it('handles templates without variables', () => {
      const template = 'This is a plain string';
      const result = resolveTemplate(template, mockContext);
      expect(result).toBe('This is a plain string');
    });

    it('handles empty template', () => {
      const result = resolveTemplate('', mockContext);
      expect(result).toBe('');
    });
  });

  describe('resolveTemplateObject', () => {
    it('resolves templates in object values', () => {
      const obj = {
        title: 'Question from {{input.userId}}',
        body: '{{input.question}}',
        meta: {
          source: '{{input.metadata.source}}',
        },
      };

      const result = resolveTemplateObject(obj, mockContext);

      expect(result.title).toBe('Question from user_123');
      expect(result.body).toBe('What is your refund policy?');
      expect(result.meta.source).toBe('web');
    });

    it('resolves templates in arrays', () => {
      const arr = ['{{input.userId}}', '{{input.question}}', 'plain text'];

      const result = resolveTemplateObject(arr, mockContext);

      expect(result).toEqual(['user_123', 'What is your refund policy?', 'plain text']);
    });

    it('handles nested structures', () => {
      const complex = {
        users: [
          { id: '{{input.userId}}', question: '{{input.question}}' },
          { id: 'static', question: 'static question' },
        ],
        metadata: {
          workflow: '{{context.workflowId}}',
          execution: '{{context.executionId}}',
        },
      };

      const result = resolveTemplateObject(complex, mockContext);

      expect(result.users[0]?.id).toBe('user_123');
      expect(result.users[0]?.question).toBe('What is your refund policy?');
      expect(result.metadata.workflow).toBe('wf_test');
    });

    it('preserves non-string primitives', () => {
      const obj = {
        count: 42,
        enabled: true,
        value: null,
      };

      const result = resolveTemplateObject(obj, mockContext);

      expect(result.count).toBe(42);
      expect(result.enabled).toBe(true);
      expect(result.value).toBe(null);
    });
  });

  describe('hasTemplateVariables', () => {
    it('detects variables in string', () => {
      expect(hasTemplateVariables('Hello {{name}}')).toBe(true);
      expect(hasTemplateVariables('{{input.value}}')).toBe(true);
      expect(hasTemplateVariables('Text {{var1}} and {{var2}}')).toBe(true);
    });

    it('returns false for plain strings', () => {
      expect(hasTemplateVariables('Plain text')).toBe(false);
      expect(hasTemplateVariables('No variables here')).toBe(false);
      expect(hasTemplateVariables('')).toBe(false);
    });

    it('handles edge cases', () => {
      expect(hasTemplateVariables('{single brace}')).toBe(false);
      expect(hasTemplateVariables('{{}}}')).toBe(false);
      expect(hasTemplateVariables('{{}}')).toBe(false); // Empty variable name is not valid
    });
  });

  describe('extractTemplateVariables', () => {
    it('extracts all variables from string', () => {
      const str = 'User {{input.userId}} asked {{input.question}} from {{input.metadata.source}}';
      const variables = extractTemplateVariables(str);

      expect(variables).toEqual([
        'input.userId',
        'input.question',
        'input.metadata.source',
      ]);
    });

    it('handles no variables', () => {
      const variables = extractTemplateVariables('Plain text');
      expect(variables).toEqual([]);
    });

    it('handles duplicate variables', () => {
      const str = '{{input.name}} says hello {{input.name}}';
      const variables = extractTemplateVariables(str);

      expect(variables).toEqual(['input.name', 'input.name']);
    });

    it('trims whitespace from variable names', () => {
      const str = '{{ input.value }} and {{  steps.s01.output  }}';
      const variables = extractTemplateVariables(str);

      expect(variables).toEqual(['input.value', 'steps.s01.output']);
    });
  });

  describe('Edge Cases', () => {
    it('handles deeply nested paths', () => {
      const deepContext: TemplateContext = {
        input: {
          level1: {
            level2: {
              level3: {
                level4: 'deep value',
              },
            },
          },
        },
        steps: {},
        context: {},
      };

      const result = resolveTemplate(
        '{{input.level1.level2.level3.level4}}',
        deepContext
      );
      expect(result).toBe('deep value');
    });

    it('handles array of arrays', () => {
      const arrayContext: TemplateContext = {
        input: {
          matrix: [
            [1, 2, 3],
            [4, 5, 6],
          ],
        },
        steps: {},
        context: {},
      };

      const result = resolveTemplate('{{input.matrix[1][2]}}', arrayContext);
      expect(result).toBe('6');
    });

    it('handles special characters in values', () => {
      const specialContext: TemplateContext = {
        input: {
          text: 'Value with {{curly braces}} and "quotes"',
        },
        steps: {},
        context: {},
      };

      const result = resolveTemplate('{{input.text}}', specialContext);
      expect(result).toBe('Value with {{curly braces}} and "quotes"');
    });
  });
});
