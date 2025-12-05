/**
 * Workflow Executor
 * Core engine for executing workflows step-by-step
 */

import type { Workflow } from '../models/workflow.ts';
import type { WorkflowStep } from '../models/workflowStep.ts';
import {
  createWorkflowExecution,
  addStepExecution,
  updateStepExecution,
  type WorkflowExecution,
} from '../models/workflowExecution.ts';
import type { TemplateContext } from '../utils/templateEngine.ts';
import { StepRegistry } from './stepRegistry.ts';
import { WorkflowValidator } from './workflowValidator.ts';
import { createLogger, type Logger } from '../utils/logger.ts';
import { StepExecutionError, TimeoutError, WorkflowValidationError } from '../utils/errors.ts';
import type { StepExecutionContext } from './handlers/baseStepHandler.ts';

export interface ExecutionOptions {
  maxSteps?: number;
  timeoutMs?: number;
}

export class WorkflowExecutor {
  private validator: WorkflowValidator;
  private logger: Logger;

  constructor(private stepRegistry: StepRegistry) {
    this.validator = new WorkflowValidator();
    this.logger = createLogger('WorkflowExecutor');
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflow: Workflow,
    organizationId: string,
    inputPayload: Record<string, unknown>,
    subOrganizationId?: string,
    options?: ExecutionOptions
  ): Promise<WorkflowExecution> {
    // Validate workflow
    this.validator.validateOrThrow(workflow);

    // Create execution record
    const execution = createWorkflowExecution(
      workflow.id,
      workflow.version,
      organizationId,
      inputPayload,
      subOrganizationId
    );

    const logger = this.logger.child(`exec:${execution.id}`);
    logger.info('Starting workflow execution', {
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      organizationId,
    });

    // Update execution status
    execution.status = 'running';
    execution.startedAt = new Date();

    try {
      // Initialize execution context
      const context: TemplateContext = {
        input: inputPayload,
        steps: {},
        context: {
          workflowId: workflow.id,
          executionId: execution.id,
          organizationId,
          subOrganizationId,
        },
      };

      // Execute steps
      await this.executeSteps(workflow, execution, context, options);

      // Set final output payload from last executed step
      if (execution.stepExecutions.length > 0) {
        const lastStep = execution.stepExecutions[execution.stepExecutions.length - 1];
        if (lastStep && lastStep.output) {
          execution.outputPayload = lastStep.output;
        }
      }

      // Mark as completed
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.durationMs = execution.completedAt.getTime() - execution.startedAt.getTime();

      logger.info('Workflow execution completed', {
        duration: execution.durationMs,
        stepsExecuted: execution.metrics?.stepsExecuted,
      });
    } catch (error) {
      logger.error('Workflow execution failed', error as Error);

      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.durationMs = execution.startedAt
        ? execution.completedAt.getTime() - execution.startedAt.getTime()
        : 0;

      if (error instanceof Error) {
        execution.error = {
          message: error.message,
          code: error.name,
          stack: error.stack,
        };
      }
    }

    // Ensure backward compatibility aliases are set
    const exec: Record<string, unknown> = execution as unknown as Record<string, unknown>;
    exec.steps = execution.stepExecutions;
    exec.output = execution.outputPayload;
    exec.input = execution.inputPayload;
    exec.executionId = execution.id;
    exec.startTime = execution.startedAt;
    exec.endTime = execution.completedAt;

    return execution;
  }

  /**
   * Execute workflow steps
   */
  private async executeSteps(
    workflow: Workflow,
    execution: WorkflowExecution,
    context: TemplateContext,
    options?: ExecutionOptions
  ): Promise<void> {
    const maxSteps = options?.maxSteps || workflow.maxSteps;
    const timeoutMs = options?.timeoutMs || workflow.maxExecutionTimeMs;

    let currentStepId: string | undefined = workflow.entryStepId;
    let stepsExecuted = 0;
    const startTime = Date.now();

    while (currentStepId) {
      // Check step limit
      if (stepsExecuted >= maxSteps) {
        throw new WorkflowValidationError(`Exceeded maximum steps (${maxSteps})`);
      }

      // Check timeout
      if (timeoutMs && Date.now() - startTime > timeoutMs) {
        throw new TimeoutError(`Workflow execution exceeded timeout (${timeoutMs}ms)`, timeoutMs);
      }

      // Find step
      const step = workflow.steps.find((s: WorkflowStep) => s.id === currentStepId);
      if (!step) {
        throw new WorkflowValidationError(`Step not found: ${currentStepId}`);
      }

      // Execute step
      const nextStepId = await this.executeStep(workflow, step, execution, context);

      stepsExecuted++;
      currentStepId = nextStepId;

      // Update metrics
      if (execution.metrics) {
        execution.metrics.stepsExecuted = stepsExecuted;
      }
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    workflow: Workflow,
    step: WorkflowStep,
    execution: WorkflowExecution,
    context: TemplateContext
  ): Promise<string | undefined> {
    const logger = this.logger.child(`step:${step.id}`);

    // Add step execution record
    addStepExecution(execution, step.id, step.type);

    logger.info('Executing step', {
      stepId: step.id,
      stepType: step.type,
      label: step.label,
    });

    // Update step status to running
    updateStepExecution(execution, step.id, {
      status: 'running',
      startedAt: new Date(),
    });

    try {
      // Get step handler
      const handler = this.stepRegistry.getHandler(step.type);

      // Validate parameters
      handler.validateParams(step.params);

      // Create step execution context
      const stepContext: StepExecutionContext = {
        organizationId: execution.organizationId,
        subOrganizationId: execution.subOrganizationId,
        workflowId: workflow.id,
        executionId: execution.id,
        templateContext: context,
        logger,
      };

      // Execute step with retry logic
      const result = await this.executeWithRetry(
        () => handler.execute(step.params, stepContext),
        step.retry?.maxAttempts || 1,
        step.retry?.backoffMs || 1000
      );

      // Update step execution
      updateStepExecution(execution, step.id, {
        status: result.success ? 'completed' : 'failed',
        output: result.output as Record<string, unknown> | undefined,
        error: result.error?.message,
        completedAt: new Date(),
        durationMs: result.metadata?.duration,
      });

      // Store step output in context
      context.steps[step.id] = {
        output: result.output,
        metadata: result.metadata,
      };

      // Update execution metrics
      if (execution.metrics && result.metadata) {
        if (typeof result.metadata.llmCallCount === 'number') {
          execution.metrics.llmCallCount += result.metadata.llmCallCount;
        }
        if (typeof result.metadata.ragQueryCount === 'number') {
          execution.metrics.ragQueryCount += result.metadata.ragQueryCount;
        }
        if (typeof result.metadata.tokensUsed === 'number') {
          execution.metrics.totalTokensUsed += result.metadata.tokensUsed;
        }
      }

      logger.info('Step completed', {
        stepId: step.id,
        success: result.success,
        duration: result.metadata?.duration,
      });

      // Determine next step
      if (!result.success) {
        return step.onFailure;
      }

      // Handle conditional branching
      if (step.type === 'CONDITION' && result.output) {
        const conditionOutput = result.output as { nextStep?: string };
        return conditionOutput.nextStep;
      }

      return step.onSuccess || step.nextStepId;
    } catch (error) {
      logger.error('Step execution failed', error as Error);

      updateStepExecution(execution, step.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      });

      // Use failure handler if available, otherwise throw
      if (step.onFailure) {
        return step.onFailure;
      }

      throw new StepExecutionError(
        `Step '${step.id}' failed: ${error instanceof Error ? error.message : String(error)}`,
        step.id,
        step.type
      );
    }
  }

  /**
   * Execute a function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number,
    backoffMs: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          this.logger.warn('Step execution failed, retrying', {
            attempt,
            maxAttempts,
            error: lastError.message,
          });

          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
        }
      }
    }

    throw lastError || new Error('Max retry attempts reached');
  }
}
