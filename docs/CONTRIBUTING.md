# Contributing to Knowledge & Workflow Engine

Thanks for considering contributing! Here's how to get started.

## Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/knowledge-workflow-engine.git
   cd knowledge-workflow-engine
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Build**
   ```bash
   npm run build
   ```

## Code Standards

### TypeScript
- Use strict TypeScript mode
- No implicit `any` types
- Prefer interfaces over types for object shapes
- Use Zod for runtime validation

### Code Style
- Run `npm run format` before committing
- Run `npm run lint` to check for issues
- Follow existing patterns in the codebase

### Testing
- Write unit tests for utilities and handlers
- Write integration tests for workflows
- Aim for 80%+ code coverage
- Tests should be fast and deterministic

## Pull Request Process

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

4. **Commit**
   ```bash
   git commit -m "feat: add new feature"
   ```
   
   Use conventional commit format:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `test:` - Test changes
   - `refactor:` - Code refactoring
   - `chore:` - Maintenance tasks

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Adding New Step Types

To add a new step handler:

1. **Create Handler Class**
   ```typescript
   // src/workflows/handlers/yourStepHandler.ts
   import { BaseStepHandler, type StepResult, type StepExecutionContext } from './baseStepHandler.ts';
   
   export class YourStepHandler extends BaseStepHandler {
     readonly type = 'YOUR_TYPE';
     readonly description = 'Your step description';
     
     validateParams(params: Record<string, unknown>): void {
       // Validate parameters
     }
     
     async execute(
       params: Record<string, unknown>,
       context: StepExecutionContext
     ): Promise<StepResult> {
       // Your implementation
     }
   }
   ```

2. **Add Zod Schema**
   ```typescript
   // src/models/workflowStep.ts
   export const YourStepParamsSchema = z.object({
     // Your parameters
   });
   ```

3. **Update StepType Enum**
   ```typescript
   export enum StepType {
     // ... existing types
     YOUR_TYPE = 'YOUR_TYPE',
   }
   ```

4. **Register Handler**
   ```typescript
   // src/index.ts or initialization code
   globalStepRegistry.register('YOUR_TYPE', new YourStepHandler());
   ```

5. **Write Tests**
   ```typescript
   // tests/unit/yourStepHandler.test.ts
   describe('YourStepHandler', () => {
     // Test cases
   });
   ```

## Documentation

- Update README.md for user-facing changes
- Update docs/ for architectural changes
- Add JSDoc comments for public APIs
- Include examples in documentation

## Code Review

All submissions require review. Reviewers will check for:
- Code quality and style
- Test coverage
- Documentation completeness
- Breaking changes
- Performance implications

## Questions?

- Check existing issues and PRs
- Review documentation in /docs
- Ask in discussions

Thank you for contributing! 🚀
