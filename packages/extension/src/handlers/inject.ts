import type {
  InjectScriptCommand,
  InjectCSSCommand,
  GetDOMCommand,
  EvaluateCommand,
  InjectResult,
  DOMResult,
  EvaluateResult,
} from '@anthropic/browse-agent-shared';
import { resolveTabId } from './navigate';

/**
 * Execute JS via Chrome DevTools Protocol Runtime.evaluate.
 * This bypasses all CSP restrictions.
 */
async function cdpEvaluate(tabId: number, expression: string): Promise<unknown> {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    const result = await chrome.debugger.sendCommand(
      { tabId },
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true,
      }
    ) as { result: { value?: unknown; type: string; description?: string }; exceptionDetails?: { text: string; exception?: { description?: string } } };

    if (result.exceptionDetails) {
      const msg = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(msg);
    }

    return result.result?.value ?? null;
  } finally {
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}

/**
 * Inject JavaScript into a page.
 */
export async function handleInjectScript(cmd: InjectScriptCommand): Promise<InjectResult> {
  const tabId = await resolveTabId(cmd.tabId);

  if (cmd.code) {
    const result = await cdpEvaluate(tabId, cmd.code);
    return { result };
  }

  if (cmd.file) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: [cmd.file],
    });
    return { result: results[0]?.result ?? null };
  }

  throw new Error('Either code or file must be provided for injectScript');
}

/**
 * Inject CSS into a page.
 */
export async function handleInjectCSS(cmd: InjectCSSCommand): Promise<void> {
  const tabId = await resolveTabId(cmd.tabId);

  if (cmd.code) {
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: cmd.code,
    });
    return;
  }

  if (cmd.file) {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: [cmd.file],
    });
    return;
  }

  throw new Error('Either code or file must be provided for injectCSS');
}

/**
 * Get DOM content matching a CSS selector.
 */
export async function handleGetDOM(cmd: GetDOMCommand): Promise<DOMResult> {
  const tabId = await resolveTabId(cmd.tabId);
  const property = cmd.property || 'outerHTML';

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (selector: string, prop: string, all: boolean) => {
      if (all) {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => (el as any)[prop] as string);
      }
      const el = document.querySelector(selector);
      if (!el) return [];
      return [(el as any)[prop] as string];
    },
    args: [cmd.selector, property, cmd.all ?? false],
  });

  return { elements: (results[0]?.result as string[]) ?? [] };
}

/**
 * Evaluate a JavaScript expression and return the result.
 */
export async function handleEvaluate(cmd: EvaluateCommand): Promise<EvaluateResult> {
  const tabId = await resolveTabId(cmd.tabId);
  const result = await cdpEvaluate(tabId, cmd.expression);
  return { result };
}
