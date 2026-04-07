export { BrowserAgent, type BrowserAgentOptions } from './browser-agent.js';
export { WSServer, type WSServerOptions } from './ws-server.js';
export type {
  Command,
  NavigateCommand,
  GetContentCommand,
  InjectScriptCommand,
  InjectCSSCommand,
  GetDOMCommand,
  ScreenshotCommand,
  ListTabsCommand,
  CloseTabCommand,
  EvaluateCommand,
  NavigateResult,
  ContentResult,
  InjectResult,
  DOMResult,
  ScreenshotResult,
  ListTabsResult,
  TabInfo,
  EvaluateResult,
  CommandResponse,
  SuccessResponse,
  ErrorResponse,
} from 'browse-agent-shared';
export { DEFAULT_PORT } from 'browse-agent-shared';
