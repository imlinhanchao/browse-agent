/**
 * Inject CSS into the page.
 *
 * Usage:
 *   import { injectCSS } from './inject-css.mjs';
 *   const result = await injectCSS(agent, 'body { background: #f0f8ff }');
 *   const result = await injectCSS(agent, css, { tabId: 123 });
 *
 * Returns: { success }
 */
export async function injectCSS(agent, code, options = {}) {
  const result = await agent.injectCSS(code, options);
  return result.data;
}
