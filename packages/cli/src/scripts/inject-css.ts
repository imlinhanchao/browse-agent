interface InjectCssOptions {
  tabId?: number;
}

export async function injectCSS(agent: any, code: string, options: InjectCssOptions = {}): Promise<unknown> {
  const result = await agent.injectCSS(code, options.tabId);
  return result;
}
