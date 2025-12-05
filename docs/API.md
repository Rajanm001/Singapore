# API Documentation

> API reference for the Knowledge & Workflow Engine

Interfaces, classes, and methods for integrating with and extending the platform.

---

## 📋 Table of Contents

1. [Workflow API](#workflow-api)
2. [Step Handlers API](#step-handlers-api)
3. [Services API](#services-api)
4. [Models & Types](#models--types)
5. [Utilities](#utilities)
6. [Extension Guide](#extension-guide)

---

## Workflow API

### WorkflowExecutor

Core engine for executing workflows with full observability and error handling.

#### Constructor

```typescript
constructor(stepRegistry: StepRegistry)
```

**Parameters:**
- `stepRegistry`: Registry containing registered step handlers

**Example:**
```typescript
import { WorkflowExecutor } from './src/workflows/workflowExecutor.ts';
import { globalStepRegistry } from './src/workflows/stepRegistry.ts';

const executor = new WorkflowExecutor(globalStepRegistry);
```

#### Methods

##### `execute()`

Execute a workflow with input parameters.

```typescript
async execute(
  workflow: Workflow,
  organizationId: string,
  inputPayload?: Record<string, unknown>
): Promise<WorkflowExecution>
```

**Parameters:**
- `workflow`: Workflow configuration object
- `organizationId`: Organization ID for tenant isolation
- `inputPayload`: Optional input parameters

**Returns:** `WorkflowExecution` object with status, output, and execution history

**Example:**
```typescript
const execution = await executor.execute(
  workflow,
  'org_demo',
  { question: 'What is your refund policy?' }
);

console.log('Status:', execution.status);
console.log('Output:', execution.outputPayload);
console.log('Duration:', execution.executionDurationMs, 'ms');
```

**Error Handling:**
```typescript
try {
  const execution = await executor.execute(workflow, 'org_123', input);
  
  if (execution.status === 'failed') {
    console.error('Workflow failed:', execution.error);
  } else {
    console.log('Success:', execution.outputPayload);
  }
} catch (error) {
  console.error('Execution error:', error);
}
```

---

### StepRegistry

Registry for managing step type handlers.

#### Constructor

```typescript
constructor()
```

#### Methods

##### `register()`

Register a handler for a specific step type.

```typescript
register(stepType: string, handler: StepHandler): void
```

**Parameters:**
- `stepType`: Unique identifier for the step type (e.g., 'RAG', 'LLM')
- `handler`: Handler instance implementing `StepHandler` interface

**Example:**
```typescript
import { globalStepRegistry } from './src/workflows/stepRegistry.ts';
import { RAGStepHandler } from './src/workflows/handlers/ragStepHandler.ts';

globalStepRegistry.register('RAG', new RAGStepHandler(retrievalService));
```

##### `get()`

Retrieve a registered handler by step type.

```typescript
get(stepType: string): StepHandler
```

**Returns:** Handler for the specified step type

**Throws:** Error if step type is not registered

**Example:**
```typescript
const handler = globalStepRegistry.get('RAG');
```

##### `has()`

Check if a step type is registered.

```typescript
has(stepType: string): boolean
```

**Returns:** `true` if registered, `false` otherwise

**Example:**
```typescript
if (!globalStepRegistry.has('CUSTOM_STEP')) {
  throw new Error('Custom step handler not registered');
}
```

---

### WorkflowValidator

Validates workflow configurations for correctness and safety.

#### Methods

##### `validate()`

Validate a workflow configuration.

```typescript
static validate(workflow: Workflow): ValidationResult
```

**Parameters:**
- `workflow`: Workflow object to validate

**Returns:** `ValidationResult` with `isValid` flag and `errors` array

**Example:**
```typescript
import { WorkflowValidator } from './src/workflows/workflowValidator.ts';

const result = WorkflowValidator.validate(workflow);

if (!result.isValid) {
  console.error('Validation errors:', result.errors);
  result.errors.forEach(error => {
    console.log(`- ${error.message} (${error.path})`);
  });
}
```

**Validation Checks:**
- Step ID uniqueness
- Start step existence
- Step reference validity
- Circular dependency detection
- Unreachable step detection
- Required field presence

---

## Step Handlers API

### StepHandler Interface

Base interface all step handlers must implement.

```typescript
interface StepHandler {
  execute(
    step: WorkflowStep,
    context: ExecutionContext
  ): Promise<StepExecutionResult>;
}
```

---

### RAGStepHandler

Handler for Retrieval-Augmented Generation steps.

#### Constructor

```typescript
constructor(retrievalService: RetrievalService)
```

**Parameters:**
- `retrievalService`: Service for performing semantic search

#### Methods

##### `execute()`

Execute a RAG step to retrieve relevant documents.

```typescript
async execute(
  step: WorkflowStep,
  context: ExecutionContext
): Promise<StepExecutionResult>
```

**Step Configuration:**
```json
{
  "id": "retrieve_policy",
  "type": "RAG",
  "config": {
    "collectionId": "policy_docs",
    "queryTemplate": "{{question}}",
    "topK": 5,
    "minSimilarity": 0.7,
    "outputVariable": "retrieved_docs"
  }
}
```

**Output Format:**
```typescript
{
  status: 'success',
  output: {
    retrieved_docs: {
      documents: [
        { id: 'doc1', content: '...', metadata: {...}, score: 0.95 },
        { id: 'doc2', content: '...', metadata: {...}, score: 0.89 }
      ],
      count: 2
    }
  },
  metadata: {
    durationMs: 150,
    tokensUsed: 0
  }
}
```

**Example:**
```typescript
import { RAGStepHandler } from './src/workflows/handlers/ragStepHandler.ts';
import { MemoryRetrievalService } from './src/services/retrieval/memoryRetrievalService.ts';

const retrievalService = new MemoryRetrievalService();
const handler = new RAGStepHandler(retrievalService);

const result = await handler.execute(step, context);
console.log('Retrieved documents:', result.output.retrieved_docs);
```

---

### LLMStepHandler

Handler for Large Language Model inference steps.

#### Constructor

```typescript
constructor(llmService: LLMService)
```

**Parameters:**
- `llmService`: Service for LLM completion calls

#### Methods

##### `execute()`

Execute an LLM step to generate text.

```typescript
async execute(
  step: WorkflowStep,
  context: ExecutionContext
): Promise<StepExecutionResult>
```

**Step Configuration:**
```json
{
  "id": "generate_answer",
  "type": "LLM",
  "config": {
    "model": "gpt-4",
    "promptTemplate": "Answer: {{question}}\\n\\nContext: {{retrieved_docs}}",
    "temperature": 0.7,
    "maxTokens": 500,
    "outputVariable": "answer"
  }
}
```

**Output Format:**
```typescript
{
  status: 'success',
  output: {
    answer: "Based on our policy, you can request a refund within 30 days..."
  },
  metadata: {
    durationMs: 1200,
    tokensUsed: 450,
    model: 'gpt-4'
  }
}
```

---

### ConditionStepHandler

Handler for conditional branching logic.

#### Constructor

```typescript
constructor()
```

#### Methods

##### `execute()`

Evaluate a condition and determine next step.

```typescript
async execute(
  step: WorkflowStep,
  context: ExecutionContext
): Promise<StepExecutionResult>
```

**Step Configuration:**
```json
{
  "id": "check_confidence",
  "type": "CONDITION",
  "config": {
    "condition": "confidence > 0.8",
    "trueStepId": "format_answer",
    "falseStepId": "escalate",
    "outputVariable": "branch_result"
  }
}
```

**Output Format:**
```typescript
{
  status: 'success',
  output: {
    conditionMet: true,
    result: true,
    nextStepIdOverride: 'format_answer'
  },
  metadata: {
    durationMs: 5,
    condition: 'confidence > 0.8',
    evaluatedTo: true
  }
}
```

**Supported Operators:**
- Comparison: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Logical: `&&`, `||`, `!`
- String: `contains`, `startsWith`, `endsWith`
- Existence: `exists`, `isEmpty`

**Example Conditions:**
```typescript
// Numeric comparison
"confidence > 0.8"

// String matching
"status == 'approved'"

// Logical operators
"confidence > 0.8 && attempts < 3"

// Existence checks
"exists(user.email)"

// String functions
"contains(message, 'urgent')"
```

---

## Services API

### RetrievalService Interface

Interface for vector database and semantic search services.

```typescript
interface RetrievalService {
  retrieve(
    collectionId: string,
    organizationId: string,
    query: string,
    options?: RetrievalOptions
  ): Promise<RetrievalResult>;
}
```

#### Methods

##### `retrieve()`

Perform semantic search to retrieve relevant documents.

**Parameters:**
- `collectionId`: Knowledge collection identifier
- `organizationId`: Organization ID for tenant isolation
- `query`: Search query text
- `options`: Optional configuration (topK, minSimilarity, filters)

**Returns:** `RetrievalResult` with documents and scores

**Example:**
```typescript
const result = await retrievalService.retrieve(
  'policy_docs',
  'org_123',
  'What is the refund policy?',
  { topK: 5, minSimilarity: 0.7 }
);

console.log(`Found ${result.documents.length} documents`);
result.documents.forEach(doc => {
  console.log(`- ${doc.id}: ${doc.score.toFixed(2)}`);
});
```

---

### LLMService Interface

Interface for Large Language Model services.

```typescript
interface LLMService {
  complete(
    prompt: string,
    options?: LLMOptions
  ): Promise<LLMResult>;
}
```

#### Methods

##### `complete()`

Generate text completion from prompt.

**Parameters:**
- `prompt`: Input prompt text
- `options`: Optional configuration (model, temperature, maxTokens)

**Returns:** `LLMResult` with generated text and metadata

**Example:**
```typescript
const result = await llmService.complete(
  "Summarize this document: ...",
  { 
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 500
  }
);

console.log('Generated text:', result.text);
console.log('Tokens used:', result.tokensUsed);
```

---

### MemoryRetrievalService

In-memory implementation of `RetrievalService` for testing.

#### Constructor

```typescript
constructor()
```

#### Methods

##### `addDocument()`

Add document to in-memory collection.

```typescript
addDocument(
  collectionId: string,
  organizationId: string,
  document: Document
): void
```

**Example:**
```typescript
const service = new MemoryRetrievalService();

service.addDocument('policy_docs', 'org_123', {
  id: 'doc_1',
  content: 'Refund policy: You can request refunds within 30 days...',
  metadata: { category: 'policy', version: '1.0' }
});
```

---

## Models & Types

### Workflow

Main workflow configuration structure.

```typescript
interface Workflow {
  id: string;
  version: number;
  name: string;
  description: string;
  organizationId: string;
  startStepId: string;
  steps: WorkflowStep[];
  maxExecutionTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Example:**
```typescript
const workflow: Workflow = {
  id: 'refund_policy_v1',
  version: 1,
  name: 'Refund Policy Assistant',
  description: 'Answers customer refund questions',
  organizationId: 'org_demo',
  startStepId: 'retrieve_policy',
  steps: [...],
  maxExecutionTimeMs: 30000,
  createdAt: new Date(),
  updatedAt: new Date()
};
```

---

### WorkflowStep

Individual step configuration within a workflow.

```typescript
interface WorkflowStep {
  id: string;
  type: string;
  config: Record<string, unknown>;
  nextStepId?: string;
  onError?: {
    action: 'fail' | 'continue' | 'retry';
    retryConfig?: RetryConfig;
    fallbackStepId?: string;
  };
}
```

**Example:**
```typescript
const step: WorkflowStep = {
  id: 'generate_answer',
  type: 'LLM',
  config: {
    model: 'gpt-4',
    promptTemplate: 'Answer: {{question}}',
    maxTokens: 500
  },
  nextStepId: 'format_response',
  onError: {
    action: 'retry',
    retryConfig: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2
    }
  }
};
```

---

### WorkflowExecution

Execution result with status, output, and history.

```typescript
interface WorkflowExecution {
  id: string;
  workflowId: string;
  organizationId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  error?: string;
  executionDurationMs: number;
  stepExecutions: StepExecution[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Example:**
```typescript
const execution: WorkflowExecution = {
  id: 'exec_abc123',
  workflowId: 'refund_policy_v1',
  organizationId: 'org_demo',
  status: 'completed',
  inputPayload: { question: 'What is your refund policy?' },
  outputPayload: { answer: 'You can request refunds within 30 days...' },
  executionDurationMs: 2350,
  stepExecutions: [...],
  createdAt: new Date(),
  updatedAt: new Date()
};
```

---

### ExecutionContext

Runtime context available to step handlers.

```typescript
interface ExecutionContext {
  workflowId: string;
  executionId: string;
  organizationId: string;
  variables: Record<string, unknown>;
  logger: Logger;
  
  setVariable(name: string, value: unknown): void;
  getVariable(name: string): unknown;
  hasVariable(name: string): boolean;
}
```

**Example:**
```typescript
// Inside step handler
context.setVariable('confidence', 0.95);
const question = context.getVariable('question');

if (context.hasVariable('retrieved_docs')) {
  const docs = context.getVariable('retrieved_docs');
  // Use documents...
}
```

---

## Utilities

### Logger

Structured logger with levels and context.

#### Interface

```typescript
interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
  child(context: string): Logger;
}
```

#### Usage

```typescript
import { createLogger } from './src/utils/logger.ts';

// Create logger
const logger = createLogger('MyService', {
  minLevel: 'info',
  format: 'json',
  correlationId: 'req-123'
});

// Log messages
logger.info('Processing request', { userId: '123' });
logger.error('Failed to process', error, { attemptNumber: 3 });

// Create child logger
const childLogger = logger.child('SubComponent');
childLogger.debug('Detail message');
```

**Environment Configuration:**
```powershell
$env:LOG_LEVEL = "debug"     # debug | info | warn | error
$env:LOG_FORMAT = "json"     # text | json
```

---

### TemplateEngine

Safe variable substitution in strings.

#### Methods

##### `render()`

Replace template variables with values.

```typescript
static render(
  template: string,
  variables: Record<string, unknown>
): string
```

**Example:**
```typescript
import { TemplateEngine } from './src/utils/templateEngine.ts';

const template = "Hello {{name}}, your score is {{score}}!";
const variables = { name: 'Alice', score: 95 };

const result = TemplateEngine.render(template, variables);
console.log(result);  // "Hello Alice, your score is 95!"
```

**Nested Object Access:**
```typescript
const template = "User: {{user.name}}, Email: {{user.email}}";
const variables = { 
  user: { name: 'Bob', email: 'bob@example.com' }
};

const result = TemplateEngine.render(template, variables);
// "User: Bob, Email: bob@example.com"
```

---

### ExpressionEngine

Safe expression evaluation without `eval()`.

#### Methods

##### `evaluate()`

Evaluate boolean expression safely.

```typescript
static evaluate(
  expression: string,
  variables: Record<string, unknown>
): boolean
```

**Example:**
```typescript
import { ExpressionEngine } from './src/utils/expressionEngine.ts';

const expression = "confidence > 0.8 && attempts < 3";
const variables = { confidence: 0.95, attempts: 1 };

const result = ExpressionEngine.evaluate(expression, variables);
console.log(result);  // true
```

**Supported Expressions:**
```typescript
// Comparisons
ExpressionEngine.evaluate("score > 80", { score: 95 });  // true

// Logical operators
ExpressionEngine.evaluate("active && verified", { 
  active: true, 
  verified: true 
});  // true

// String functions
ExpressionEngine.evaluate("contains(message, 'urgent')", {
  message: 'urgent request'
});  // true

// Nested properties
ExpressionEngine.evaluate("user.age >= 18", {
  user: { age: 25 }
});  // true
```

---

## Extension Guide

### Creating Custom Step Handlers

**1. Implement `StepHandler` interface:**

```typescript
import { StepHandler, StepExecutionResult, WorkflowStep, ExecutionContext } from './types.ts';

export class CustomStepHandler implements StepHandler {
  async execute(
    step: WorkflowStep,
    context: ExecutionContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Extract configuration
      const { param1, param2 } = step.config;
      
      // Render templates
      const renderedParam = TemplateEngine.render(
        param1 as string,
        context.variables
      );
      
      // Perform custom logic
      const result = await this.customLogic(renderedParam);
      
      // Set output variable
      const outputVar = step.config.outputVariable as string;
      context.setVariable(outputVar, result);
      
      return {
        status: 'success',
        output: { [outputVar]: result },
        metadata: {
          durationMs: Date.now() - startTime
        }
      };
    } catch (error) {
      context.logger.error('Custom step failed', error as Error);
      
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        output: {},
        metadata: {
          durationMs: Date.now() - startTime
        }
      };
    }
  }
  
  private async customLogic(input: string): Promise<any> {
    // Your custom implementation
    return { processed: input };
  }
}
```

**2. Register the handler:**

```typescript
import { globalStepRegistry } from './src/workflows/stepRegistry.ts';

globalStepRegistry.register('CUSTOM', new CustomStepHandler());
```

**3. Use in workflows:**

```json
{
  "id": "custom_step",
  "type": "CUSTOM",
  "config": {
    "param1": "{{input_value}}",
    "param2": "some_config",
    "outputVariable": "custom_result"
  },
  "nextStepId": "next_step"
}
```

---

### Creating Custom Services

**1. Implement service interface:**

```typescript
import { RetrievalService, RetrievalResult, RetrievalOptions } from './types.ts';

export class CustomRetrievalService implements RetrievalService {
  async retrieve(
    collectionId: string,
    organizationId: string,
    query: string,
    options?: RetrievalOptions
  ): Promise<RetrievalResult> {
    // Connect to your vector database
    const results = await this.queryVectorDB(query, options);
    
    // Transform to standard format
    return {
      documents: results.map(r => ({
        id: r.id,
        content: r.text,
        metadata: r.metadata,
        score: r.similarity
      })),
      metadata: {
        totalCount: results.length,
        queryTime: results.queryTime
      }
    };
  }
  
  private async queryVectorDB(query: string, options?: RetrievalOptions) {
    // Your implementation
  }
}
```

**2. Inject into handlers:**

```typescript
const customRetrieval = new CustomRetrievalService();
const ragHandler = new RAGStepHandler(customRetrieval);

globalStepRegistry.register('RAG', ragHandler);
```

---

### Error Handling Best Practices

**1. Use typed errors:**

```typescript
export class WorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

throw new WorkflowError(
  'Failed to retrieve documents',
  'RETRIEVAL_ERROR',
  { collectionId, organizationId }
);
```

**2. Handle errors in step handlers:**

```typescript
async execute(step: WorkflowStep, context: ExecutionContext): Promise<StepExecutionResult> {
  try {
    // Step logic...
  } catch (error) {
    if (error instanceof WorkflowError) {
      context.logger.error(error.message, error, error.details);
    } else {
      context.logger.error('Unexpected error', error as Error);
    }
    
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      output: {},
      metadata: { errorCode: (error as any).code }
    };
  }
}
```

---

## Type Definitions

Complete TypeScript type definitions are available in:
- `src/models/workflow.ts` - Workflow models
- `src/models/workflowExecution.ts` - Execution models
- `src/workflows/types.ts` - Handler interfaces
- `src/services/types.ts` - Service interfaces

---

## Examples

Comprehensive examples are available in:
- `examples/workflows/` - Workflow JSON configurations
- `scripts/runExample.ts` - Execution examples
- `tests/integration/` - Integration test examples

---

**Last Updated**: January 2024  
**Version**: 1.0.0
