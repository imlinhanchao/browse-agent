import type { ScreenshotCommand, ScreenshotResult } from '@anthropic/browse-agent-shared';
import { resolveTabId } from './navigate';

/**
 * Capture a screenshot of a tab.
 * Supports: visible viewport, full page (via debugger), and area capture.
 */
export async function handleScreenshot(cmd: ScreenshotCommand): Promise<ScreenshotResult> {
  const tabId = await resolveTabId(cmd.tabId);
  const format = cmd.format || 'png';

  switch (cmd.mode) {
    case 'visible':
      return captureVisible(tabId, format, cmd.quality);
    case 'fullPage':
      return captureFullPage(tabId, format, cmd.quality);
    case 'area':
      if (!cmd.clip) throw new Error('clip is required for area screenshot mode');
      return captureArea(tabId, format, cmd.clip, cmd.quality);
    default:
      throw new Error(`Unknown screenshot mode: ${cmd.mode}`);
  }
}

/**
 * Capture visible viewport using chrome.tabs.captureVisibleTab.
 */
async function captureVisible(
  tabId: number,
  format: 'png' | 'jpeg',
  quality?: number
): Promise<ScreenshotResult> {
  const tab = await chrome.tabs.get(tabId);

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format,
    quality: quality ?? (format === 'jpeg' ? 80 : undefined),
  });

  // Strip data URL prefix to get pure base64
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return { data: base64, format };
}

/**
 * Capture full page screenshot using Chrome DevTools Protocol via chrome.debugger.
 */
async function captureFullPage(
  tabId: number,
  format: 'png' | 'jpeg',
  quality?: number
): Promise<ScreenshotResult> {
  await chrome.debugger.attach({ tabId }, '1.3');

  try {
    // Get page layout metrics
    const layoutMetrics = await chrome.debugger.sendCommand(
      { tabId },
      'Page.getLayoutMetrics'
    ) as any;

    const { cssContentSize } = layoutMetrics;
    const width = Math.ceil(cssContentSize.width);
    const height = Math.ceil(cssContentSize.height);

    // Override device metrics to fit entire page
    await chrome.debugger.sendCommand({ tabId }, 'Emulation.setDeviceMetricsOverride', {
      mobile: false,
      width,
      height,
      deviceScaleFactor: 1,
    });

    const result = await chrome.debugger.sendCommand(
      { tabId },
      'Page.captureScreenshot',
      {
        format,
        quality: quality ?? (format === 'jpeg' ? 80 : undefined),
        fromSurface: true,
        captureBeyondViewport: true,
      }
    ) as { data: string };

    // Reset device metrics
    await chrome.debugger.sendCommand({ tabId }, 'Emulation.clearDeviceMetricsOverride');

    return { data: result.data, format, width, height };
  } finally {
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}

/**
 * Capture a specific area using Chrome DevTools Protocol.
 */
async function captureArea(
  tabId: number,
  format: 'png' | 'jpeg',
  clip: { x: number; y: number; width: number; height: number },
  quality?: number
): Promise<ScreenshotResult> {
  await chrome.debugger.attach({ tabId }, '1.3');

  try {
    const result = await chrome.debugger.sendCommand(
      { tabId },
      'Page.captureScreenshot',
      {
        format,
        quality: quality ?? (format === 'jpeg' ? 80 : undefined),
        fromSurface: true,
        clip: {
          x: clip.x,
          y: clip.y,
          width: clip.width,
          height: clip.height,
          scale: 1,
        },
      }
    ) as { data: string };

    return {
      data: result.data,
      format,
      width: clip.width,
      height: clip.height,
    };
  } finally {
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}
