/**
 * Navigate to a URL in the browser.
 *
 * Usage:
 *   import { navigate } from './navigate.mjs';
 *   const result = await navigate(agent, 'https://example.com');
 *   const result = await navigate(agent, 'https://example.com', { waitForLoad: true, timeout: 10000 });
 *
 * Returns: { tabId, url, title }
 */
export async function navigate(agent, url, options = {}) {
  const result = await agent.navigate(url, options);
  return result;
}
