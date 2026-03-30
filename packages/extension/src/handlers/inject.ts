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
 * Inject JavaScript into a page.
 */
export async function handleInjectScript(cmd: InjectScriptCommand): Promise<InjectResult> {
  const tabId = await resolveTabId(cmd.tabId);

  if (cmd.code) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (code: string) => {
        const script = document.createElement('script');
        script.textContent = code;
        document.documentElement.appendChild(script);
        script.remove();
      },
      args: [cmd.code],
      world: 'MAIN',
    });
    return { result: results[0]?.result ?? null };
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

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (expr: string) => {
      const script = document.createElement('script');
      const resultKey = '__browseAgentEvalResult_' + Date.now();
      script.textContent = `window["${resultKey}"] = (function(){ try { return ${expr}; } catch(e) { return { __error: e.message }; } })();`;
      document.documentElement.appendChild(script);
      script.remove();
      const result = (window as any)[resultKey];
      delete (window as any)[resultKey];
      return result;
    },
    args: [cmd.expression],
    world: 'MAIN',
  });

  return { result: results[0]?.result ?? null };
}
