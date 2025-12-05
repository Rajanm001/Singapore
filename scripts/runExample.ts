/**
 * Example Workflow Execution Script
 * Shows how to load and execute workflows
 */

import { readFileSync } from 'fs';
import { WorkflowExecutor } from '../src/workflows/workflowExecutor.ts';
import { globalStepRegistry } from '../src/workflows/stepRegistry.ts';
import { RAGStepHandler } from '../src/workflows/handlers/ragStepHandler.ts';
import { LLMStepHandler } from '../src/workflows/handlers/llmStepHandler.ts';
import { ConditionStepHandler } from '../src/workflows/handlers/conditionStepHandler.ts';
import { APICallStepHandler } from '../src/workflows/handlers/apiCallStepHandler.ts';
import { MemoryRetrievalService } from '../src/services/retrieval/memoryRetrievalService.ts';
import { MockLLMService } from '../src/services/llm/mockLlmService.ts';
import type { Workflow } from '../src/models/workflow.ts';
import type { WorkflowExecution } from '../src/models/workflowExecution.ts';

/**
 * Initialize services and register handlers
 */
function initializeEngine() {
  // Create service instances
  const retrievalService = new MemoryRetrievalService();
  const llmService = new MockLLMService();

  // Register step handlers
  globalStepRegistry.register('RAG', new RAGStepHandler(retrievalService));
  globalStepRegistry.register('LLM', new LLMStepHandler(llmService));
  globalStepRegistry.register('CONDITION', new ConditionStepHandler());
  globalStepRegistry.register('API_CALL', new APICallStepHandler());

  // Create executor
  const executor = new WorkflowExecutor(globalStepRegistry);

  return { executor, retrievalService, llmService };
}

/**
 * Load a workflow from JSON file
 */
function loadWorkflow(filename: string): Workflow {
  const path = `./examples/workflows/${filename}`;
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as Workflow;
}

/**
 * Pretty print execution results
 */
function printExecution(execution: WorkflowExecution) {
  console.log('\n' + '='.repeat(80));
  console.log('WORKFLOW EXECUTION RESULTS');
  console.log('='.repeat(80));
  
  console.log(`\n📋 Execution ID: ${execution.id}`);
  console.log(`📝 Workflow: ${execution.workflowId} (v${execution.workflowVersion})`);
  console.log(`🏢 Organization: ${execution.organizationId}`);
  console.log(`⏱️  Duration: ${execution.durationMs}ms`);
  console.log(`✅ Status: ${execution.status.toUpperCase()}`);
  
  if (execution.metrics) {
    console.log('\n📊 Metrics:');
    console.log(`   - Steps Executed: ${execution.metrics.stepsExecuted}`);
    console.log(`   - LLM Calls: ${execution.metrics.llmCallCount}`);
    console.log(`   - RAG Queries: ${execution.metrics.ragQueryCount}`);
    console.log(`   - Tokens Used: ${execution.metrics.totalTokensUsed}`);
  }
  
  console.log('\n🔄 Step Execution Trace:');
  execution.stepExecutions.forEach((step: any, index: number) => {
    const statusIcon = step.status === 'completed' ? '✅' : 
                       step.status === 'failed' ? '❌' : 
                       step.status === 'skipped' ? '⏭️' : '⏳';
    
    console.log(`\n   ${index + 1}. ${statusIcon} ${step.stepId} (${step.stepType})`);
    console.log(`      Status: ${step.status}`);
    if (step.durationMs) {
      console.log(`      Duration: ${step.durationMs}ms`);
    }
    if (step.error) {
      console.log(`      Error: ${step.error}`);
    }
    if (step.output && typeof step.output === 'object') {
      console.log(`      Output: ${JSON.stringify(step.output, null, 2).substring(0, 200)}...`);
    }
  });
  
  if (execution.error) {
    console.log('\n❌ ERROR:');
    console.log(`   Message: ${execution.error.message}`);
    console.log(`   Code: ${execution.error.code}`);
    if (execution.error.stepId) {
      console.log(`   Failed at: ${execution.error.stepId}`);
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Example 1: Refund Policy Workflow
 */
async function runRefundPolicyExample() {
  console.log('\n🚀 Running Example: Refund Policy Assistant\n');
  
  const { executor } = initializeEngine();
  const workflow = loadWorkflow('refund_policy.workflow.json');
  
  const inputPayload = {
    question: 'What is your refund policy for digital products?',
  };
  
  console.log('📥 Input:', JSON.stringify(inputPayload, null, 2));
  
  const execution = await executor.execute(
    workflow,
    'org_demo',
    inputPayload
  );
  
  printExecution(execution);
}

/**
 * Example 2: Troubleshooting Workflow
 */
async function runTroubleshootingExample() {
  console.log('\n🚀 Running Example: Technical Troubleshooting Assistant\n');
  
  const { executor } = initializeEngine();
  const workflow = loadWorkflow('troubleshooting.workflow.json');
  
  const inputPayload = {
    issue: 'Application crashes on startup',
    product: 'Desktop App',
    severity: 'medium',
  };
  
  console.log('📥 Input:', JSON.stringify(inputPayload, null, 2));
  
  const execution = await executor.execute(
    workflow,
    'org_demo',
    inputPayload
  );
  
  printExecution(execution);
}

/**
 * Main entry point
 */
async function main() {
  const workflowName = process.argv[2];
  
  try {
    if (workflowName === 'refund_policy' || !workflowName) {
      await runRefundPolicyExample();
    } else if (workflowName === 'troubleshooting') {
      await runTroubleshootingExample();
    } else {
      console.error(`Unknown workflow: ${workflowName}`);
      console.log('Available workflows: refund_policy, troubleshooting');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Execution failed:', error);
    process.exit(1);
  }
}

main();
