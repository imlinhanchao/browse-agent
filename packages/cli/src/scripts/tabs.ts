export async function listTabs(agent: any): Promise<unknown> {
  const result = await agent.listTabs();
  return result;
}

export async function closeTab(agent: any, tabId: number): Promise<void> {
  await agent.closeTab(tabId);
}

export async function activateTab(agent: any, tabId: number): Promise<void> {
  await agent.activateTab(tabId);
}
