interface ScreenshotClip {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenshotOptions {
  format?: string;
  quality?: number;
  tabId?: number;
  clip?: ScreenshotClip;
}

export async function screenshot(
  agent: any,
  mode = 'visible',
  options: ScreenshotOptions = {},
): Promise<unknown> {
  let result: unknown;

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

  return result;
}
