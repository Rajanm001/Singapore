/**
 * RAG Step Handler
 * Retrieves relevant document chunks from a knowledge collection
 */

import { BaseStepHandler, type StepResult, type StepExecutionContext } from './baseStepHandler.ts';
import { RAGStepParamsSchema } from '../../models/workflowStep.ts';
import { resolveTemplate } from '../../utils/templateEngine.ts';
import { StepExecutionError } from '../../utils/errors.ts';
import type { RetrievalService } from '../../services/retrieval/retrievalService.ts';

export class RAGStepHandler extends BaseStepHandler {
  readonly type = 'RAG';
  readonly description = 'Retrieve relevant document chunks from a knowledge collection';

  constructor(private retrievalService: RetrievalService) {
    super();
  }

  validateParams(params: Record<string, unknown>): void {
    try {
      RAGStepParamsSchema.parse(params);
    } catch (error) {
      throw new StepExecutionError(
        `Invalid RAG step parameters: ${error}`,
        'unknown',
        'RAG',
        { params }
      );
    }
  }

  async execute(
    params: Record<string, unknown>,
    context: StepExecutionContext
  ): Promise<StepResult> {
    const validatedParams = RAGStepParamsSchema.parse(params);

    try {
      const { result, duration } = await this.measureExecution(async () => {
        // Resolve template variables in query
        const resolvedQuery = resolveTemplate(validatedParams.query, context.templateContext);

        context.logger.info('Executing RAG query', {
          collectionId: validatedParams.collectionId,
          query: resolvedQuery,
          topK: validatedParams.topK,
        });

        // Perform retrieval
        const results = await this.retrievalService.search({
          collectionId: validatedParams.collectionId,
          query: resolvedQuery,
          topK: validatedParams.topK,
          minScore: validatedParams.minScore,
          filters: validatedParams.filters,
          organizationId: context.organizationId,
          subOrganizationId: context.subOrganizationId,
        });

        return results;
      });

      context.logger.info('RAG query completed', {
        resultCount: result.length,
        duration,
      });

      return this.success(
        {
          results: result,
          count: result.length,
          query: resolveTemplate(validatedParams.query, context.templateContext),
        },
        {
          duration,
          ragQueryCount: 1,
        }
      );
    } catch (error) {
      context.logger.error('RAG query failed', error as Error);
      
      return this.failure(
        `RAG query failed: ${error instanceof Error ? error.message : String(error)}`,
        'RAG_QUERY_FAILED',
        true
      );
    }
  }

  getParamSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        collectionId: {
          type: 'string',
          description: 'Knowledge collection to search',
        },
        query: {
          type: 'string',
          description: 'Search query (supports template variables)',
        },
        topK: {
          type: 'number',
          description: 'Number of chunks to retrieve',
          default: 5,
          minimum: 1,
        },
        minScore: {
          type: 'number',
          description: 'Minimum similarity score threshold',
          minimum: 0,
          maximum: 1,
        },
        filters: {
          type: 'object',
          description: 'Metadata filters',
        },
      },
      required: ['collectionId', 'query'],
    };
  }
}
