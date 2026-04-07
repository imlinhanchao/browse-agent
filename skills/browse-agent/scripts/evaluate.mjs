/**
 * Evaluate a JavaScript expression on the page and return the result.
 *
 * Usage:
 *   import { evaluate } from './evaluate.mjs';
 *   const result = await evaluate(agent, 'document.title');
 *   const result = await evaluate(agent, '1 + 1', { tabId: 123 });
 *
 * Returns: { result }
 */
export async function evaluate(agent, expression, options = {}) {
  const result = await agent.evaluate(expression, options);
  return result.data;
}
