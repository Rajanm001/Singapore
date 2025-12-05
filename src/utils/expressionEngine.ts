/**
 * Expression Engine
 * Safely evaluates boolean expressions for conditional workflow branching.
 * Supports comparison operators, logical operators, and null checks.
 * 
 * SECURITY: Does NOT use eval() or Function() constructor.
 * Implements a safe parser and evaluator for a restricted expression language.
 */

import type { TemplateContext } from './templateEngine.ts';
import { resolvePath as resolveTemplatePath } from './templateEngine.ts';

/**
 * Supported operators
 */
type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'startsWith' | 'endsWith';
type LogicalOperator = '&&' | '||';

/**
 * Expression AST nodes
 */
type Expression =
  | { type: 'comparison'; left: Value; operator: ComparisonOperator; right: Value }
  | { type: 'logical'; left: Expression; operator: LogicalOperator; right: Expression }
  | { type: 'not'; expression: Expression }
  | { type: 'value'; value: Value };

type Value =
  | { type: 'literal'; value: string | number | boolean | null }
  | { type: 'variable'; path: string };

/**
 * Evaluate a boolean expression against a context
 * 
 * Supported expressions:
 * - Comparisons: ==, !=, >, <, >=, <=
 * - String ops: contains, startsWith, endsWith
 * - Logical: &&, ||, !
 * - Null checks: variable == null
 * 
 * Examples:
 * - "steps.s01.output.score > 0.7"
 * - "steps.s01.output.count == 0 || steps.s01.output.score < 0.5"
 * - "steps.s02.output.answer contains 'refund'"
 * 
 * @param expression - Expression string to evaluate
 * @param context - Template context with variables
 * @returns Boolean result of evaluation
 */
export function evaluateExpression(expression: string, context: TemplateContext): boolean {
  try {
    const ast = parseExpression(expression);
    return evaluateNode(ast, context);
  } catch (error) {
    console.error(`Failed to evaluate expression: ${expression}`, error);
    return false;
  }
}

/**
 * Parse expression string into AST
 */
function parseExpression(expr: string): Expression {
  const tokens = tokenize(expr);
  return parseLogical(tokens);
}

/**
 * Tokenize expression string
 */
function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i]!;
    const nextChar = expr[i + 1];
    
    // Handle string literals
    if ((char === '"' || char === "'") && !inString) {
      inString = true;
      stringChar = char;
      current = char;
      continue;
    }
    
    if (char === stringChar && inString) {
      inString = false;
      current += char;
      tokens.push(current);
      current = '';
      continue;
    }
    
    if (inString) {
      current += char;
      continue;
    }
    
    // Handle operators
    if (char === '&' && nextChar === '&') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push('&&');
      current = '';
      i++;
      continue;
    }
    
    if (char === '|' && nextChar === '|') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push('||');
      current = '';
      i++;
      continue;
    }
    
    if (char === '=' && nextChar === '=') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push('==');
      current = '';
      i++;
      continue;
    }
    
    if (char === '!' && nextChar === '=') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push('!=');
      current = '';
      i++;
      continue;
    }
    
    if (char === '>' && nextChar === '=') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push('>=');
      current = '';
      i++;
      continue;
    }
    
    if (char === '<' && nextChar === '=') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push('<=');
      current = '';
      i++;
      continue;
    }
    
    if (char === '>' || char === '<') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(char);
      current = '';
      continue;
    }
    
    if (char === '!' && nextChar !== '=') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push('!');
      current = '';
      continue;
    }
    
    if (char === '(' || char === ')') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(char);
      current = '';
      continue;
    }
    
    // Whitespace handling
    if (char === ' ' && current.trim()) {
      tokens.push(current.trim());
      current = '';
      continue;
    }
    
    if (char !== ' ') {
      current += char;
    }
  }
  
  if (current.trim()) {
    tokens.push(current.trim());
  }
  
  return tokens;
}

/**
 * Parse logical operators (&&, ||)
 */
function parseLogical(tokens: string[]): Expression {
  let left = parseNot(tokens);
  
  while (tokens.length > 0 && (tokens[0] === '&&' || tokens[0] === '||')) {
    const operator = tokens.shift() as LogicalOperator;
    const right = parseNot(tokens);
    left = { type: 'logical', left, operator, right };
  }
  
  return left;
}

/**
 * Parse NOT operator (!)
 */
function parseNot(tokens: string[]): Expression {
  if (tokens[0] === '!') {
    tokens.shift();
    const expression = parseComparison(tokens);
    return { type: 'not', expression };
  }
  
  return parseComparison(tokens);
}

/**
 * Parse comparison operators
 */
function parseComparison(tokens: string[]): Expression {
  // Handle parentheses
  if (tokens.length > 0 && tokens[0] === '(') {
    tokens.shift();
    const expr = parseLogical(tokens);
    // Check for closing paren (using type assertion to work around TS control flow issue)
    if (tokens.length > 0 && (tokens[0] as string) === ')') {
      tokens.shift();
    }
    return expr;
  }
  
  const left = parseValue(tokens);
  
  const comparisonOps: ComparisonOperator[] = ['==', '!=', '>=', '<=', '>', '<', 'contains', 'startsWith', 'endsWith'];
  
  if (tokens.length > 0 && comparisonOps.includes(tokens[0] as ComparisonOperator)) {
    const operator = tokens.shift() as ComparisonOperator;
    const right = parseValue(tokens);
    return { type: 'comparison', left, operator, right };
  }
  
  return { type: 'value', value: left };
}

/**
 * Parse value (literal or variable)
 */
function parseValue(tokens: string[]): Value {
  if (tokens.length === 0) {
    throw new Error('Unexpected end of expression');
  }
  
  const token = tokens.shift()!;
  
  // String literal
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    return { type: 'literal', value: token.slice(1, -1) };
  }
  
  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return { type: 'literal', value: parseFloat(token) };
  }
  
  // Boolean literal
  if (token === 'true') {
    return { type: 'literal', value: true };
  }
  
  if (token === 'false') {
    return { type: 'literal', value: false };
  }
  
  // Null literal
  if (token === 'null') {
    return { type: 'literal', value: null };
  }
  
  // Variable
  return { type: 'variable', path: token };
}

/**
 * Evaluate AST node
 */
function evaluateNode(node: Expression, context: TemplateContext): boolean {
  if (node.type === 'comparison') {
    const left = resolveValue(node.left, context);
    const right = resolveValue(node.right, context);
    return evaluateComparison(left, node.operator, right);
  }
  
  if (node.type === 'logical') {
    const left = evaluateNode(node.left, context);
    const right = evaluateNode(node.right, context);
    
    if (node.operator === '&&') {
      return left && right;
    }
    
    if (node.operator === '||') {
      return left || right;
    }
  }
  
  if (node.type === 'not') {
    return !evaluateNode(node.expression, context);
  }
  
  if (node.type === 'value') {
    const value = resolveValue(node.value, context);
    return !!value;
  }
  
  return false;
}

/**
 * Resolve a value (literal or variable)
 */
function resolveValue(value: Value, context: TemplateContext): unknown {
  if (value.type === 'literal') {
    return value.value;
  }
  
  if (value.type === 'variable') {
    try {
      // Reuse template engine's path resolution
      return resolveTemplatePath(value.path, context);
    } catch {
      return undefined;
    }
  }
  
  return undefined;
}

/**
 * Evaluate comparison
 */
function evaluateComparison(left: unknown, operator: ComparisonOperator, right: unknown): boolean {
  switch (operator) {
    case '==':
      return left === right;
    
    case '!=':
      return left !== right;
    
    case '>':
      return typeof left === 'number' && typeof right === 'number' && left > right;
    
    case '<':
      return typeof left === 'number' && typeof right === 'number' && left < right;
    
    case '>=':
      return typeof left === 'number' && typeof right === 'number' && left >= right;
    
    case '<=':
      return typeof left === 'number' && typeof right === 'number' && left <= right;
    
    case 'contains':
      return typeof left === 'string' && typeof right === 'string' && left.includes(right);
    
    case 'startsWith':
      return typeof left === 'string' && typeof right === 'string' && left.startsWith(right);
    
    case 'endsWith':
      return typeof left === 'string' && typeof right === 'string' && left.endsWith(right);
    
    default:
      return false;
  }
}
