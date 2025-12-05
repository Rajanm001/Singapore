# Knowledge & Workflow Engine

[![CI Pipeline](https://github.com/Rajanm001/Singapore/actions/workflows/ci.yml/badge.svg)](https://github.com/Rajanm001/Singapore/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A multi-tenant workflow orchestration system for building retrieval-augmented generation (RAG) pipelines. Define workflows as JSON configurations with pluggable step handlers, execution tracking, and conditional branching.

## Features

- **Multi-tenant architecture** with organization-level isolation
- **JSON-configured workflows** with versioning and validation
- **Extensible step types**: RAG, LLM, CONDITION, API_CALL
- **Template variables** (`{{input.field}}`, `{{steps.id.output}}`)
- **Expression engine** for conditional logic
- **Structured logging** with execution metrics
- **Type-safe** with TypeScript strict mode and Zod validation
- **Production-ready** with retries, timeouts, and error handling

## Quick Start

```powershell
# Install dependencies
npm install

# Run tests
npm test

# Build project
npm run build

# Run example workflow
npm run example:refund
```

## Architecture

```
┌─────────────┐
│  Workflow   │
│ (JSON File) │
└──────┬──────┘
       │
   ┌───▼────┐
   │Executor│
   └───┬────┘
       │
   ┌───▼────┐       ┌──────────┐
   │Registry├──────►│ Handlers │
   └────────┘       │ (RAG/LLM)│
                    └─────┬────┘
                          │
                    ┌─────▼─────┐
                    │ Services  │
                    │(Vector/AI)│
                    └───────────┘
```

**Core Components:**
- **Models**: Organization, KnowledgeCollection, Document, Workflow, WorkflowExecution
- **Executor**: Orchestrates step execution with context management
- **Handlers**: RAG, LLM, CONDITION, API_CALL step processors
- **Services**: Retrieval (vector search), LLM (generation), embedding
- **Utilities**: Template engine, expression evaluator, logging, metrics

## Project Structure

```
src/
├── models/              # Domain models with Zod schemas
├── workflows/           # Executor, handlers, validators
│   └── handlers/        # Step type implementations
├── services/            # LLM, retrieval, embedding services
└── utils/               # Template engine, logging, metrics

tests/
├── unit/                # Component tests
└── integration/         # End-to-end workflow tests

examples/workflows/      # Sample JSON configurations
docs/                    # Technical documentation
```

## Example Workflow

```json
{
  "id": "wf_refund_policy",
  "name": "Refund Policy Assistant",
  "version": 1,
  "steps": [
    {
      "id": "search",
      "type": "RAG",
      "params": {
        "collectionId": "policies",
        "query": "{{input.question}}",
        "topK": 3
      }
    },
    {
      "id": "answer",
      "type": "LLM",
      "params": {
        "model": "gpt-4",
        "prompt": "Based on: {{steps.search.output.results[0].text}}\nAnswer: {{input.question}}"
      }
    }
  ]
}
```

**Run it:**
```powershell
npm run example:refund
```

## Adding Custom Step Types

Create a handler implementing `BaseStepHandler`:

```typescript
import { BaseStepHandler } from './workflows/handlers/baseStepHandler';

export class WebhookStepHandler extends BaseStepHandler {
  readonly type = 'WEBHOOK';
  
  async execute(step: WorkflowStep, context: ExecutionContext): Promise<StepResult> {
    const url = this.resolveTemplate(step.params.url, context);
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(context.input)
    });
    return this.success({ status: response.status, data: await response.json() });
  }
  
  getParamsSchema() {
    return z.object({ url: z.string().url() });
  }
}
```

Register it:

```typescript
import { globalStepRegistry } from './workflows/stepRegistry';
globalStepRegistry.register('WEBHOOK', new WebhookStepHandler());
```

Use in workflows:

```json
{
  "id": "notify",
  "type": "WEBHOOK",
  "params": {
    "url": "https://api.example.com/notify"
  }
}
```

See `docs/extensibility.md` for complete guide.

## Template Engine

Access data in workflow parameters using `{{variable}}` syntax:

- `{{input.fieldName}}` - Input payload fields
- `{{steps.stepId.output.field}}` - Previous step outputs
- `{{steps.stepId.output[0].text}}` - Array access
- `{{context.organizationId}}` - Execution context

## Expression Language

Conditional branching supports:

```javascript
// Comparisons
steps.search.output.score > 0.7

// Logical operators
steps.search.output.count > 0 && steps.search.output.score >= 0.7

// String operations
steps.search.output.category contains "refund"

// Literals
steps.search.output.status == "success" || steps.search.output.retry == true
```

## Development

```powershell
# Lint code
npm run lint

# Type check
npm run type-check

# Run tests with coverage
npm run test:coverage

# Validate all (lint + type-check + test)
npm run validate

# Docker deployment
docker-compose up -d
```

## Documentation

| Document | Description |
|----------|-------------|
| `docs/architecture.md` | System design and component overview |
| `docs/extensibility.md` | Adding custom step types and plugins |
| `docs/API.md` | Domain models and service interfaces |
| `docs/DEPLOYMENT.md` | Production deployment guide |

## Testing

```powershell
npm test                 # All tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:coverage    # With coverage report
```

**Test Coverage:**
- Unit tests for all utilities (template engine, expression evaluator, validators)
- Integration tests for end-to-end workflow execution
- Step handler tests for RAG, LLM, CONDITION, API_CALL

## Docker

```powershell
# Build image
docker build -t knowledge-workflow-engine .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f workflow-engine

# Stop services
docker-compose down
```

**Services:**
- `workflow-engine`: Main application (Node.js 18 Alpine)
- `postgres`: PostgreSQL 15 database
- `redis`: Redis 7 cache

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:

- ✅ Lint (ESLint)
- ✅ Type check (TypeScript)
- ✅ Build compilation
- ✅ Tests (Vitest)
- ✅ Security audit (npm audit)
- ✅ Docker build

**Matrix:** Node 18.x and 20.x

## License

MIT License - see LICENSE file for details

## Author

Rajan Mishra

---

**Built to demonstrate:**
- Multi-tenant AI platform architecture
- Workflow engine design patterns
- RAG pipeline implementation
- Production-grade TypeScript practices
