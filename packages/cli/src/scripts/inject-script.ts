interface InjectScriptOptions {
  tabId?: number;
}

export async function injectScript(agent: any, code: string, options: InjectScriptOptions = {}): Promise<unknown> {
  const result = await agent.injectScript(code, options.tabId);
  return result;
}
