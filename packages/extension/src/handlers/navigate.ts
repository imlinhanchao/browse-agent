import type {
  NavigateCommand,
  NavigateResult,
  GetContentCommand,
  ContentResult,
  ListTabsResult,
  CloseTabCommand,
  ActivateTabCommand,
  TabInfo,
} from '@anthropic/browse-agent-shared';

/**
 * Get the active tab ID, or use the provided tabId.
 */
export async function resolveTabId(tabId?: number): Promise<number> {
  if (tabId !== undefined) return tabId;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  return tab.id;
}

/**
 * Open a URL in a new tab and wait for it to load.
 */
export async function handleNavigate(cmd: NavigateCommand): Promise<NavigateResult> {
  const timeout = cmd.timeout ?? 30000;
  const waitForLoad = cmd.waitForLoad !== false;

  const tab = await chrome.tabs.create({ url: cmd.url, active: true });

  if (!tab.id) throw new Error('Failed to create tab');

  if (waitForLoad) {
    await waitForTabLoad(tab.id, timeout);
  }

  const updatedTab = await chrome.tabs.get(tab.id);
  return {
    tabId: tab.id,
    url: updatedTab.url || cmd.url,
    title: updatedTab.title || '',
    status: updatedTab.status || 'unknown',
  };
}

/**
 * Get the contents of a page (HTML or text).
 */
export async function handleGetContent(cmd: GetContentCommand): Promise<ContentResult> {
  const tabId = await resolveTabId(cmd.tabId);
  const format = cmd.format || 'html';

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (fmt: string) => {
      if (fmt === 'text') return document.body.innerText;
      return document.documentElement.outerHTML;
    },
    args: [format],
  });

  const content = results[0]?.result ?? '';
  const tab = await chrome.tabs.get(tabId);

  return {
    content: content as string,
    url: tab.url || '',
    title: tab.title || '',
  };
}

/**
 * List all open tabs.
 */
export async function handleListTabs(): Promise<ListTabsResult> {
  const chromeTabs = await chrome.tabs.query({});
  const tabs: TabInfo[] = chromeTabs.map(t => ({
    id: t.id!,
    url: t.url || '',
    title: t.title || '',
    active: t.active || false,
    windowId: t.windowId,
  }));
  return { tabs };
}

/**
 * Close a tab.
 */
export async function handleCloseTab(cmd: CloseTabCommand): Promise<void> {
  await chrome.tabs.remove(cmd.tabId);
}

/**
 * Activate (switch to) a tab.
 */
export async function handleActivateTab(cmd: ActivateTabCommand): Promise<void> {
  await chrome.tabs.update(cmd.tabId, { active: true });
}

/**
 * Wait for a tab to finish loading.
 */
function waitForTabLoad(tabId: number, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab load timeout after ${timeout}ms`));
    }, timeout);

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}
