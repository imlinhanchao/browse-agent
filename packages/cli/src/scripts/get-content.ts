interface GetContentOptions {
  format?: string;
  tabId?: number;
}

export async function getContent(agent: any, options: GetContentOptions = {}): Promise<unknown> {
  const result = await agent.getContent(options);
  return result;
}
