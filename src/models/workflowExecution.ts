import { z } from 'zod';

/**
 * WorkflowExecution Model
 * Represents a single execution instance of a workflow.
 * Tracks the complete execution lifecycle with full observability.
 */

export const WorkflowExecutionSchema = z.object({
  id: z.string().describe('Unique execution identifier'),
  workflowId: z.string().describe('Workflow definition ID'),
  workflowVersion: z.number().describe('Workflow version executed'),
  
  // Tenant scope
  organizationId: z.string().describe('Organization ID'),
  subOrganizationId: z.string().optional().describe('Sub-organization ID'),
  
  // Execution context
  inputPayload: z.record(z.unknown()).describe('Input data provided to workflow'),
  outputPayload: z.record(z.unknown()).optional().describe('Final output from workflow'),
  
  // Status tracking
  status: z.enum([
    'pending',      // Queued but not started
    'running',      // Currently executing
    'completed',    // Successfully completed
    'failed',       // Failed with error
    'timeout',      // Exceeded max execution time
    'cancelled',    // Manually cancelled
  ]).default('pending'),
  
  // Error tracking
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    stepId: z.string().optional().describe('Step where error occurred'),
    stack: z.string().optional(),
  }).optional(),
  
  // Timing
  startedAt: z.date().optional().describe('Execution start time'),
  completedAt: z.date().optional().describe('Execution completion time'),
  durationMs: z.number().optional().describe('Total execution duration'),
  
  // Step execution tracking
  stepExecutions: z.array(z.object({
    stepId: z.string(),
    stepType: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    input: z.record(z.unknown()).optional(),
    output: z.record(z.unknown()).optional(),
    error: z.string().optional(),
    startedAt: z.date().optional(),
    completedAt: z.date().optional(),
    durationMs: z.number().optional(),
    retryCount: z.number().default(0),
  })).default([]),
  
  // Metadata
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date().describe('Execution creation timestamp'),
  
  // Execution metrics
  metrics: z.object({
    stepsExecuted: z.number().default(0),
    llmCallCount: z.number().default(0),
    ragQueryCount: z.number().default(0),
    totalTokensUsed: z.number().default(0),
  }).optional(),
});

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema> & {
  steps?: StepExecution[];
  output?: Record<string, unknown>;
  input?: Record<string, unknown>;  
  executionId?: string;
  startTime?: Date;
  endTime?: Date;
};

/**
 * StepExecution - Individual step execution record
 */
export type StepExecution = WorkflowExecution['stepExecutions'][number];

/**
 * ExecutionLog Model
 * Structured log entry for workflow execution analysis and debugging.
 * Lightweight view of execution for monitoring and analytics.
 */

export const ExecutionLogSchema = z.object({
  id: z.string().describe('Unique log entry identifier'),
  executionId: z.string().describe('Reference to WorkflowExecution'),
  workflowId: z.string(),
  workflowVersion: z.number(),
  organizationId: z.string(),
  subOrganizationId: z.string().optional(),
  
  // Log entry details
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  message: z.string().describe('Log message'),
  stepId: z.string().optional().describe('Step context if applicable'),
  
  // Structured data
  data: z.record(z.unknown()).optional().describe('Structured log data'),
  
  // Timing
  timestamp: z.date().describe('Log entry timestamp'),
  
  // Performance tracking
  performance: z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
  }).optional(),
});

export type ExecutionLog = z.infer<typeof ExecutionLogSchema>;

/**
 * Factory function for creating new workflow executions
 */
export function createWorkflowExecution(
  workflowId: string,
  workflowVersion: number,
  organizationId: string,
  inputPayload: Record<string, unknown>,
  subOrganizationId?: string
): WorkflowExecution {
  const execution = WorkflowExecutionSchema.parse({
    id: generateId('exec'),
    workflowId,
    workflowVersion,
    organizationId,
    subOrganizationId,
    inputPayload,
    status: 'pending',
    stepExecutions: [],
    createdAt: new Date(),
    metrics: {
      stepsExecuted: 0,
      llmCallCount: 0,
      ragQueryCount: 0,
      totalTokensUsed: 0,
    },
  });
  
  // Add backward compatibility aliases
  const exec = execution as WorkflowExecution;
  exec.steps = execution.stepExecutions;
  exec.output = execution.outputPayload;
  exec.input = execution.inputPayload;
  exec.executionId = execution.id;
  exec.startTime = execution.startedAt;
  exec.endTime = execution.completedAt;
  return exec;
}

/**
 * Factory function for creating execution log entries
 */
export function createExecutionLog(
  executionId: string,
  workflowId: string,
  workflowVersion: number,
  organizationId: string,
  message: string,
  level: 'debug' | 'info' | 'warn' | 'error' = 'info',
  data?: Record<string, unknown>
): ExecutionLog {
  return ExecutionLogSchema.parse({
    id: generateId('log'),
    executionId,
    workflowId,
    workflowVersion,
    organizationId,
    level,
    message,
    data,
    timestamp: new Date(),
  });
}

/**
 * Helper to add a step execution record
 */
export function addStepExecution(
  execution: WorkflowExecution,
  stepId: string,
  stepType: string
): void {
  const stepExecution: StepExecution = {
    stepId,
    stepType,
    status: 'pending',
    retryCount: 0,
  };
  
  execution.stepExecutions.push(stepExecution);
  
  // Update alias if it exists
  if ((execution as unknown as { steps?: StepExecution[] }).steps !== undefined) {
    (execution as unknown as { steps: StepExecution[] }).steps = execution.stepExecutions;
  }
}

/**
 * Helper to update a step execution status
 */
export function updateStepExecution(
  execution: WorkflowExecution,
  stepId: string,
  updates: Partial<StepExecution>
): void {
  const index = execution.stepExecutions.findIndex((se: StepExecution) => se.stepId === stepId);
  if (index !== -1 && execution.stepExecutions[index]) {
    Object.assign(execution.stepExecutions[index]!, updates);
    
    // Update alias if it exists
    if ((execution as unknown as { steps?: StepExecution[] }).steps !== undefined) {
      (execution as unknown as { steps: StepExecution[] }).steps = execution.stepExecutions;
    }
  }
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
