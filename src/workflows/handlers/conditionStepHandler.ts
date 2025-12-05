/**
 * Condition Step Handler
 * Evaluates a boolean expression and branches to different steps
 */

import { BaseStepHandler, type StepResult, type StepExecutionContext } from './baseStepHandler.ts';
import { ConditionStepParamsSchema } from '../../models/workflowStep.ts';
import { evaluateExpression } from '../../utils/expressionEngine.ts';
import { StepExecutionError } from '../../utils/errors.ts';

export class ConditionStepHandler extends BaseStepHandler {
  readonly type = 'CONDITION';
  readonly description = 'Evaluate a boolean expression and branch to different steps';

  validateParams(params: Record<string, unknown>): void {
    try {
      ConditionStepParamsSchema.parse(params);
    } catch (error) {
      throw new StepExecutionError(
        `Invalid CONDITION step parameters: ${error}`,
        'unknown',
        'CONDITION',
        { params }
      );
    }
  }

  async execute(
    params: Record<string, unknown>,
    context: StepExecutionContext
  ): Promise<StepResult> {
    const validatedParams = ConditionStepParamsSchema.parse(params);

    try {
      const { result: conditionResult, duration } = await this.measureExecution(async () => {
        context.logger.info('Evaluating condition', {
          expression: validatedParams.expression,
        });

        // Evaluate the expression
        const result = evaluateExpression(validatedParams.expression, context.templateContext);

        return result;
      });

      const nextStep = conditionResult ? validatedParams.onTrue : validatedParams.onFalse;

      context.logger.info('Condition evaluated', {
        result: conditionResult,
        nextStep,
      });

      return this.success(
        {
          conditionMet: conditionResult,    // Primary field name
          result: conditionResult,          // Backward compatibility alias
          nextStep,
          nextStepIdOverride: nextStep,     // Alternative field name
          expression: validatedParams.expression,
        },
        {
          duration,
        }
      );
    } catch (error) {
      context.logger.error('Condition evaluation failed', error as Error);
      
      return this.failure(
        `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        'CONDITION_EVAL_FAILED',
        false
      );
    }
  }

  getParamSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Boolean expression to evaluate (e.g., "steps.s01.output.count > 0")',
        },
        ifTrue: {
          type: 'string',
          description: 'Step ID to execute if condition is true',
        },
        ifFalse: {
          type: 'string',
          description: 'Step ID to execute if condition is false (optional)',
        },
      },
      required: ['expression', 'ifTrue'],
    };
  }
}
