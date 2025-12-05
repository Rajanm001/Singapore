/**
 * Template Engine
 * Safely resolves template variables in strings using {{variable.path}} syntax.
 * Supports nested object access, array indexing, and default values.
 */

export interface TemplateContext {
  input: Record<string, unknown>;
  steps: Record<string, StepOutput>;
  context: Record<string, unknown>;
}

export interface StepOutput {
  output: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Resolve template variables in a string
 * Supports:
 * - {{input.fieldName}}
 * - {{steps.stepId.output.field}}
 * - {{steps.stepId.output[0].field}}
 * - {{context.variable}}
 * 
 * @param template - Template string with {{variable}} placeholders
 * @param context - Context object containing input, steps, and context
 * @returns Resolved string with variables replaced
 */
export function resolveTemplate(template: string, context: TemplateContext): string {
  // Find all {{...}} patterns
  const pattern = /\{\{([^}]+)\}\}/g;
  
  return template.replace(pattern, (match, path) => {
    const trimmedPath = path.trim();
    
    try {
      const value = resolvePath(trimmedPath, context);
      return formatValue(value);
    } catch (error) {
      // Return original placeholder if resolution fails
      console.warn(`Failed to resolve template variable: ${trimmedPath}`, error);
      return match;
    }
  });
}

/**
 * Resolve a dot-notation path in the context object
 * Examples:
 * - "input.question" -> context.input.question
 * - "steps.s01.output.results[0].text" -> context.steps.s01.output.results[0].text
 */
export function resolvePath(path: string, context: TemplateContext): unknown {
  const parts = parsePath(path);
  let current: unknown = context;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      throw new Error(`Cannot access property '${part}' of ${current}`);
    }
    
    if (typeof current !== 'object') {
      throw new Error(`Cannot access property '${part}' of non-object`);
    }
    
    if (part.type === 'property') {
      current = (current as Record<string, unknown>)[part.name];
    } else if (part.type === 'index') {
      if (!Array.isArray(current)) {
        throw new Error(`Cannot use array index on non-array`);
      }
      current = current[part.index];
    }
  }
  
  return current;
}

/**
 * Parse a path string into parts
 * Examples:
 * - "input.question" -> [{type: 'property', name: 'input'}, {type: 'property', name: 'question'}]
 * - "steps.s01.output[0]" -> [{type: 'property', name: 'steps'}, {type: 'property', name: 's01'}, {type: 'property', name: 'output'}, {type: 'index', index: 0}]
 */
function parsePath(path: string): Array<{ type: 'property'; name: string } | { type: 'index'; index: number }> {
  const parts: Array<{ type: 'property'; name: string } | { type: 'index'; index: number }> = [];
  let current = '';
  let i = 0;
  
  while (i < path.length) {
    const char = path[i]!;
    
    if (char === '.') {
      if (current) {
        parts.push({ type: 'property', name: current });
        current = '';
      }
      i++;
    } else if (char === '[') {
      if (current) {
        parts.push({ type: 'property', name: current });
        current = '';
      }
      
      // Find closing bracket
      const closingBracket = path.indexOf(']', i);
      if (closingBracket === -1) {
        throw new Error(`Missing closing bracket in path: ${path}`);
      }
      
      const indexStr = path.substring(i + 1, closingBracket);
      const index = parseInt(indexStr, 10);
      
      if (isNaN(index)) {
        throw new Error(`Invalid array index: ${indexStr}`);
      }
      
      parts.push({ type: 'index', index });
      i = closingBracket + 1;
    } else {
      current += char;
      i++;
    }
  }
  
  if (current) {
    parts.push({ type: 'property', name: current });
  }
  
  return parts;
}

/**
 * Format a value for string interpolation
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}

/**
 * Resolve templates in an entire object recursively
 */
export function resolveTemplateObject<T>(obj: T, context: TemplateContext): T {
  if (typeof obj === 'string') {
    return resolveTemplate(obj, context) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveTemplateObject(item, context)) as T;
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveTemplateObject(value, context);
    }
    
    return result as T;
  }
  
  return obj;
}

/**
 * Check if a string contains template variables
 */
export function hasTemplateVariables(str: string): boolean {
  return /\{\{[^}]+\}\}/.test(str);
}

/**
 * Extract all template variable paths from a string
 */
export function extractTemplateVariables(str: string): string[] {
  const pattern = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = pattern.exec(str)) !== null) {
    variables.push(match[1]!.trim());
  }
  
  return variables;
}
