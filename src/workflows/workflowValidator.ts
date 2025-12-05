/**
 * Workflow Validator
 * Validates workflow definitions for structural integrity and correctness
 */

import type { Workflow } from '../models/workflow.ts';
import type { WorkflowStep, ConditionStepParams } from '../models/workflowStep.ts';
import { WorkflowValidationError } from '../utils/errors.ts';

export interface ValidationResult {
  valid: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class WorkflowValidator {
  /**
   * Validate a workflow definition
   */
  validate(workflow: Workflow): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic structure
    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
      return { valid: false, isValid: false, errors, warnings };
    }

    // Check max steps
    if (workflow.steps.length > workflow.maxSteps) {
      errors.push(`Workflow exceeds maximum allowed steps (${workflow.maxSteps})`);
    }

    // Collect all step IDs
    const stepIds = new Set<string>();
    const duplicateIds: string[] = [];

    for (const step of workflow.steps) {
      if (stepIds.has(step.id)) {
        duplicateIds.push(step.id);
      }
      stepIds.add(step.id);
    }

    if (duplicateIds.length > 0) {
      errors.push(`Duplicate step IDs found: ${duplicateIds.join(', ')}`);
    }

    // Validate entry step
    if (!stepIds.has(workflow.entryStepId)) {
      errors.push(`Entry step '${workflow.entryStepId}' referenced by entryStepId not found in workflow steps`);
    }

    // Validate step references
    for (const step of workflow.steps) {
      if (step.nextStepId && !stepIds.has(step.nextStepId)) {
        errors.push(`Step '${step.id}' references non-existent next step '${step.nextStepId}'`);
      }

      if (step.onSuccess && !stepIds.has(step.onSuccess)) {
        errors.push(`Step '${step.id}' references non-existent onSuccess step '${step.onSuccess}'`);
      }

      if (step.onFailure && !stepIds.has(step.onFailure)) {
        errors.push(`Step '${step.id}' references non-existent onFailure step '${step.onFailure}'`);
      }

      // Validate condition step specific params
      if (step.type === 'CONDITION') {
        const params = step.params as Partial<ConditionStepParams>;
        if (params.onTrue && !stepIds.has(params.onTrue)) {
          errors.push(`Condition step '${step.id}' references non-existent onTrue step '${params.onTrue}'`);
        }
        if (params.onFalse && !stepIds.has(params.onFalse)) {
          errors.push(`Condition step '${step.id}' references non-existent onFalse step '${params.onFalse}'`);
        }
      }
    }

    // Check for circular references
    const circularPaths = this.detectCircularReferences(workflow);
    if (circularPaths.length > 0) {
      errors.push(`circular references detected: ${circularPaths.join(', ')}`);
    }

    // Check for unreachable steps
    const reachableSteps = this.findReachableSteps(workflow);
    const unreachableSteps = Array.from(stepIds).filter((id) => !reachableSteps.has(id));
    
    if (unreachableSteps.length > 0) {
      errors.push(`unreachable steps found: ${unreachableSteps.join(', ')}`);
    }

    const isValid = errors.length === 0;
    return {
      valid: isValid,
      isValid,
      errors,
      warnings,
    };
  }

  /**
   * Validate and throw if invalid
   */
  validateOrThrow(workflow: Workflow): void {
    const result = this.validate(workflow);
    if (!result.valid) {
      throw new WorkflowValidationError(
        `Workflow validation failed: ${result.errors.join('; ')}`,
        { errors: result.errors, warnings: result.warnings }
      );
    }
  }

  /**
   * Detect circular references using DFS
   */
  private detectCircularReferences(workflow: Workflow): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circular: string[] = [];

    const dfs = (stepId: string, path: string[]): void => {
      if (recursionStack.has(stepId)) {
        circular.push([...path, stepId].join(' -> '));
        return;
      }

      if (visited.has(stepId)) {
        return;
      }

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = workflow.steps.find((s: WorkflowStep) => s.id === stepId);
      if (step) {
        const nextSteps: string[] = [];
        
        if (step.nextStepId) nextSteps.push(step.nextStepId);
        if (step.onSuccess) nextSteps.push(step.onSuccess);
        if (step.onFailure) nextSteps.push(step.onFailure);
        
        if (step.type === 'CONDITION') {
          const params = step.params as Partial<ConditionStepParams>;
          if (params.onTrue) nextSteps.push(params.onTrue);
          if (params.onFalse) nextSteps.push(params.onFalse);
        }

        for (const nextStep of nextSteps) {
          dfs(nextStep, [...path, stepId]);
        }
      }

      recursionStack.delete(stepId);
    };

    dfs(workflow.entryStepId, []);
    return circular;
  }

  /**
   * Find all reachable steps from entry point
   */
  private findReachableSteps(workflow: Workflow): Set<string> {
    const reachable = new Set<string>();
    const queue: string[] = [workflow.entryStepId];

    while (queue.length > 0) {
      const stepId = queue.shift()!;
      
      if (reachable.has(stepId)) {
        continue;
      }

      reachable.add(stepId);

      const step = workflow.steps.find((s: WorkflowStep) => s.id === stepId);
      if (step) {
        if (step.nextStepId) queue.push(step.nextStepId);
        if (step.onSuccess) queue.push(step.onSuccess);
        if (step.onFailure) queue.push(step.onFailure);
        
        if (step.type === 'CONDITION') {
          const params = step.params as Partial<ConditionStepParams>;
          if (params.onTrue) queue.push(params.onTrue);
          if (params.onFalse) queue.push(params.onFalse);
        }
      }
    }

    return reachable;
  }
}
