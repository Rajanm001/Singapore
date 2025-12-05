# Knowledge & Workflow Engine - Architecture Document

**Author**: Rajan Mishra  
**Date**: December 4, 2025

---

## Table of Contents

1. [System Context](#system-context)
2. [Component Architecture](#component-architecture)
3. [Data Architecture](#data-architecture)
4. [Execution Flow](#execution-flow)
5. [Scalability & Performance](#scalability--performance)
6. [Security Architecture](#security-architecture)
7. [Integration Points](#integration-points)
8. [Deployment Architecture](#deployment-architecture)

---

## 1. System Context

### 1.1 System Landscape

```
┌─────────────────────────────────────────────────────────────────┐
│                     External Systems                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   OpenAI /   │  │   Vector DB  │  │  External    │         │
│  │  Anthropic   │  │  (Pinecone/  │  │   APIs       │         │
│  │   (LLM)      │  │  Weaviate)   │  │ (Webhooks)   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│         Knowledge & Workflow Engine Platform                     │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────┐        │
│  │              API Gateway (Future)                    │        │
│  │  - Authentication (JWT/OAuth)                        │        │
│  │  - Rate Limiting                                     │        │
│  │  - Request Validation                                │        │
│  └─────────────────────────┬───────────────────────────┘        │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────┐        │
│  │           Workflow Execution Layer                   │        │
│  │                                                       │        │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │        │
│  │  │   Workflow   │  │   Workflow   │  │   Step    │ │        │
│  │  │  Validator   │  │  Executor    │  │ Registry  │ │        │
│  │  └──────────────┘  └──────┬───────┘  └─────┬─────┘ │        │
│  │                            │                │       │        │
│  └────────────────────────────┼────────────────┼───────┘        │
│                               │                │                │
│  ┌────────────────────────────▼────────────────▼───────┐        │
│  │              Step Handler Layer                      │        │
│  │  ┌─────┐  ┌─────┐  ┌──────────┐  ┌────────┐       │        │
│  │  │ RAG │  │ LLM │  │CONDITION │  │API_CALL│       │        │
│  │  └──┬──┘  └──┬──┘  └────┬─────┘  └───┬────┘       │        │
│  └─────┼────────┼──────────┼────────────┼─────────────┘        │
│        │        │          │            │                       │
│  ┌─────▼────────▼──────────▼────────────▼─────────────┐        │
│  │              Service Layer                           │        │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │        │
│  │  │  Retrieval   │  │     LLM      │  │ Template │ │        │
│  │  │   Service    │  │   Service    │  │  Engine  │ │        │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┘ │        │
│  └─────────┼──────────────────┼──────────────────────┘         │
│            │                  │                                 │
│  ┌─────────▼──────────────────▼──────────────────────┐         │
│  │           Data Access Layer                        │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │         │
│  │  │  Workflows   │  │ Collections  │  │  Logs   │ │         │
│  │  │    Store     │  │    Store     │  │  Store  │ │         │
│  │  └──────────────┘  └──────────────┘  └─────────┘ │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Context Boundaries

**Bounded Contexts** (Domain-Driven Design):

1. **Knowledge Management Context**
   - Aggregates: Organization, Collection, Document, Chunk
   - Services: DocumentProcessor, EmbeddingGenerator, SearchService

2. **Workflow Orchestration Context**
   - Aggregates: Workflow, WorkflowExecution
   - Services: Executor, Validator, StepRegistry

3. **Integration Context**
   - Services: LLMService, APIService, WebhookService

---

## 2. Component Architecture

### 2.1 Core Components

#### Workflow Executor

**Responsibility**: Orchestrate step-by-step workflow execution

**Dependencies**:
- StepRegistry (get handlers)
- WorkflowValidator (validate structure)
- Logger (observability)

**Interface**:
```typescript
interface WorkflowExecutor {
  execute(
    workflow: Workflow,
    organizationId: string,
    inputPayload: Record<string, unknown>,
    subOrganizationId?: string,
    options?: ExecutionOptions
  ): Promise<WorkflowExecution>
}
```

**Execution Algorithm**:
```
1. Validate workflow structure
2. Create execution record (status: 'running')
3. Initialize execution context
4. currentStepId = workflow.entryStepId
5. WHILE currentStepId is not null:
   a. Find step by ID
   b. Get handler from registry
   c. Resolve template variables
   d. Execute handler (with retry logic)
   e. Store result in context
   f. Update execution record
   g. Determine next step (linear/conditional/error)
   h. currentStepId = nextStep
6. Finalize execution (status: 'completed' or 'failed')
7. Return execution record
```

**Concurrency Model**: Single-threaded per execution (future: parallel steps)

**Error Handling**: 
- Step failures → check `onFailure` handler
- No handler → propagate error, mark execution failed
- Retries → exponential backoff

#### Step Registry

**Responsibility**: Map step types to handlers

**Pattern**: Registry + Factory

**Interface**:
```typescript
interface StepRegistry {
  register(type: StepType, handler: BaseStepHandler): void
  getHandler(type: StepType): BaseStepHandler
  hasHandler(type: StepType): boolean
}
```

**Thread Safety**: Not required (single-threaded Node.js)

**Extensibility**: New handlers registered at startup

#### Base Step Handler

**Responsibility**: Define contract for all step types

**Pattern**: Template Method + Strategy

**Interface**:
```typescript
abstract class BaseStepHandler {
  abstract type: StepType
  abstract validateParams(params): void
  abstract execute(params, context): Promise<StepResult>
  abstract getParamSchema(): Record<string, unknown>
  
  // Helper methods
  protected success(output, metadata): StepResult
  protected failure(message, code, recoverable): StepResult
  protected measureExecution<T>(fn): Promise<{ result: T, duration: number }>
}
```

**Implementations**:
- RAGStepHandler
- LLMStepHandler
- ConditionStepHandler
- APICallStepHandler
- (Future: TransformStepHandler, LoopStepHandler, ParallelStepHandler)

### 2.2 Service Layer

#### Retrieval Service

**Purpose**: Abstract vector search

**Interface**:
```typescript
interface RetrievalService {
  search(request: SearchRequest): Promise<SearchResult[]>
  getEmbedding(text: string): Promise<number[]>
}
```

**Implementations**:
- MemoryRetrievalService (development)
- PostgresRetrievalService (production)
- PineconeRetrievalService (managed vector DB)

**Provider Selection**: Dependency injection at startup

#### LLM Service

**Purpose**: Abstract language model calls

**Interface**:
```typescript
interface LLMService {
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>
}
```

**Implementations**:
- MockLLMService (development)
- OpenAILLMService (GPT-4, GPT-3.5)
- AnthropicLLMService (Claude)
- LocalLLMService (Ollama, LlamaCPP)

**Retry Logic**: Built into service implementations

**Rate Limiting**: Per-organization quota enforcement

### 2.3 Utility Components

#### Template Engine

**Purpose**: Resolve `{{variable}}` placeholders

**Algorithm**:
```
1. Find all {{...}} patterns using regex
2. For each match:
   a. Parse path (e.g., "steps.s01.output.results[0].text")
   b. Resolve path in context object
   c. Format value as string
   d. Replace placeholder with value
3. Return resolved string
```

**Security**: No `eval()`, only safe path traversal

**Performance**: O(n*m) where n=string length, m=number of placeholders

#### Expression Engine

**Purpose**: Evaluate boolean expressions

**Grammar**:
```
expression := logical_expr
logical_expr := comparison_expr (('&&' | '||') comparison_expr)*
comparison_expr := value (('==' | '!=' | '>' | '<' | '>=' | '<=') value)?
value := literal | variable
literal := string | number | boolean | null
variable := path
```

**Security**: Custom parser, no eval

**Supported Operations**:
- Comparisons: ==, !=, >, <, >=, <=
- String ops: contains, startsWith, endsWith
- Logical: &&, ||, !
- Parentheses: ()

---

## 3. Data Architecture

### 3.1 Domain Models

**Entity Relationships**:

```
Organization (1) ──────< (N) SubOrganization
     │                           │
     │                           │
     ├───────< (N) KnowledgeCollection
     │                │
     │                ├───< (N) Document
     │                │         │
     │                │         └───< (N) DocumentChunk
     │                │
     └───────< (N) Workflow
                      │
                      └───< (N) WorkflowExecution
```

**Tenant Isolation**:
- Every entity has `organizationId`
- Sub-org entities also have `subOrganizationId`
- All queries MUST filter by organization

**Versioning Strategy**:
- Workflows: Immutable versions with history chain
- Collections: Version field for schema migrations
- Documents: Version increments on updates

### 3.2 Data Storage (Production)

**Recommended Stack**:

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| Workflows, Orgs, Docs | PostgreSQL | Relational, ACID, JSON support |
| Document Chunks + Embeddings | PostgreSQL + pgvector | Co-located with metadata |
| Execution Logs | TimescaleDB | Time-series optimization |
| Workflow Configs (versioned) | S3 + CDN | Immutable, cacheable |
| Metrics | Prometheus | Time-series metrics |

**Alternative: Separate Vector DB**:
- Pinecone, Weaviate, Milvus for vectors
- PostgreSQL for metadata
- Trade-off: Joins become more complex

### 3.3 Data Access Patterns

**Read Patterns**:
1. **Get Workflow by ID**: Direct lookup, cached
2. **Search Document Chunks**: Vector similarity + metadata filter
3. **Get Execution by ID**: Direct lookup
4. **List Workflows for Org**: Scan with org filter + pagination

**Write Patterns**:
1. **Create Workflow**: Insert new version, update `isLatest`
2. **Update Workflow Execution**: Append-only step executions
3. **Index Document**: Chunking → Embedding → Batch insert

**Caching Strategy**:
- Workflow definitions: Redis, TTL = 1 hour
- Embeddings: None (too large)
- Execution records: None (real-time)

---

## 4. Execution Flow

### 4.1 Sequence Diagram: Workflow Execution

```
User          API          Executor       Registry      Handler        Service
 │             │               │             │              │             │
 │──Request───>│               │             │              │             │
 │             │──execute()───>│             │              │             │
 │             │               │──validate()─>│              │             │
 │             │               │<─valid──────>│              │             │
 │             │               │             │              │             │
 │             │               │──getHandler('RAG')─────────>│             │
 │             │               │<─handler────────────────────│             │
 │             │               │             │              │             │
 │             │               │──execute()─────────────────>│             │
 │             │               │             │              │──search()──>│
 │             │               │             │              │<─results────│
 │             │               │<─result─────────────────────│             │
 │             │               │             │              │             │
 │             │               │──getHandler('LLM')─────────>│             │
 │             │               │<─handler────────────────────│             │
 │             │               │             │              │             │
 │             │               │──execute()─────────────────>│             │
 │             │               │             │              │──complete()─>│
 │             │               │             │              │<─response───│
 │             │               │<─result─────────────────────│             │
 │             │               │             │              │             │
 │             │<─execution────│             │              │             │
 │<─Response───│               │             │              │             │
```

### 4.2 State Transitions

**WorkflowExecution States**:
```
          ┌─────────┐
          │ PENDING │
          └────┬────┘
               │ start()
               ▼
          ┌─────────┐
          │ RUNNING │─────┐
          └────┬────┘     │
               │          │ timeout
               │          │
     ┌─────────┼──────────┼────────┐
     │         │          │        │
     ▼         ▼          ▼        ▼
┌─────────┐ ┌───────┐ ┌────────┐ ┌──────────┐
│COMPLETED│ │FAILED │ │TIMEOUT │ │CANCELLED │
└─────────┘ └───────┘ └────────┘ └──────────┘
```

**Step States**:
```
PENDING → RUNNING → COMPLETED
              ↓
           FAILED ──retry?──┐
              ↓             │
           SKIPPED ←────────┘
```

---

## 5. Scalability & Performance

### 5.1 Scaling Strategies

**Horizontal Scaling**:
```
            ┌─────────────┐
            │Load Balancer│
            └──────┬──────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────▼────┐   ┌────▼────┐   ┌────▼────┐
│Engine 1 │   │Engine 2 │   │Engine 3 │
└────┬────┘   └────┬────┘   └────┬────┘
     │             │             │
     └─────────────┼─────────────┘
                   │
          ┌────────▼────────┐
          │  Shared Storage │
          │  (PostgreSQL)   │
          └─────────────────┘
```

**Stateless Executor**: Each execution is independent

**Concurrency**: Multiple executors can run simultaneously

**Bottlenecks**:
1. **LLM API calls**: Rate limited by provider
   - Mitigation: Request queue, fallback models
2. **Vector search**: Database I/O
   - Mitigation: Caching, read replicas
3. **Large workflows**: Memory usage
   - Mitigation: Streaming, context pruning

### 5.2 Performance Targets

| Metric | Target | Current (Mock) |
|--------|--------|----------------|
| Workflow execution (simple) | < 500ms | ~200ms |
| Workflow execution (complex) | < 5s | ~2s |
| RAG query latency | < 200ms | ~100ms |
| LLM call latency | < 2s | ~300ms |
| Concurrent executions | 100/sec | Unlimited (mock) |
| Max workflow size | 100 steps | 100 steps |

### 5.3 Optimization Opportunities

1. **Caching**:
   - Workflow definitions (rarely change)
   - Embeddings (expensive to generate)
   - LLM responses (if deterministic)

2. **Parallel Execution**:
   - Independent RAG queries
   - Multiple LLM calls
   - API calls

3. **Lazy Loading**:
   - Don't load full context upfront
   - Stream large outputs

---

## 6. Security Architecture

### 6.1 Multi-Tenancy Isolation

**Data Isolation**:
```sql
-- Every query MUST include organization filter
SELECT * FROM workflows
WHERE organization_id = $1 AND id = $2;

-- Prevent cross-tenant joins
SELECT w.*, c.* FROM workflows w
JOIN knowledge_collections c
  ON w.organization_id = c.organization_id  -- Same tenant
WHERE w.organization_id = $1;
```

**Row-Level Security** (PostgreSQL):
```sql
CREATE POLICY tenant_isolation ON workflows
  USING (organization_id = current_setting('app.current_org')::text);
```

### 6.2 Input Validation

**Layers of Validation**:
1. **API Layer**: Request schema validation
2. **Workflow Validator**: Structure validation
3. **Step Handler**: Parameter validation
4. **Template Engine**: Variable resolution safety
5. **Expression Engine**: Expression syntax safety

**Example**:
```typescript
// API Layer
const inputSchema = z.object({
  question: z.string().min(1).max(1000),
  context: z.record(z.unknown()).optional()
});

// Step Handler
RAGStepParamsSchema.parse(params);  // Zod validation

// Template Engine
// Only allows safe path access, no code execution
```

### 6.3 Secrets Management

**Assumptions** (Future Implementation):
```typescript
interface SecretsManager {
  getAPIKey(organizationId: string, service: string): Promise<string>
  encryptSensitiveData(data: string): Promise<string>
}

// Usage in LLM Service
const apiKey = await secrets.getAPIKey(orgId, 'openai');
```

---

## 7. Integration Points

### 7.1 External Services

**LLM Providers**:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Cohere
- Local models (Ollama)

**Vector Databases**:
- PostgreSQL + pgvector
- Pinecone
- Weaviate
- Milvus

**Monitoring**:
- OpenTelemetry
- Datadog
- Grafana + Prometheus

### 7.2 API Design (Future)

**RESTful Endpoints**:
```
POST   /v1/workflows                     Create workflow
GET    /v1/workflows/:id                 Get workflow
PUT    /v1/workflows/:id                 Update workflow (creates new version)
POST   /v1/workflows/:id/execute         Execute workflow
GET    /v1/executions/:id                Get execution details

POST   /v1/collections                   Create collection
POST   /v1/collections/:id/documents     Upload document
GET    /v1/collections/:id/search        Search collection
```

**Authentication**:
```
Authorization: Bearer <JWT_TOKEN>

JWT Payload:
{
  "userId": "user_123",
  "organizationId": "org_demo",
  "subOrganizationId": "suborg_sales",
  "permissions": ["workflows:execute", "collections:read"]
}
```

---

## 8. Deployment Architecture

### 8.1 Recommended Deployment

**Infrastructure**:
```
┌─────────────────────────────────────────────────────┐
│                     AWS / GCP                        │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │         Load Balancer (ALB)                     │ │
│  └──────────────────┬─────────────────────────────┘ │
│                     │                                │
│  ┌──────────────────▼─────────────────────────────┐ │
│  │   Auto Scaling Group (Node.js Containers)      │ │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐   │ │
│  │   │Engine Pod│  │Engine Pod│  │Engine Pod│   │ │
│  │   └──────────┘  └──────────┘  └──────────┘   │ │
│  └──────────────────┬─────────────────────────────┘ │
│                     │                                │
│  ┌──────────────────▼─────────────────────────────┐ │
│  │        PostgreSQL (RDS) + pgvector              │ │
│  │        - Primary + Read Replicas                │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │         Redis (ElastiCache)                     │ │
│  │         - Workflow definition cache             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │     CloudWatch / Datadog (Observability)        │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Container Image**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Environment Variables**:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
OPENAI_API_KEY=sk-...
LOG_LEVEL=info
MAX_CONCURRENT_EXECUTIONS=100
```

### 8.2 High Availability

**Requirements**:
- 99.9% uptime (< 8.76 hours downtime/year)
- No single point of failure
- Automatic failover

**Architecture**:
- Multi-AZ deployment
- Read replicas for database
- Redis cluster mode
- Health checks + auto-recovery

---

## Wrapping Up

Key points:
- Clean separation of concerns
- Extensible through abstractions
- Stateless design for horizontal scaling
- Observability built-in
- Multi-layer validation for security

Ready for production with real databases and LLM APIs.

---

**Author**: Rajan Mishra  
**Last Updated**: December 5, 2025  
