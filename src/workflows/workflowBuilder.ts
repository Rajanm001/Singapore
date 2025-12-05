/**
 * Workflow Builder
 * Programmatic workflow construction and validation
 */

import type { Workflow } from '../models/workflow.ts';
import type { WorkflowStep, StepType } from '../models/workflowStep.ts';
import { WorkflowValidator } from './workflowValidator.ts';
import { nanoid } from 'nanoid';

export class WorkflowBuilder {
  private workflow: Partial<Workflow>;
  private steps: WorkflowStep[] = [];
  private validator = new WorkflowValidator();

  constructor(name: string, organizationId: string) {
    this.workflow = {
      id: `wf_${nanoid(10)}`,
      organizationId,
      name,
      version: 1,
      isLatest: true,
      steps: [],
      maxSteps: 100,
      status: 'draft' as Workflow['status'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Set workflow description
   */
  setDescription(description: string): this {
    this.workflow.description = description;
    return this;
  }

  /**
   * Set sub-organization
   */
  setSubOrganization(subOrgId: string): this {
    this.workflow.subOrganizationId = subOrgId;
    return this;
  }

  /**
   * Set entry step
   */
  setEntryStep(stepId: string): this {
    this.workflow.entryStepId = stepId;
    return this;
  }

  /**
   * Set max steps
   */
  setMaxSteps(maxSteps: number): this {
    this.workflow.maxSteps = maxSteps;
    return this;
  }

  /**
   * Set max execution time
   */
  setMaxExecutionTime(timeoutMs: number): this {
    this.workflow.maxExecutionTimeMs = timeoutMs;
    return this;
  }

  /**
   * Add tags
   */
  addTags(...tags: string[]): this {
    this.workflow.tags = [...(this.workflow.tags || []), ...tags];
    return this;
  }

  /**
   * Add metadata
   */
  addMetadata(key: string, value: unknown): this {
    if (!this.workflow.metadata) {
      this.workflow.metadata = {};
    }
    this.workflow.metadata[key] = value;
    return this;
  }

  /**
   * Add a RAG step
   */
  addRAGStep(config: {
    id: string;
    label: string;
    collectionId: string;
    query: string;
    topK?: number;
    minScore?: number;
    nextStepId?: string;
  }): this {
    const step: WorkflowStep = {
      id: config.id,
      type: 'RAG' as StepType,
      label: config.label,
      params: {
        collectionId: config.collectionId,
        query: config.query,
        topK: config.topK || 5,
        minScore: config.minScore,
      },
      nextStepId: config.nextStepId,
    };

    this.steps.push(step);
    return this;
  }

  /**
   * Add an LLM step
   */
  addLLMStep(config: {
    id: string;
    label: string;
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    nextStepId?: string;
  }): this {
    const step: WorkflowStep = {
      id: config.id,
      type: 'LLM' as StepType,
      label: config.label,
      params: {
        prompt: config.prompt,
        model: config.model || 'gpt-4',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens || 1000,
        systemPrompt: config.systemPrompt,
      },
      nextStepId: config.nextStepId,
    };

    this.steps.push(step);
    return this;
  }

  /**
   * Add a CONDITION step
   */
  addConditionStep(config: {
    id: string;
    label: string;
    expression: string;
    onTrue: string;
    onFalse: string;
  }): this {
    const step: WorkflowStep = {
      id: config.id,
      type: 'CONDITION' as StepType,
      label: config.label,
      params: {
        expression: config.expression,
      },
      onSuccess: config.onTrue,
      onFailure: config.onFalse,
    };

    this.steps.push(step);
    return this;
  }

  /**
   * Add an API_CALL step
   */
  addAPICallStep(config: {
    id: string;
    label: string;
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    nextStepId?: string;
  }): this {
    const step: WorkflowStep = {
      id: config.id,
      type: 'API_CALL' as StepType,
      label: config.label,
      params: {
        url: config.url,
        method: config.method,
        headers: config.headers,
        body: config.body,
      },
      nextStepId: config.nextStepId,
    };

    this.steps.push(step);
    return this;
  }

  /**
   * Add a custom step
   */
  addStep(step: WorkflowStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Add retry configuration to last step
   */
  withRetry(maxAttempts: number, backoffMs: number = 1000): this {
    const lastStep = this.steps[this.steps.length - 1];
    if (lastStep) {
      lastStep.retry = { maxAttempts, backoffMs };
    }
    return this;
  }

  /**
   * Add timeout to last step
   */
  withTimeout(timeoutMs: number): this {
    const lastStep = this.steps[this.steps.length - 1];
    if (lastStep) {
      lastStep.timeoutMs = timeoutMs;
    }
    return this;
  }

  /**
   * Add error handler to last step
   */
  withErrorHandler(onFailure: string): this {
    const lastStep = this.steps[this.steps.length - 1];
    if (lastStep) {
      lastStep.onFailure = onFailure;
    }
    return this;
  }

  /**
   * Build and validate workflow
   */
  build(): Workflow {
    this.workflow.steps = this.steps;

    // Set entry step if not set
    if (!this.workflow.entryStepId && this.steps.length > 0) {
      this.workflow.entryStepId = this.steps[0]!.id;
    }

    const workflow = this.workflow as Workflow;

    // Validate
    const validationResult = this.validator.validate(workflow);
    if (!validationResult.isValid) {
      throw new Error(
        `Workflow validation failed:\n${validationResult.errors.join('\n')}`
      );
    }

    return workflow;
  }

  /**
   * Build without validation (useful for testing)
   */
  buildUnsafe(): Workflow {
    this.workflow.steps = this.steps;

    if (!this.workflow.entryStepId && this.steps.length > 0) {
      this.workflow.entryStepId = this.steps[0]!.id;
    }

    return this.workflow as Workflow;
  }

  /**
   * Create a refund policy workflow (example)
   */
  static createRefundPolicyWorkflow(
    organizationId: string,
    collectionId: string
  ): Workflow {
    return new WorkflowBuilder('Refund Policy Q&A', organizationId)
      .setDescription('Answer customer questions about refund policy')
      .addTags('customer-service', 'refunds', 'q&a')
      .addRAGStep({
        id: 's01_search',
        label: 'Search Policy',
        collectionId,
        query: '{{input.question}}',
        topK: 3,
        nextStepId: 's02_generate',
      })
      .withRetry(2, 500)
      .addLLMStep({
        id: 's02_generate',
        label: 'Generate Answer',
        prompt: `Based on the following policy information, answer the customer's question:

Policy Context:
{{steps.s01_search.output.results}}

Customer Question:
{{input.question}}

Provide a clear, helpful answer.`,
        model: 'gpt-4',
        temperature: 0.7,
        nextStepId: 's03_check_confidence',
      })
      .withRetry(3, 1000)
      .addConditionStep({
        id: 's03_check_confidence',
        label: 'Check Confidence',
        expression: 'steps.s01_search.output.results[0].score > 0.7',
        onTrue: 's04_respond',
        onFalse: 's05_escalate',
      })
      .addLLMStep({
        id: 's04_respond',
        label: 'Respond with Answer',
        prompt: '{{steps.s02_generate.output.text}}',
        model: 'gpt-4',
        temperature: 0.5,
      })
      .addLLMStep({
        id: 's05_escalate',
        label: 'Escalate to Human',
        prompt: `I don't have enough information to answer this question confidently. 

Question: {{input.question}}

This should be escalated to a human agent.`,
        model: 'gpt-4',
        temperature: 0.5,
      })
      .setMaxSteps(10)
      .setMaxExecutionTime(30000)
      .build();
  }

  /**
   * Create a troubleshooting workflow (example)
   */
  static createTroubleshootingWorkflow(
    organizationId: string,
    collectionId: string
  ): Workflow {
    return new WorkflowBuilder('Technical Troubleshooting', organizationId)
      .setDescription('Help users troubleshoot technical issues')
      .addTags('support', 'troubleshooting', 'technical')
      .addRAGStep({
        id: 's01_search_kb',
        label: 'Search Knowledge Base',
        collectionId,
        query: '{{input.problem}}',
        topK: 5,
        nextStepId: 's02_analyze',
      })
      .withRetry(2)
      .addLLMStep({
        id: 's02_analyze',
        label: 'Analyze Problem',
        prompt: `Analyze this technical issue:

Problem: {{input.problem}}

Related Documentation:
{{steps.s01_search_kb.output.results}}

Provide:
1. Root cause analysis
2. Step-by-step solution
3. Prevention tips`,
        model: 'gpt-4',
        temperature: 0.3,
        nextStepId: 's03_check_severity',
      })
      .addConditionStep({
        id: 's03_check_severity',
        label: 'Check Severity',
        expression: 'input.severity === "critical"',
        onTrue: 's04_urgent_escalation',
        onFalse: 's05_provide_solution',
      })
      .addAPICallStep({
        id: 's04_urgent_escalation',
        label: 'Urgent Escalation',
        url: 'https://api.example.com/escalations',
        method: 'POST',
        body: {
          problem: '{{input.problem}}',
          analysis: '{{steps.s02_analyze.output.text}}',
          severity: 'critical',
        },
      })
      .addLLMStep({
        id: 's05_provide_solution',
        label: 'Provide Solution',
        prompt: '{{steps.s02_analyze.output.text}}',
        model: 'gpt-4',
        temperature: 0.5,
      })
      .setMaxSteps(15)
      .build();
  }

  /**
   * Clone a workflow
   */
  static clone(workflow: Workflow, newName: string): WorkflowBuilder {
    const builder = new WorkflowBuilder(newName, workflow.organizationId);
    
    builder.workflow = {
      ...workflow,
      id: `wf_${nanoid(10)}`,
      name: newName,
      version: 1,
      isLatest: true,
      parentVersionId: workflow.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    builder.steps = workflow.steps.map(step => ({ ...step }));

    return builder;
  }

  /**
   * Export workflow as JSON
   */
  toJSON(): string {
    const workflow = this.buildUnsafe();
    return JSON.stringify(workflow, null, 2);
  }

  /**
   * Import workflow from JSON
   */
  static fromJSON(json: string): WorkflowBuilder {
    const workflow = JSON.parse(json) as Workflow;
    const builder = new WorkflowBuilder(workflow.name, workflow.organizationId);
    
    builder.workflow = workflow;
    builder.steps = workflow.steps;

    return builder;
  }
}
