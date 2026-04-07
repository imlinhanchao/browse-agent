/**
 * Query DOM elements on the page.
 *
 * Usage:
 *   import { getDOM } from './get-dom.mjs';
 *   const result = await getDOM(agent, 'h1');
 *   const result = await getDOM(agent, '.item', { property: 'innerText', all: true, tabId: 123 });
 *
 * Options:
 *   property - 'outerHTML' | 'innerHTML' | 'innerText' (default: 'outerHTML')
 *   all      - true to return all matches, false for first only
 *   tabId    - target tab
 *
 * Returns: { result }
 */
export async function getDOM(agent, selector, options = {}) {
  const result = await agent.getDOM(selector, options);
  return result.data;
}
