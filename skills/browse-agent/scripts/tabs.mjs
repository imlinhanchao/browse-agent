/**
 * Manage browser tabs: list, close, activate.
 *
 * Usage:
 *   import { listTabs, closeTab, activateTab } from './tabs.mjs';
 *
 *   const tabs = await listTabs(agent);
 *   await activateTab(agent, tabId);
 *   await closeTab(agent, tabId);
 *
 * Returns:
 *   listTabs:    { tabs: [{ id, url, title, active }] }
 *   closeTab:    void
 *   activateTab: void
 */
export async function listTabs(agent) {
  const result = await agent.listTabs();
  return result;
}

export async function closeTab(agent, tabId) {
  await agent.closeTab(tabId);
}

export async function activateTab(agent, tabId) {
  await agent.activateTab(tabId);
}
