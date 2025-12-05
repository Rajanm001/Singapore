/**
 * API Call Step Handler (Future-Ready Stub)
 * Makes HTTP requests to external APIs
 */

import { BaseStepHandler, type StepResult, type StepExecutionContext } from './baseStepHandler.ts';
import { APICallStepParamsSchema } from '../../models/workflowStep.ts';
import { resolveTemplateObject } from '../../utils/templateEngine.ts';
import { StepExecutionError } from '../../utils/errors.ts';

export class APICallStepHandler extends BaseStepHandler {
  readonly type = 'API_CALL';
  readonly description = 'Make HTTP requests to external APIs';

  validateParams(params: Record<string, unknown>): void {
    try {
      APICallStepParamsSchema.parse(params);
    } catch (error) {
      throw new StepExecutionError(
        `Invalid API_CALL step parameters: ${error}`,
        'unknown',
        'API_CALL',
        { params }
      );
    }
  }

  async execute(
    params: Record<string, unknown>,
    context: StepExecutionContext
  ): Promise<StepResult> {
    const validatedParams = APICallStepParamsSchema.parse(params);

    try {
      const { result, duration } = await this.measureExecution(async () => {
        // Resolve template variables in URL, headers, and body
        const resolvedUrl = resolveTemplateObject(validatedParams.url, context.templateContext);
        const resolvedHeaders = validatedParams.headers
          ? resolveTemplateObject(validatedParams.headers, context.templateContext)
          : undefined;
        const resolvedBody = validatedParams.body
          ? resolveTemplateObject(validatedParams.body, context.templateContext)
          : undefined;

        context.logger.info('Executing API call', {
          method: validatedParams.method,
          url: resolvedUrl,
        });

        // Make HTTP request
        const response = await fetch(resolvedUrl, {
          method: validatedParams.method,
          headers: resolvedHeaders as HeadersInit,
          body: resolvedBody ? JSON.stringify(resolvedBody) : undefined,
        });

        const responseData = await response.json();

        // Convert headers to plain object
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        return {
          status: response.status,
          statusText: response.statusText,
          headers,
          data: responseData,
        };
      });

      context.logger.info('API call completed', {
        status: result.status,
        duration,
      });

      return this.success(result, {
        duration,
        apiCalls: 1,
      });
    } catch (error) {
      context.logger.error('API call failed', error as Error);
      
      return this.failure(
        `API call failed: ${error instanceof Error ? error.message : String(error)}`,
        'API_CALL_FAILED',
        true
      );
    }
  }

  getParamSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'API endpoint URL (supports template variables)',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          default: 'GET',
          description: 'HTTP method',
        },
        headers: {
          type: 'object',
          description: 'Request headers (supports template variables)',
        },
        body: {
          type: 'object',
          description: 'Request body (supports template variables)',
        },
        auth: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['none', 'bearer', 'basic', 'api-key'],
            },
            credentials: {
              type: 'object',
            },
          },
        },
      },
      required: ['url'],
    };
  }
}
