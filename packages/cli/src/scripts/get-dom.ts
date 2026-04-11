interface GetDomOptions {
  property?: string;
  all?: boolean;
  tabId?: number;
}

export async function getDOM(agent: any, selector: string, options: GetDomOptions = {}): Promise<unknown> {
  const result = await agent.getDOM(selector, options);
  return result;
}
