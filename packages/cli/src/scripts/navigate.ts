export async function navigate(agent: any, url: string, options: Record<string, unknown> = {}): Promise<unknown> {
  const result = await agent.navigate(url, options);
  return result;
}
