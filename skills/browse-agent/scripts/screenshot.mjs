/**
 * Take a screenshot of the page.
 *
 * Usage:
 *   import { screenshot } from './screenshot.mjs';
 *
 *   // Capture visible viewport
 *   const result = await screenshot(agent, 'visible');
 *
 *   // Capture full page
 *   const result = await screenshot(agent, 'fullPage', { format: 'png' });
 *
 *   // Capture specific area
 *   const result = await screenshot(agent, 'area', {
 *     clip: { x: 0, y: 0, width: 800, height: 600 },
 *     format: 'jpeg', quality: 80,
 *   });
 *
 * Returns: { data (base64), format, width, height }
 */
export async function screenshot(agent, mode = 'visible', options = {}) {
  let result;
  switch (mode) {
    case 'fullPage':
      result = await agent.screenshotFullPage(options);
      break;
    case 'area':
      if (!options.clip) throw new Error('clip option required for area screenshot');
      result = await agent.screenshotArea(options.clip, options);
      break;
    case 'visible':
    default:
      result = await agent.screenshotVisible(options);
      break;
  }
  return result.data;
}
