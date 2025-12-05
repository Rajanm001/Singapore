import { z } from 'zod';

/**
 * StepType Enumeration
 * Defines all supported workflow step types.
 * Extensible: add new types here and implement corresponding handlers.
 */
export const StepTypeSchema = z.enum([
  'RAG',           // Retrieve chunks from knowledge collection
  'LLM',           // Call LLM with prompt template
  'CONDITION',     // Conditional branching (if/else)
  'API_CALL',      // External API call
  'TRANSFORM',     // Data transformation
  'LOOP',          // Iterate over array
  'PARALLEL',      // Execute multiple steps in parallel
  'MEMORY',        // Store/retrieve conversation memory
]);

export type StepType = z.infer<typeof StepTypeSchema>;

/**
 * WorkflowStep Model
 * Represents a single step in a workflow execution pipeline.
 * Each step has a type-specific parameter schema and execution logic.
 */

export const WorkflowStepSchema = z.object({
  id: z.string().describe('Unique step identifier within workflow'),
  type: StepTypeSchema.describe('Step type determining handler logic'),
  label: z.string().describe('Human-readable step label'),
  description: z.string().optional().describe('Detailed step description'),
  
  // Execution configuration
  params: z.record(z.unknown()).describe('Type-specific parameters (validated by handler)'),
  
  // Flow control
  nextStepId: z.string().optional().describe('Next step to execute (for linear flow)'),
  onSuccess: z.string().optional().describe('Step to execute on success (conditional)'),
  onFailure: z.string().optional().describe('Step to execute on failure (error handling)'),
  
  // Conditional execution
  condition: z.string().optional().describe('Expression that must be true to execute this step'),
  
  // Retry configuration
  retry: z.object({
    maxAttempts: z.number().min(1).default(1),
    backoffMs: z.number().min(0).default(1000),
  }).optional(),
  retryConfig: z.object({
    maxAttempts: z.number().min(1).default(1),
    delayMs: z.number().min(0).default(1000),
  }).optional().describe('Alias for retry (backward compatibility)'),
  
  // Timeout
  timeoutMs: z.number().optional().describe('Max execution time in milliseconds'),
  
  // Metadata
  metadata: z.record(z.unknown()).optional().describe('Additional metadata for observability'),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/**
 * Step Parameter Schemas
 * Type-specific parameter validation for each step type.
 */

// RAG Step Parameters
export const RAGStepParamsSchema = z.object({
  collectionId: z.string().describe('Knowledge collection to search'),
  query: z.string().describe('Search query (supports template variables)'),
  topK: z.number().min(1).default(5).describe('Number of chunks to retrieve'),
  minScore: z.number().min(0).max(1).optional().describe('Minimum similarity score threshold'),
  filters: z.record(z.unknown()).optional().describe('Metadata filters'),
});

export type RAGStepParams = z.infer<typeof RAGStepParamsSchema>;

// LLM Step Parameters
export const LLMStepParamsSchema = z.object({
  model: z.string().describe('LLM model identifier'),
  prompt: z.string().describe('Prompt template (supports template variables)'),
  systemPrompt: z.string().optional().describe('System prompt'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).optional(),
  stopSequences: z.array(z.string()).optional(),
});

export type LLMStepParams = z.infer<typeof LLMStepParamsSchema>;

// Condition Step Parameters
export const ConditionStepParamsSchema = z.object({
  expression: z.string().describe('Boolean expression to evaluate'),
  onTrue: z.string().describe('Step ID to execute if true'),
  onFalse: z.string().optional().describe('Step ID to execute if false'),
});

export type ConditionStepParams = z.infer<typeof ConditionStepParamsSchema>;

// API Call Step Parameters
export const APICallStepParamsSchema = z.object({
  url: z.string().url().describe('API endpoint URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional().describe('Request body (supports template variables)'),
  auth: z.object({
    type: z.enum(['none', 'bearer', 'basic', 'api-key']),
    credentials: z.record(z.string()).optional(),
  }).optional(),
});

export type APICallStepParams = z.infer<typeof APICallStepParamsSchema>;

/**
 * Validation helper to get the appropriate param schema for a step type
 */
export function getParamSchemaForStepType(type: StepType): z.ZodSchema {
  const schemaMap: Record<StepType, z.ZodSchema> = {
    RAG: RAGStepParamsSchema,
    LLM: LLMStepParamsSchema,
    CONDITION: ConditionStepParamsSchema,
    API_CALL: APICallStepParamsSchema,
    TRANSFORM: z.record(z.unknown()), // Flexible schema for now
    LOOP: z.record(z.unknown()),
    PARALLEL: z.record(z.unknown()),
    MEMORY: z.record(z.unknown()),
  };
  
  return schemaMap[type] || z.record(z.unknown());
}

/**
 * Factory function for creating workflow steps
 */
export function createWorkflowStep(data: Omit<WorkflowStep, never>): WorkflowStep {
  return WorkflowStepSchema.parse(data);
}
