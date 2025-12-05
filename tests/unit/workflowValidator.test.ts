/**
 * Workflow Validator Tests
 * Tests for workflow structure validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowValidator } from '../../src/workflows/workflowValidator';
import type { Workflow } from '../../src/models/workflow';
import type { WorkflowStep } from '../../src/models/workflowStep';

describe('WorkflowValidator', () => {
  let validator: WorkflowValidator;

  beforeEach(() => {
    validator = new WorkflowValidator();
  });

  describe('Basic Validation', () => {
    it('should validate a simple valid workflow', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 's01',
        steps: [
          {
            id: 's01',
            type: 'RAG',
            label: 'Search',
            params: { collectionId: 'coll_1', query: 'test', topK: 5 },
          },
        ],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if entryStepId does not exist', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 'nonexistent',
        steps: [
          {
            id: 's01',
            type: 'RAG',
            label: 'Search',
            params: {},
          },
        ],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('entryStepId'))).toBe(true);
    });

    it('should fail if steps array is empty', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 's01',
        steps: [],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Circular Reference Detection', () => {
    it('should detect simple circular reference', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 's01',
        steps: [
          {
            id: 's01',
            type: 'LLM',
            label: 'Step 1',
            params: {},
            nextStepId: 's02',
          },
          {
            id: 's02',
            type: 'LLM',
            label: 'Step 2',
            params: {},
            nextStepId: 's01', // Circular!
          },
        ],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('circular'))).toBe(true);
    });

    it('should detect complex circular reference', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 's01',
        steps: [
          { id: 's01', type: 'LLM', label: 'Step 1', params: {}, nextStepId: 's02' },
          { id: 's02', type: 'LLM', label: 'Step 2', params: {}, nextStepId: 's03' },
          { id: 's03', type: 'LLM', label: 'Step 3', params: {}, nextStepId: 's04' },
          { id: 's04', type: 'LLM', label: 'Step 4', params: {}, nextStepId: 's02' }, // Back to s02
        ],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('circular'))).toBe(true);
    });
  });

  describe('Unreachable Steps Detection', () => {
    it('should detect unreachable step', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 's01',
        steps: [
          { id: 's01', type: 'LLM', label: 'Step 1', params: {} },
          { id: 's02', type: 'LLM', label: 'Step 2', params: {} }, // Unreachable!
        ],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('unreachable') && e.includes('s02'))).toBe(true);
    });

    it('should allow unreachable steps if they are exit points', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 's01',
        steps: [
          {
            id: 's01',
            type: 'CONDITION',
            label: 'Check',
            params: { expression: 'input.value > 10' },
            onSuccess: 's02',
            onFailure: 's03',
          },
          { id: 's02', type: 'LLM', label: 'High Path', params: {} },
          { id: 's03', type: 'LLM', label: 'Low Path', params: {} },
        ],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Step Reference Validation', () => {
    it('should fail if nextStepId references non-existent step', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 's01',
        steps: [
          {
            id: 's01',
            type: 'LLM',
            label: 'Step 1',
            params: {},
            nextStepId: 'nonexistent',
          },
        ],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);
    });

    it('should fail if onSuccess references non-existent step', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 's01',
        steps: [
          {
            id: 's01',
            type: 'CONDITION',
            label: 'Check',
            params: {},
            onSuccess: 'missing',
          },
        ],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Duplicate Step IDs', () => {
    it('should detect duplicate step IDs', () => {
      const workflow: Workflow = {
        id: 'wf_test',
        organizationId: 'org_test',
        name: 'Test Workflow',
        version: 1,
        isLatest: true,
        entryStepId: 's01',
        steps: [
          { id: 's01', type: 'LLM', label: 'Step 1', params: {} },
          { id: 's01', type: 'RAG', label: 'Duplicate', params: {} }, // Duplicate!
        ],
        maxSteps: 100,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validator.validate(workflow);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('duplicate') || e.includes('Duplicate'))).toBe(true);
    });
  });
});
