// ============================================================
// Command Types - Messages sent from SDK to Extension
// ============================================================

/** Open a URL and optionally wait for content */
export interface NavigateCommand {
  type: 'navigate';
  url: string;
  /** Wait for page load before responding (default: true) */
  waitForLoad?: boolean;
  /** Timeout in ms (default: 30000) */
  timeout?: number;
}

/** Get the current page's HTML/text content */
export interface GetContentCommand {
  type: 'getContent';
  tabId?: number;
  /** 'html' returns full HTML, 'text' returns innerText */
  format?: 'html' | 'text';
}

/** Inject JavaScript into a page */
export interface InjectScriptCommand {
  type: 'injectScript';
  tabId?: number;
  /** JS code string to execute */
  code?: string;
  /** Path to JS file (relative to extension root) */
  file?: string;
}

/** Inject CSS into a page */
export interface InjectCSSCommand {
  type: 'injectCSS';
  tabId?: number;
  /** CSS code string */
  code?: string;
  /** Path to CSS file */
  file?: string;
}

/** Get DOM content via selector */
export interface GetDOMCommand {
  type: 'getDOM';
  tabId?: number;
  /** CSS selector */
  selector: string;
  /** Whether to get outerHTML or innerText */
  property?: 'outerHTML' | 'innerHTML' | 'innerText';
  /** Get all matching elements or just first */
  all?: boolean;
}

/** Capture a screenshot */
export interface ScreenshotCommand {
  type: 'screenshot';
  tabId?: number;
  /** 'fullPage' captures entire scrollable area, 'visible' captures viewport, 'area' captures a region */
  mode: 'fullPage' | 'visible' | 'area';
  /** Required when mode is 'area' */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Image format */
  format?: 'png' | 'jpeg';
  /** JPEG quality (0-100) */
  quality?: number;
}

/** List all open tabs */
export interface ListTabsCommand {
  type: 'listTabs';
}

/** Close a tab */
export interface CloseTabCommand {
  type: 'closeTab';
  tabId: number;
}

/** Evaluate JS and return result */
export interface EvaluateCommand {
  type: 'evaluate';
  tabId?: number;
  /** JS expression to evaluate - must return a serializable value */
  expression: string;
}

export type Command =
  | NavigateCommand
  | GetContentCommand
  | InjectScriptCommand
  | InjectCSSCommand
  | GetDOMCommand
  | ScreenshotCommand
  | ListTabsCommand
  | CloseTabCommand
  | EvaluateCommand;

// ============================================================
// Response Types - Messages sent from Extension to SDK
// ============================================================

export interface SuccessResponse<T = unknown> {
  success: true;
  requestId: string;
  data: T;
}

export interface ErrorResponse {
  success: false;
  requestId: string;
  error: string;
}

export type CommandResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// ============================================================
// Response Data Types
// ============================================================

export interface NavigateResult {
  tabId: number;
  url: string;
  title: string;
  status: string;
}

export interface ContentResult {
  content: string;
  url: string;
  title: string;
}

export interface InjectResult {
  result: unknown;
}

export interface DOMResult {
  elements: string[];
}

export interface ScreenshotResult {
  /** Base64-encoded image data */
  data: string;
  format: 'png' | 'jpeg';
  width?: number;
  height?: number;
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
}

export interface ListTabsResult {
  tabs: TabInfo[];
}

export interface EvaluateResult {
  result: unknown;
}
