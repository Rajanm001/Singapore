/**
 * LLM Step Handler
 * Calls a language model with a prompt template
 */

import { BaseStepHandler, type StepResult, type StepExecutionContext } from './baseStepHandler.ts';
import { LLMStepParamsSchema } from '../../models/workflowStep.ts';
import { resolveTemplate } from '../../utils/templateEngine.ts';
import { StepExecutionError } from '../../utils/errors.ts';
import type { LLMService } from '../../services/llm/llmService.ts';

export class LLMStepHandler extends BaseStepHandler {
  readonly type = 'LLM';
  readonly description = 'Call a language model with a prompt template';

  constructor(private llmService: LLMService) {
    super();
  }

  validateParams(params: Record<string, unknown>): void {
    try {
      LLMStepParamsSchema.parse(params);
    } catch (error) {
      throw new StepExecutionError(
        `Invalid LLM step parameters: ${error}`,
        'unknown',
        'LLM',
        { params }
      );
    }
  }

  async execute(
    params: Record<string, unknown>,
    context: StepExecutionContext
  ): Promise<StepResult> {
    const validatedParams = LLMStepParamsSchema.parse(params);

    try {
      const { result, duration } = await this.measureExecution(async () => {
        // Resolve template variables in prompt
        const resolvedPrompt = resolveTemplate(validatedParams.prompt, context.templateContext);
        const resolvedSystemPrompt = validatedParams.systemPrompt
          ? resolveTemplate(validatedParams.systemPrompt, context.templateContext)
          : undefined;

        context.logger.info('Executing LLM call', {
          model: validatedParams.model,
          promptLength: resolvedPrompt.length,
          temperature: validatedParams.temperature,
        });

        // Call LLM
        const response = await this.llmService.complete({
          model: validatedParams.model,
          prompt: resolvedPrompt,
          systemPrompt: resolvedSystemPrompt,
          temperature: validatedParams.temperature,
          maxTokens: validatedParams.maxTokens,
          stopSequences: validatedParams.stopSequences,
        });

        return response;
      });

      context.logger.info('LLM call completed', {
        tokensUsed: result.usage?.totalTokens,
        duration,
      });

      return this.success(
        {
          text: result.text,
          usage: result.usage,
          model: validatedParams.model,
        },
        {
          duration,
          tokensUsed: result.usage?.totalTokens,
          llmCallCount: 1,
        }
      );
    } catch (error) {
      context.logger.error('LLM call failed', error as Error);
      
      return this.failure(
        `LLM call failed: ${error instanceof Error ? error.message : String(error)}`,
        'LLM_CALL_FAILED',
        true
      );
    }
  }

  getParamSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'LLM model identifier (e.g., gpt-4, claude-3-opus)',
        },
        prompt: {
          type: 'string',
          description: 'Prompt template (supports template variables)',
        },
        systemPrompt: {
          type: 'string',
          description: 'System prompt (optional)',
        },
        temperature: {
          type: 'number',
          description: 'Sampling temperature (0-2)',
          default: 0.7,
          minimum: 0,
          maximum: 2,
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens to generate',
          minimum: 1,
        },
        stopSequences: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sequences that stop generation',
        },
      },
      required: ['model', 'prompt'],
    };
  }
}
