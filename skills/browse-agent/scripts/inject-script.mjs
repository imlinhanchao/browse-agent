/**
 * Inject and execute JavaScript code on the page.
 *
 * Usage:
 *   import { injectScript } from './inject-script.mjs';
 *   const result = await injectScript(agent, 'document.body.style.background = "red"');
 *   const result = await injectScript(agent, code, { tabId: 123 });
 *
 * Returns: { success }
 */
export async function injectScript(agent, code, options = {}) {
  const result = await agent.injectScript(code, options);
  return result.data;
}
