/**
 * Custom error classes for the Knowledge & Workflow Engine
 */

/**
 * Base error class for all workflow engine errors
 */
export class WorkflowEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowEngineError';
    Object.setPrototypeOf(this, WorkflowEngineError.prototype);
  }
}

/**
 * Workflow validation errors
 */
export class WorkflowValidationError extends WorkflowEngineError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'WORKFLOW_VALIDATION_ERROR', details);
    this.name = 'WorkflowValidationError';
    Object.setPrototypeOf(this, WorkflowValidationError.prototype);
  }
}

/**
 * Step execution errors
 */
export class StepExecutionError extends WorkflowEngineError {
  constructor(
    message: string,
    public stepId: string,
    public stepType: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'STEP_EXECUTION_ERROR', { ...details, stepId, stepType });
    this.name = 'StepExecutionError';
    Object.setPrototypeOf(this, StepExecutionError.prototype);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends WorkflowEngineError {
  constructor(message: string, public timeoutMs: number) {
    super(message, 'TIMEOUT_ERROR', { timeoutMs });
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Template resolution errors
 */
export class TemplateResolutionError extends WorkflowEngineError {
  constructor(message: string, public template: string, details?: Record<string, unknown>) {
    super(message, 'TEMPLATE_RESOLUTION_ERROR', { ...details, template });
    this.name = 'TemplateResolutionError';
    Object.setPrototypeOf(this, TemplateResolutionError.prototype);
  }
}

/**
 * Expression evaluation errors
 */
export class ExpressionEvaluationError extends WorkflowEngineError {
  constructor(message: string, public expression: string, details?: Record<string, unknown>) {
    super(message, 'EXPRESSION_EVALUATION_ERROR', { ...details, expression });
    this.name = 'ExpressionEvaluationError';
    Object.setPrototypeOf(this, ExpressionEvaluationError.prototype);
  }
}

/**
 * Resource not found errors
 */
export class ResourceNotFoundError extends WorkflowEngineError {
  constructor(
    message: string,
    public resourceType: string,
    public resourceId: string
  ) {
    super(message, 'RESOURCE_NOT_FOUND', { resourceType, resourceId });
    this.name = 'ResourceNotFoundError';
    Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
  }
}

/**
 * Authorization errors
 */
export class AuthorizationError extends WorkflowEngineError {
  constructor(
    message: string,
    public organizationId: string,
    public resourceType: string,
    public resourceId: string
  ) {
    super(message, 'AUTHORIZATION_ERROR', { organizationId, resourceType, resourceId });
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends WorkflowEngineError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}
