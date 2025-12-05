# Setup Guide

Get the project running locally.

---

## Prerequisites

- **Node.js**: >= 18.0.0
- **npm** or **pnpm**: Latest version
- **TypeScript**: 5.3+ (installed via npm)
- **Git**: For version control

---

## Quick Start

### 1. Install Dependencies

```powershell
# Navigate to project directory
cd knowledge-workflow-engine

# Install all dependencies
npm install
```

This installs:
- `zod` - Runtime type validation
- `nanoid` - ID generation
- `dotenv` - Environment variables
- TypeScript, ESLint, Prettier, Vitest

### 2. Build the Project

```powershell
# Compile TypeScript to JavaScript
npm run build
```

Output will be in the `dist/` folder.

### 3. Run Examples

```powershell
# Run refund policy workflow example
npm run example:refund

# Run troubleshooting workflow example
npm run example:troubleshooting
```

### 4. Run Tests (Once Implemented)

```powershell
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test -- --watch
```

---

## Project Structure

```
knowledge-workflow-engine/
├── src/                    # Source code
│   ├── models/            # Domain models
│   ├── workflows/         # Workflow engine
│   │   └── handlers/      # Step type handlers
│   ├── services/          # External service abstractions
│   │   ├── retrieval/     # RAG / Vector search
│   │   └── llm/           # Language models
│   └── utils/             # Utilities
├── examples/              # Example workflows
│   └── workflows/         # JSON workflow configs
├── scripts/               # Utility scripts
├── docs/                  # Documentation
└── tests/                 # Test suites
```

---

## Development Workflow

### Running in Dev Mode

```powershell
# Watch mode with auto-reload
npm run dev
```

### Linting & Formatting

```powershell
# Run ESLint
npm run lint

# Format code with Prettier
npm run format
```

### Type Checking

```powershell
# TypeScript type checking (no emit)
npx tsc --noEmit
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Environment
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Workflow Engine
MAX_WORKFLOW_STEPS=100
MAX_EXECUTION_TIME_MS=30000

# Services (Future)
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### TypeScript Configuration

The project uses `tsconfig.json` with:
- ES2022 target
- ESNext modules
- Strict type checking
- Path mapping (if needed)

---

## Creating Your First Workflow

### Step 1: Define Workflow JSON

Create `my-workflow.workflow.json` in `examples/workflows/`:

```json
{
  "id": "wf_my_workflow",
  "organizationId": "org_demo",
  "name": "My First Workflow",
  "version": 1,
  "entryStepId": "s01_search",
  "steps": [
    {
      "id": "s01_search",
      "type": "RAG",
      "label": "Search Knowledge Base",
      "params": {
        "collectionId": "coll_test",
        "query": "{{input.question}}",
        "topK": 3
      },
      "nextStepId": "s02_answer"
    },
    {
      "id": "s02_answer",
      "type": "LLM",
      "label": "Generate Answer",
      "params": {
        "model": "gpt-4",
        "prompt": "Question: {{input.question}}\n\nContext: {{steps.s01_search.output.results[0].text}}\n\nAnswer:",
        "temperature": 0.7
      }
    }
  ]
}
```

### Step 2: Create Execution Script

```typescript
import { WorkflowExecutor } from './src/workflows/workflowExecutor.ts';
import { globalStepRegistry } from './src/workflows/stepRegistry.ts';
// ... import handlers and services

const workflow = JSON.parse(readFileSync('./examples/workflows/my-workflow.workflow.json', 'utf-8'));

const execution = await executor.execute(
  workflow,
  'org_demo',
  { question: 'What is AI?' }
);

console.log(execution);
```

### Step 3: Run

```powershell
npm run example:my-workflow
```

---

## Extending the Engine

### Adding a New Step Type

#### 1. Create Handler

`src/workflows/handlers/customStepHandler.ts`:

```typescript
import { BaseStepHandler, type StepResult, type StepExecutionContext } from './baseStepHandler.ts';

export class CustomStepHandler extends BaseStepHandler {
  readonly type = 'CUSTOM';
  readonly description = 'My custom step type';

  validateParams(params: Record<string, unknown>): void {
    // Validate parameters
    if (!params.requiredField) {
      throw new Error('requiredField is required');
    }
  }

  async execute(
    params: Record<string, unknown>,
    context: StepExecutionContext
  ): Promise<StepResult> {
    try {
      // Your logic here
      const result = await doSomething(params);
      
      return this.success({ result });
    } catch (error) {
      return this.failure('Custom step failed', 'CUSTOM_ERROR');
    }
  }

  getParamSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        requiredField: { type: 'string' }
      },
      required: ['requiredField']
    };
  }
}
```

#### 2. Register Handler

```typescript
import { globalStepRegistry } from './src/workflows/stepRegistry.ts';
import { CustomStepHandler } from './src/workflows/handlers/customStepHandler.ts';

globalStepRegistry.register('CUSTOM', new CustomStepHandler());
```

#### 3. Use in Workflows

```json
{
  "id": "custom_step",
  "type": "CUSTOM",
  "label": "My Custom Step",
  "params": {
    "requiredField": "value"
  }
}
```

---

## Troubleshooting

### Issue: TypeScript errors

**Solution**: 
```powershell
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Issue: Cannot find module 'zod'

**Solution**:
```powershell
npm install zod
```

### Issue: Workflow validation fails

**Solution**: Check workflow JSON against schema:
- Entry step exists
- No circular references
- All referenced steps exist
- Valid step types

### Issue: Step execution fails

**Solution**: Check:
- Handler is registered for step type
- Parameters match schema
- Template variables resolve correctly
- Service dependencies are available

---

## Testing

### Unit Test Example

`tests/unit/templateEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveTemplate } from '../../src/utils/templateEngine.ts';

describe('TemplateEngine', () => {
  it('resolves simple variables', () => {
    const context = {
      input: { name: 'World' },
      steps: {},
      context: {}
    };
    
    const result = resolveTemplate('Hello {{input.name}}', context);
    expect(result).toBe('Hello World');
  });
});
```

### Integration Test Example

`tests/integration/workflow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WorkflowExecutor } from '../../src/workflows/workflowExecutor.ts';

describe('WorkflowExecutor', () => {
  it('executes workflow end-to-end', async () => {
    const executor = setupExecutor();
    const workflow = loadTestWorkflow();
    
    const execution = await executor.execute(
      workflow,
      'org_test',
      { question: 'test' }
    );
    
    expect(execution.status).toBe('completed');
  });
});
```

---

## Deployment

### Docker (Future)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Build and run:
```powershell
docker build -t workflow-engine .
docker run -p 3000:3000 workflow-engine
```

### Environment-Specific Configs

- **Development**: `.env.development`
- **Staging**: `.env.staging`
- **Production**: `.env.production`

Load with:
```typescript
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
```

---

## Additional Resources

- **Design Document**: `docs/design.md`
- **Architecture**: `docs/architecture.md`
- **Reflection Notes**: `docs/reflection.md`
- **Example Workflows**: `examples/workflows/`

---

## Support

For issues or questions:
1. Check existing documentation
2. Review example workflows
3. Check TypeScript types
4. Review execution logs

---

**Happy Building! 🚀**
