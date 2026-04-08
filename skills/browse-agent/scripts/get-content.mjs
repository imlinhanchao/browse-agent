/**
 * Get page content (HTML or text).
 *
 * Usage:
 *   import { getContent } from './get-content.mjs';
 *   const result = await getContent(agent, { format: 'text' });
 *   const result = await getContent(agent, { format: 'html', tabId: 123 });
 *
 * Returns: { content, url, title }
 */
export async function getContent(agent, options = {}) {
  const result = await agent.getContent(options);
  return result;
}
