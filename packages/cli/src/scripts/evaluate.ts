interface EvaluateOptions {
  tabId?: number;
}

export async function evaluate(agent: any, expression: string, options: EvaluateOptions = {}): Promise<unknown> {
  const result = await agent.evaluate(expression, options.tabId);
  return result;
}
