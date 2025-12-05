import { z } from 'zod';
import { WorkflowStepSchema, type WorkflowStep } from './workflowStep.ts';

/**
 * Workflow Model
 * Represents a complete workflow definition with versioning and metadata.
 * Workflows are the core orchestration unit for building digital assistants.
 */

export const WorkflowSchema = z.object({
  id: z.string().describe('Unique workflow identifier'),
  organizationId: z.string().describe('Owner organization ID'),
  subOrganizationId: z.string().optional().describe('Optional sub-org scope'),
  
  // Identity
  name: z.string().min(1).describe('Workflow name'),
  description: z.string().optional().describe('Workflow description'),
  
  // Version management
  version: z.number().min(1).default(1).describe('Workflow version (semantic)'),
  versionLabel: z.string().optional().describe('Human-readable version label (e.g., "v1.0.0")'),
  isLatest: z.boolean().default(true).describe('Is this the latest version?'),
  parentVersionId: z.string().optional().describe('Previous version ID for history tracking'),
  
  // Workflow configuration
  entryStepId: z.string().describe('ID of the first step to execute'),
  steps: z.array(WorkflowStepSchema).min(1).describe('Ordered list of workflow steps'),
  
  // Input/Output schema
  inputSchema: z.record(z.unknown()).optional().describe('Expected input payload schema'),
  outputSchema: z.record(z.unknown()).optional().describe('Expected output schema'),
  
  // Metadata
  metadata: z.record(z.unknown()).optional().describe('Flexible metadata'),
  tags: z.array(z.string()).optional().describe('Searchable tags'),
  
  // Execution constraints
  maxExecutionTimeMs: z.number().optional().describe('Maximum workflow execution time'),
  maxSteps: z.number().default(100).describe('Maximum steps to prevent infinite loops'),
  
  // Lifecycle
  status: z.enum(['draft', 'active', 'deprecated', 'archived']).default('draft'),
  createdAt: z.union([z.date(), z.string().transform((s) => new Date(s))]).describe('Creation timestamp'),
  updatedAt: z.union([z.date(), z.string().transform((s) => new Date(s))]).describe('Last update timestamp'),
  createdBy: z.string().optional().describe('User ID who created the workflow'),
  
  // Statistics (updated asynchronously)
  stats: z.object({
    executionCount: z.number().default(0),
    successRate: z.number().min(0).max(1).optional(),
    avgExecutionTimeMs: z.number().optional(),
  }).optional(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

/**
 * Workflow validation result
 */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Factory function for creating new workflows
 */
export function createWorkflow(
  data: Omit<Workflow, 'id' | 'version' | 'isLatest' | 'createdAt' | 'updatedAt' | 'status'>
): Workflow {
  return WorkflowSchema.parse({
    ...data,
    id: generateId('wf'),
    version: 1,
    isLatest: true,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    stats: {
      executionCount: 0,
    },
  });
}

/**
 * Create a new version of an existing workflow
 */
export function createWorkflowVersion(
  baseWorkflow: Workflow,
  updates: Partial<Pick<Workflow, 'name' | 'description' | 'steps' | 'entryStepId' | 'metadata'>>
): Workflow {
  return WorkflowSchema.parse({
    ...baseWorkflow,
    ...updates,
    id: generateId('wf'),
    version: baseWorkflow.version + 1,
    versionLabel: `v${baseWorkflow.version + 1}.0.0`,
    isLatest: true,
    parentVersionId: baseWorkflow.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    stats: {
      executionCount: 0,
    },
  });
}

/**
 * Helper to find a step by ID within a workflow
 */
export function findStepById(workflow: Workflow, stepId: string): WorkflowStep | undefined {
  return workflow.steps.find((step: WorkflowStep) => step.id === stepId);
}

/**
 * Helper to get all step IDs in a workflow
 */
export function getAllStepIds(workflow: Workflow): string[] {
  return workflow.steps.map((step: WorkflowStep) => step.id);
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
