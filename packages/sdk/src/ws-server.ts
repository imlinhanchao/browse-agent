import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import {
  WSMessage,
  WSPayload,
  CommandPayload,
  CommandResponsePayload,
  signMessage,
  verifyMessage,
  computeHMAC,
  generateNonce,
  generateId,
  TIMESTAMP_TOLERANCE,
  DEFAULT_PORT,
} from '@anthropic/browse-agent-shared';

export interface WSServerOptions {
  port?: number;
  host?: string;
  secret: string;
}

type ResponseResolver = {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class WSServer {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private authenticated = false;
  private secret: string;
  private port: number;
  private host: string;
  private pendingResponses = new Map<string, ResponseResolver>();
  private challenge: string | null = null;
  private onConnected: (() => void) | null = null;
  private onDisconnected: (() => void) | null = null;

  constructor(options: WSServerOptions) {
    this.secret = options.secret;
    this.port = options.port ?? DEFAULT_PORT;
    this.host = options.host ?? '127.0.0.1';
  }

  /**
   * Start the WebSocket server and wait for extension to connect.
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({
        port: this.port,
        host: this.host,
        // Only accept connections from localhost
        verifyClient: (info: { origin: string; req: IncomingMessage }) => {
          const addr = info.req.socket.remoteAddress;
          return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        },
      });

      this.wss.on('listening', () => {
        console.log(`[BrowseAgent SDK] WebSocket server listening on ${this.host}:${this.port}`);
        resolve();
      });

      this.wss.on('error', (err) => {
        reject(err);
      });

      this.wss.on('connection', (ws) => {
        this.handleConnection(ws);
      });
    });
  }

  private handleConnection(ws: WebSocket) {
    // Only allow one client at a time
    if (this.client) {
      ws.close(1013, 'Only one client allowed');
      return;
    }

    console.log('[BrowseAgent SDK] Extension connected, starting auth...');
    this.client = ws;
    this.authenticated = false;

    // Send auth challenge
    this.challenge = generateNonce(32);
    this.sendRaw(ws, {
      type: 'auth',
      challenge: this.challenge,
    });

    ws.on('message', (raw) => {
      this.handleMessage(ws, raw.toString());
    });

    ws.on('close', () => {
      console.log('[BrowseAgent SDK] Extension disconnected');
      this.client = null;
      this.authenticated = false;
      // Reject all pending responses
      for (const [id, pending] of this.pendingResponses) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Connection lost'));
      }
      this.pendingResponses.clear();
      this.onDisconnected?.();
    });

    ws.on('error', (err) => {
      console.error('[BrowseAgent SDK] Client error:', err);
    });
  }

  private async handleMessage(ws: WebSocket, raw: string) {
    let message: WSMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      console.error('[BrowseAgent SDK] Invalid message format');
      return;
    }

    // Verify timestamp freshness
    const now = Date.now();
    if (Math.abs(now - message.timestamp) > TIMESTAMP_TOLERANCE) {
      console.error('[BrowseAgent SDK] Stale message timestamp, possible replay');
      return;
    }

    const { payload } = message;

    // Handle auth response from extension
    if (payload.type === 'authResponse' && this.challenge) {
      const expectedHmac = await computeHMAC(this.secret, this.challenge);
      if (payload.hmac !== expectedHmac) {
        console.error('[BrowseAgent SDK] Authentication failed - invalid HMAC');
        await this.sendRaw(ws, { type: 'authAck', hmac: '', success: false });
        ws.close(1008, 'Authentication failed');
        this.client = null;
        return;
      }

      // Mutual auth: sign the client's challenge back
      const serverHmac = await computeHMAC(this.secret, payload.clientChallenge);
      this.authenticated = true;
      this.challenge = null;

      await this.sendRaw(ws, {
        type: 'authAck',
        hmac: serverHmac,
        success: true,
      });

      console.log('[BrowseAgent SDK] Extension authenticated successfully');
      this.onConnected?.();
      return;
    }

    // All other messages require authentication and valid signature
    if (!this.authenticated) {
      console.error('[BrowseAgent SDK] Message from unauthenticated client');
      return;
    }

    const valid = await verifyMessage(this.secret, message);
    if (!valid) {
      console.error('[BrowseAgent SDK] Invalid message signature');
      return;
    }

    if (payload.type === 'commandResponse') {
      const cmdResp = payload as CommandResponsePayload;
      const requestId = cmdResp.response.requestId;
      const pending = this.pendingResponses.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingResponses.delete(requestId);
        if (cmdResp.response.success) {
          pending.resolve(cmdResp.response.data);
        } else {
          pending.reject(new Error(cmdResp.response.error));
        }
      }
    } else if (payload.type === 'pong') {
      // Keepalive response, nothing to do
    }
  }

  /**
   * Send a command to the extension and wait for response.
   */
  sendCommand<T = unknown>(command: import('@anthropic/browse-agent-shared').Command, timeout = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.authenticated) {
        reject(new Error('Extension not connected or not authenticated'));
        return;
      }

      const requestId = generateId();
      const timer = setTimeout(() => {
        this.pendingResponses.delete(requestId);
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);

      this.pendingResponses.set(requestId, {
        resolve: resolve as (data: unknown) => void,
        reject,
        timer,
      });

      const payload: CommandPayload = { type: 'command', command };
      this.sendSigned(requestId, payload).catch((err) => {
        clearTimeout(timer);
        this.pendingResponses.delete(requestId);
        reject(err);
      });
    });
  }

  private async sendSigned(id: string, payload: WSPayload): Promise<void> {
    if (!this.client) throw new Error('No client connected');

    const timestamp = Date.now();
    const signature = await signMessage(this.secret, id, timestamp, payload);
    const message: WSMessage = { id, timestamp, signature, payload };
    this.client.send(JSON.stringify(message));
  }

  private async sendRaw(ws: WebSocket, payload: WSPayload): Promise<void> {
    const id = generateId();
    const timestamp = Date.now();
    const signature = await signMessage(this.secret, id, timestamp, payload);
    const message: WSMessage = { id, timestamp, signature, payload };
    ws.send(JSON.stringify(message));
  }

  /**
   * Register a callback for when the extension connects and authenticates.
   */
  onExtensionConnected(cb: () => void) {
    this.onConnected = cb;
  }

  /**
   * Register a callback for when the extension disconnects.
   */
  onExtensionDisconnected(cb: () => void) {
    this.onDisconnected = cb;
  }

  get isConnected(): boolean {
    return this.client !== null && this.authenticated;
  }

  /**
   * Stop the server.
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.client?.close();
      this.client = null;
      this.authenticated = false;
      for (const [, pending] of this.pendingResponses) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Server stopped'));
      }
      this.pendingResponses.clear();
      this.wss?.close(() => resolve());
      this.wss = null;
    });
  }
}
