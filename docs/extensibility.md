# Extensibility Guide

**Author**: Rajan Mishra  
**Date**: December 5, 2025

This guide shows how to extend the Knowledge & Workflow Engine by adding new step types, services, and integrations.

---

## How to Add a New Step Type

The workflow engine uses a plugin architecture that makes adding custom step types straightforward. You implement a handler class, register it with the global registry, and immediately use it in your workflow JSON configurations. No modifications to the core execution engine are required.

### Overview of the Process

1. **Define the parameter schema** using Zod for type-safe validation
2. **Create a handler class** extending `BaseStepHandler`
3. **Implement the `execute()` method** with your custom logic
4. **Register the handler** with the global step registry
5. **Use the step type** in workflow JSON configurations

The step registry handles dispatching incoming workflow steps to your handler, and the executor manages context, retries, timeouts, and error handling automatically.

### Example: Adding a WEBHOOK Step Type

Let's walk through adding a step type that sends HTTP webhooks to external APIs. This demonstrates template variable resolution, error handling, and schema validation.

#### Step 1: Define Parameter Schema

Create a Zod schema for the step's parameters. This ensures type safety and validates workflow configurations at runtime:

```typescript
// src/workflows/handlers/webhookStepHandler.ts

import { z } from 'zod';

export const WebhookStepParamsSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  headers: z.record(z.string()).optional(),
  body: z.record(z.unknown()).optional(),
  timeout: z.number().optional(),
});

export type WebhookStepParams = z.infer<typeof WebhookStepParamsSchema>;
```

#### Step 2: Implement the Handler Class

Extend `BaseStepHandler` and implement the `execute()` method. Use the template engine to resolve variables like `{{input.userId}}` or `{{steps.previous.output.data}}`:

```typescript
import { BaseStepHandler } from './baseStepHandler.ts';
import type { StepResult, StepExecutionContext } from './baseStepHandler.ts';
import { resolveTemplateObject } from '../../utils/templateEngine.ts';
import { createLogger } from '../../utils/logger.ts';

export class WebhookStepHandler extends BaseStepHandler {
  readonly type = 'WEBHOOK' as const;
  readonly description = 'Send HTTP webhook to external endpoint';
  
  private logger = createLogger('WebhookStepHandler');

  async execute(
    params: Record<string, unknown>,
    context: StepExecutionContext
  ): Promise<StepResult> {
    // Validate and parse parameters
    const validatedParams = WebhookStepParamsSchema.parse(params);

    // Resolve template variables (e.g., {{input.url}}, {{steps.s01.output.data}})
    const resolved = await resolveTemplateObject(
      validatedParams,
      context.templateContext
    ) as WebhookStepParams;

    this.logger.info('Sending webhook', {
      url: resolved.url,
      method: resolved.method,
    });

    try {
      const response = await fetch(resolved.url, {
        method: resolved.method,
        headers: {
          'Content-Type': 'application/json',
          ...resolved.headers,
        },
        body: resolved.body ? JSON.stringify(resolved.body) : undefined,
        signal: AbortSignal.timeout(resolved.timeout || 30000),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return this.failure(
          `Webhook failed with status ${response.status}`,
          { status: response.status, data }
        );
      }

      return this.success({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      });
    } catch (error) {
      this.logger.error('Webhook error', { error });
      return this.failure(
        error instanceof Error ? error.message : 'Unknown webhook error',
        { error }
      );
    }
  }

  validateParams(params: Record<string, unknown>): void {
    WebhookStepParamsSchema.parse(params);
  }

  getParamSchema(): Record<string, unknown> {
    return {
      type: 'object',
      required: ['url', 'method'],
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'Webhook endpoint URL',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method',
        },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Custom HTTP headers',
        },
        body: {
          type: 'object',
          description: 'Request body (JSON)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
          default: 30000,
        },
        retryOnFailure: {
          type: 'boolean',
          description: 'Whether to retry on failure',
          default: false,
        },
      },
    };
  }
}
```

#### Step 3: Register Handler

```typescript
// src/index.ts or wherever you initialize the registry

import { globalStepRegistry } from './workflows/stepRegistry.ts';
import { WebhookStepHandler } from './workflows/handlers/webhookStepHandler.ts';

// Register the new handler
globalStepRegistry.register('WEBHOOK', new WebhookStepHandler());
```

#### Step 4: Use in Workflow

```json
{
  "id": "wf_notification",
  "name": "Send Notification Workflow",
  "version": 1,
  "entryStepId": "s01_webhook",
  "steps": [
    {
      "id": "s01_webhook",
      "type": "WEBHOOK",
      "label": "Notify External System",
      "params": {
        "url": "https://example.com/api/notifications",
        "method": "POST",
        "headers": {
          "Authorization": "Bearer {{context.apiKey}}",
          "X-Request-ID": "{{context.executionId}}"
        },
        "body": {
          "event": "workflow_completed",
          "workflowId": "{{context.workflowId}}",
          "organizationId": "{{context.organizationId}}",
          "result": "{{steps.previous_step.output}}"
        },
        "timeout": 10000,
        "retryOnFailure": true
      }
    }
  ]
}
```

That's it! The workflow engine will automatically:
- Validate parameters using your schema
- Resolve template variables
- Execute your handler
- Handle retries and timeouts
- Log execution details

---

## More Complex Examples

### Example: Adding a LOOP Step

```typescript
export class LoopStepHandler extends BaseStepHandler {
  readonly type = 'LOOP' as const;
  readonly description = 'Execute a step multiple times over a collection';

  async execute(
    params: Record<string, unknown>,
    context: StepExecutionContext
  ): Promise<StepResult> {
    const schema = z.object({
      items: z.array(z.unknown()),
      stepId: z.string(),
      maxIterations: z.number().optional(),
    });

    const { items, stepId, maxIterations = 100 } = schema.parse(params);

    const results = [];
    const limit = Math.min(items.length, maxIterations);

    for (let i = 0; i < limit; i++) {
      const item = items[i];
      
      // Create a new context with the current item
      const loopContext = {
        ...context.templateContext,
        loop: {
          index: i,
          item,
          isFirst: i === 0,
          isLast: i === limit - 1,
        },
      };

      // Execute the referenced step
      // (In real implementation, you'd need access to the executor)
      // This is a simplified example
      results.push({ index: i, item, result: 'processed' });
    }

    return this.success({
      iterations: results.length,
      results,
    });
  }

  validateParams(params: Record<string, unknown>): void {
    const schema = z.object({
      items: z.array(z.unknown()),
      stepId: z.string(),
      maxIterations: z.number().optional(),
    });
    schema.parse(params);
  }

  getParamSchema(): Record<string, unknown> {
    return {
      type: 'object',
      required: ['items', 'stepId'],
      properties: {
        items: {
          type: 'array',
          description: 'Items to iterate over',
        },
        stepId: {
          type: 'string',
          description: 'Step to execute for each item',
        },
        maxIterations: {
          type: 'number',
          description: 'Maximum iterations',
          default: 100,
        },
      },
    };
  }
}
```

### Example: Adding a MEMORY Step

```typescript
export class MemoryStepHandler extends BaseStepHandler {
  readonly type = 'MEMORY' as const;
  readonly description = 'Store or retrieve values from workflow memory';

  private memoryStore = new Map<string, unknown>();

  async execute(
    params: Record<string, unknown>,
    context: StepExecutionContext
  ): Promise<StepResult> {
    const schema = z.object({
      action: z.enum(['store', 'retrieve', 'delete']),
      key: z.string(),
      value: z.unknown().optional(),
    });

    const { action, key, value } = schema.parse(params);
    const scopedKey = `${context.organizationId}:${key}`;

    switch (action) {
      case 'store':
        this.memoryStore.set(scopedKey, value);
        return this.success({ stored: true, key });

      case 'retrieve':
        const retrieved = this.memoryStore.get(scopedKey);
        return this.success({ value: retrieved });

      case 'delete':
        const deleted = this.memoryStore.delete(scopedKey);
        return this.success({ deleted });

      default:
        return this.failure('Invalid action');
    }
  }

  validateParams(params: Record<string, unknown>): void {
    const schema = z.object({
      action: z.enum(['store', 'retrieve', 'delete']),
      key: z.string(),
      value: z.unknown().optional(),
    });
    schema.parse(params);
  }

  getParamSchema(): Record<string, unknown> {
    return {
      type: 'object',
      required: ['action', 'key'],
      properties: {
        action: {
          type: 'string',
          enum: ['store', 'retrieve', 'delete'],
          description: 'Memory operation',
        },
        key: {
          type: 'string',
          description: 'Memory key',
        },
        value: {
          description: 'Value to store (for store action)',
        },
      },
    };
  }
}
```

---

## Adding New Services

You can also extend the engine by adding new services (LLM providers, vector databases, etc.).

### Example: Adding Claude Integration

```typescript
// src/services/llm/claudeLlmService.ts

import type { LLMService, LLMCompletionRequest, LLMCompletionResponse } from './llmService.ts';

export class ClaudeLLMService implements LLMService {
  constructor(private apiKey: string) {}

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || 'claude-3-5-sonnet-20241022',
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        system: request.systemPrompt,
      }),
    });

    const data = await response.json();

    return {
      text: data.content[0]?.text || '',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
      finishReason: data.stop_reason,
    };
  }
}
```

---

## Key Design Principles

### 1. Implement the Interface
All step handlers must extend `BaseStepHandler` which provides:
- Error handling
- Retry logic with exponential backoff
- Duration tracking
- Success/failure helper methods

### 2. Use Zod for Validation
Define parameter schemas using Zod for:
- Type safety
- Runtime validation
- Automatic error messages
- Schema documentation

### 3. Resolve Template Variables
Always use `resolveTemplateObject` to support dynamic values:
- `{{input.question}}`
- `{{steps.previous.output}}`
- `{{context.organizationId}}`

### 4. Log Appropriately
Use the logger to track:
- Step start/end
- Important decisions
- Errors and warnings
- Performance metrics

### 5. Handle Errors Gracefully
Return `this.failure(message, metadata)` for recoverable errors. The engine will handle:
- Retries (if configured)
- Error routing (via `onFailure`)
- Logging and metrics

---

## Testing New Step Types

```typescript
import { describe, it, expect } from 'vitest';
import { WebhookStepHandler } from './webhookStepHandler';

describe('WebhookStepHandler', () => {
  it('should send POST request', async () => {
    const handler = new WebhookStepHandler();
    const params = {
      url: 'https://httpbin.org/post',
      method: 'POST',
      body: { test: 'data' },
    };

    const context = {
      stepId: 's01',
      organizationId: 'org_test',
      logger: createLogger('test'),
      templateContext: { input: {}, steps: {}, context: {} },
    };

    const result = await handler.execute(params, context);

    expect(result.success).toBe(true);
    expect(result.output?.status).toBe(200);
  });
});
```

---

## What You DON'T Need to Change

When adding a new step type, you **do not** need to modify:

- ❌ WorkflowExecutor
- ❌ WorkflowValidator
- ❌ Template engine
- ❌ Error handling
- ❌ Logging infrastructure
- ❌ Any existing handlers

The engine is designed so new step types are completely isolated plugins.

---

## Summary

Adding new capabilities to the engine follows this pattern:

1. **Define**: Create parameter schema with Zod
2. **Implement**: Extend BaseStepHandler
3. **Register**: Add to StepRegistry
4. **Use**: Reference in workflow JSON

This approach keeps the core engine stable while making extensions easy.

---

**Last Updated**: December 5, 2025  
**Author**: Rajan Mishra
