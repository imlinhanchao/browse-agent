import type {
  NavigateCommand,
  NavigateResult,
  GetContentCommand,
  ContentResult,
  InjectScriptCommand,
  InjectCSSCommand,
  InjectResult,
  GetDOMCommand,
  DOMResult,
  ScreenshotCommand,
  ScreenshotResult,
  ListTabsResult,
  CloseTabCommand,
  EvaluateCommand,
  EvaluateResult,
  Command,
} from '@anthropic/browse-agent-shared';
import { DEFAULT_PORT } from '@anthropic/browse-agent-shared';
import { WSServer, type WSServerOptions } from './ws-server.js';

export interface BrowserAgentOptions {
  /** Shared secret for HMAC authentication (required) */
  secret: string;
  /** WebSocket server port (default: 9315) */
  port?: number;
  /** WebSocket server host (default: 127.0.0.1) */
  host?: string;
  /** Default command timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * BrowserAgent - High-level API for controlling Chrome via the Browse Agent extension.
 *
 * @example
 * ```typescript
 * import { BrowserAgent } from 'browse-agent-sdk';
 *
 * const agent = new BrowserAgent({ secret: 'my-secret-key' });
 * await agent.start();
 *
 * // Wait for extension to connect
 * await agent.waitForConnection();
 *
 * // Navigate and get content
 * const result = await agent.navigate('https://example.com');
 * const content = await agent.getContent({ format: 'text' });
 *
 * // Take a screenshot
 * const screenshot = await agent.screenshot({ mode: 'fullPage' });
 *
 * // Inject JS
 * const evalResult = await agent.evaluate('document.title');
 *
 * await agent.stop();
 * ```
 */
export class BrowserAgent {
  private server: WSServer;
  private defaultTimeout: number;

  constructor(options: BrowserAgentOptions) {
    this.defaultTimeout = options.timeout ?? 30000;
    this.server = new WSServer({
      secret: options.secret,
      port: options.port ?? DEFAULT_PORT,
      host: options.host ?? '127.0.0.1',
    });
  }

  /**
   * Start the WebSocket server and begin listening for the extension.
   */
  async start(): Promise<void> {
    await this.server.start();
  }

  /**
   * Wait for the extension to connect and authenticate.
   */
  waitForConnection(timeout = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server.isConnected) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        reject(new Error(`Extension did not connect within ${timeout}ms`));
      }, timeout);

      this.server.onExtensionConnected(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * Register a callback for when the extension disconnects.
   */
  onDisconnected(cb: () => void): void {
    this.server.onExtensionDisconnected(cb);
  }

  /** Whether the extension is connected and authenticated. */
  get isConnected(): boolean {
    return this.server.isConnected;
  }

  // --------------------------------------------------------
  // Navigation
  // --------------------------------------------------------

  /**
   * Open a URL in a new tab.
   */
  async navigate(url: string, options?: { waitForLoad?: boolean; timeout?: number }): Promise<NavigateResult> {
    const cmd: NavigateCommand = {
      type: 'navigate',
      url,
      waitForLoad: options?.waitForLoad,
      timeout: options?.timeout,
    };
    return this.server.sendCommand<NavigateResult>(cmd, options?.timeout ?? this.defaultTimeout);
  }

  /**
   * Get the page content (HTML or text).
   */
  async getContent(options?: { tabId?: number; format?: 'html' | 'text' }): Promise<ContentResult> {
    const cmd: GetContentCommand = {
      type: 'getContent',
      tabId: options?.tabId,
      format: options?.format,
    };
    return this.server.sendCommand<ContentResult>(cmd, this.defaultTimeout);
  }

  /**
   * List all open tabs.
   */
  async listTabs(): Promise<ListTabsResult> {
    return this.server.sendCommand<ListTabsResult>({ type: 'listTabs' }, this.defaultTimeout);
  }

  /**
   * Close a tab.
   */
  async closeTab(tabId: number): Promise<void> {
    const cmd: CloseTabCommand = { type: 'closeTab', tabId };
    return this.server.sendCommand<void>(cmd, this.defaultTimeout);
  }

  // --------------------------------------------------------
  // Injection
  // --------------------------------------------------------

  /**
   * Inject JavaScript code into a page.
   */
  async injectScript(code: string, tabId?: number): Promise<InjectResult> {
    const cmd: InjectScriptCommand = { type: 'injectScript', code, tabId };
    return this.server.sendCommand<InjectResult>(cmd, this.defaultTimeout);
  }

  /**
   * Inject CSS into a page.
   */
  async injectCSS(code: string, tabId?: number): Promise<void> {
    const cmd: InjectCSSCommand = { type: 'injectCSS', code, tabId };
    return this.server.sendCommand<void>(cmd, this.defaultTimeout);
  }

  /**
   * Query DOM elements matching a CSS selector.
   */
  async getDOM(
    selector: string,
    options?: { tabId?: number; property?: 'outerHTML' | 'innerHTML' | 'innerText'; all?: boolean }
  ): Promise<DOMResult> {
    const cmd: GetDOMCommand = {
      type: 'getDOM',
      selector,
      tabId: options?.tabId,
      property: options?.property,
      all: options?.all,
    };
    return this.server.sendCommand<DOMResult>(cmd, this.defaultTimeout);
  }

  /**
   * Evaluate a JavaScript expression in a page and return the result.
   */
  async evaluate(expression: string, tabId?: number): Promise<EvaluateResult> {
    const cmd: EvaluateCommand = { type: 'evaluate', expression, tabId };
    return this.server.sendCommand<EvaluateResult>(cmd, this.defaultTimeout);
  }

  // --------------------------------------------------------
  // Screenshots
  // --------------------------------------------------------

  /**
   * Take a full-page screenshot.
   */
  async screenshotFullPage(options?: {
    tabId?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
  }): Promise<ScreenshotResult> {
    const cmd: ScreenshotCommand = {
      type: 'screenshot',
      mode: 'fullPage',
      tabId: options?.tabId,
      format: options?.format,
      quality: options?.quality,
    };
    return this.server.sendCommand<ScreenshotResult>(cmd, this.defaultTimeout);
  }

  /**
   * Take a screenshot of the visible viewport.
   */
  async screenshotVisible(options?: {
    tabId?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
  }): Promise<ScreenshotResult> {
    const cmd: ScreenshotCommand = {
      type: 'screenshot',
      mode: 'visible',
      tabId: options?.tabId,
      format: options?.format,
      quality: options?.quality,
    };
    return this.server.sendCommand<ScreenshotResult>(cmd, this.defaultTimeout);
  }

  /**
   * Take a screenshot of a specific area.
   */
  async screenshotArea(
    clip: { x: number; y: number; width: number; height: number },
    options?: { tabId?: number; format?: 'png' | 'jpeg'; quality?: number }
  ): Promise<ScreenshotResult> {
    const cmd: ScreenshotCommand = {
      type: 'screenshot',
      mode: 'area',
      clip,
      tabId: options?.tabId,
      format: options?.format,
      quality: options?.quality,
    };
    return this.server.sendCommand<ScreenshotResult>(cmd, this.defaultTimeout);
  }

  /**
   * Generic screenshot method.
   */
  async screenshot(options: Omit<ScreenshotCommand, 'type'>): Promise<ScreenshotResult> {
    const cmd: ScreenshotCommand = { type: 'screenshot', ...options };
    return this.server.sendCommand<ScreenshotResult>(cmd, this.defaultTimeout);
  }

  // --------------------------------------------------------
  // Low-level
  // --------------------------------------------------------

  /**
   * Send a raw command to the extension.
   */
  async sendCommand<T = unknown>(command: Command, timeout?: number): Promise<T> {
    return this.server.sendCommand<T>(command, timeout ?? this.defaultTimeout);
  }

  /**
   * Stop the agent and close all connections.
   */
  async stop(): Promise<void> {
    await this.server.stop();
  }
}
