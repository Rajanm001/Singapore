/**
 * Main Entry Point
 * Example of initializing and using the workflow engine
 */

import { WorkflowExecutor } from './workflows/workflowExecutor.ts';
import { globalStepRegistry } from './workflows/stepRegistry.ts';
import { RAGStepHandler } from './workflows/handlers/ragStepHandler.ts';
import { LLMStepHandler } from './workflows/handlers/llmStepHandler.ts';
import { ConditionStepHandler } from './workflows/handlers/conditionStepHandler.ts';
import { APICallStepHandler } from './workflows/handlers/apiCallStepHandler.ts';
import { MemoryRetrievalService } from './services/retrieval/memoryRetrievalService.ts';
import { MockLLMService } from './services/llm/mockLlmService.ts';
import { createLogger } from './utils/logger.ts';

/**
 * Initialize the workflow engine with all handlers
 */
export function initializeEngine(): {
  executor: WorkflowExecutor;
  registry: typeof globalStepRegistry;
  services: {
    retrieval: MemoryRetrievalService;
    llm: MockLLMService;
  };
} {
  const logger = createLogger('WorkflowEngine');
  
  // Initialize services
  const retrievalService = new MemoryRetrievalService();
  const llmService = new MockLLMService();

  // Register step handlers
  globalStepRegistry.register('RAG', new RAGStepHandler(retrievalService));
  globalStepRegistry.register('LLM', new LLMStepHandler(llmService));
  globalStepRegistry.register('CONDITION', new ConditionStepHandler());
  globalStepRegistry.register('API_CALL', new APICallStepHandler());

  logger.info('Workflow engine initialized', {
    registeredHandlers: globalStepRegistry.getAllTypes(),
  });

  // Create executor
  const executor = new WorkflowExecutor(globalStepRegistry);

  return {
    executor,
    registry: globalStepRegistry,
    services: {
      retrieval: retrievalService,
      llm: llmService,
    },
  };
}

/**
 * Example usage (for demonstration)
 */
async function main(): Promise<void> {
  const logger = createLogger('Main');
  
  try {
    logger.info('Starting Knowledge & Workflow Engine...');
    
    const engine = initializeEngine();
    
    logger.info('Engine ready', {
      handlers: engine.registry.getAllTypes(),
    });
    
    logger.info('Engine started successfully');
  } catch (error) {
    logger.error('Failed to start engine', error as Error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
