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
} from 'browse-agent-shared';

export interface WSServerOptions {
  port?: number;
  host?: string;
  secret?: string;
  /** Allow non-localhost connections. When true, binds to 0.0.0.0 and skips the remote-address check. */
  allowRemote?: boolean;
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
  private useSharedSecret: boolean;
  private port: number;
  private host: string;
  private pendingResponses = new Map<string, ResponseResolver>();
  private challenge: string | null = null;
  private onConnected: (() => void) | null = null;
  private onDisconnected: (() => void) | null = null;

  private allowRemote: boolean;

  private formatId(id: string): string {
    if (id.length <= 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  }

  constructor(options: WSServerOptions) {
    this.secret = options.secret ?? '';
    this.useSharedSecret = this.secret.length > 0;
    this.port = options.port ?? DEFAULT_PORT;
    this.allowRemote = options.allowRemote ?? false;
    this.host = options.host ?? (this.allowRemote ? '0.0.0.0' : '127.0.0.1');
  }

  /**
   * Start the WebSocket server and wait for extension to connect.
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({
        port: this.port,
        host: this.host,
        // By default only accept connections from localhost; set allowRemote to lift the restriction.
        verifyClient: this.allowRemote
          ? undefined
          : (info: { origin: string; req: IncomingMessage }) => {
              const addr = info.req.socket.remoteAddress;
              const accepted = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
              if (!accepted) {
                console.warn(`[BrowseAgent SDK] Rejected non-local connection from ${addr ?? 'unknown'}`);
              }
              return accepted;
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
      console.warn('[BrowseAgent SDK] Rejecting additional extension client: already connected');
      ws.close(1013, 'Only one client allowed');
      return;
    }

    console.log('[BrowseAgent SDK] Extension connected, starting auth...');
    this.client = ws;
    this.authenticated = false;

    // Send auth challenge
    this.challenge = generateNonce(32);
    console.log(`[BrowseAgent SDK] Sending auth challenge (${this.challenge.length} hex chars)`);
    this.sendRaw(ws, {
      type: 'auth',
      challenge: this.challenge,
    });

    ws.on('message', (raw) => {
      this.handleMessage(ws, raw.toString());
    });

    ws.on('close', (code, reason) => {
      const reasonText = reason?.toString() || '<empty>';
      console.log(`[BrowseAgent SDK] Extension disconnected (code=${code}, reason=${reasonText})`);
      this.client = null;
      this.authenticated = false;
      // Reject all pending responses
      if (this.pendingResponses.size > 0) {
        console.warn(`[BrowseAgent SDK] Rejecting ${this.pendingResponses.size} pending request(s) due to disconnect`);
      }
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
    console.log(`[BrowseAgent SDK] <- message id=${this.formatId(message.id)} type=${payload.type}`);

    // Handle auth response from extension
    if (payload.type === 'authResponse' && this.challenge) {
      let serverHmac = '';
      if (this.useSharedSecret) {
        console.log('[BrowseAgent SDK] Received auth response, verifying HMAC...');
        const expectedHmac = await computeHMAC(this.secret, this.challenge);
        if (payload.hmac !== expectedHmac) {
          console.error('[BrowseAgent SDK] Authentication failed - invalid HMAC');
          await this.sendRaw(ws, { type: 'authAck', hmac: '', success: false });
          ws.close(1008, 'Authentication failed');
          this.client = null;
          return;
        }

        // Mutual auth: sign the client's challenge back
        serverHmac = await computeHMAC(this.secret, payload.clientChallenge);
      }

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

    const valid = this.useSharedSecret ? await verifyMessage(this.secret, message) : true;
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
          console.log(`[BrowseAgent SDK] <- commandResponse ok requestId=${this.formatId(requestId)}`);
          pending.resolve(cmdResp.response.data);
        } else {
          console.warn(
            `[BrowseAgent SDK] <- commandResponse error requestId=${this.formatId(requestId)} error=${cmdResp.response.error}`
          );
          pending.reject(new Error(cmdResp.response.error));
        }
      } else {
        console.warn(`[BrowseAgent SDK] Received response for unknown requestId=${this.formatId(requestId)}`);
      }
    } else if (payload.type === 'pong') {
      // Keepalive response, nothing to do
      console.log('[BrowseAgent SDK] <- pong');
    }
  }

  /**
   * Send a command to the extension and wait for response.
   */
  sendCommand<T = unknown>(command: import('browse-agent-shared').Command, timeout = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.authenticated) {
        reject(new Error('Extension not connected or not authenticated'));
        return;
      }

      const requestId = generateId();
      console.log(
        `[BrowseAgent SDK] -> command requestId=${this.formatId(requestId)} type=${command.type} timeout=${timeout}ms`
      );
      const timer = setTimeout(() => {
        this.pendingResponses.delete(requestId);
        console.warn(
          `[BrowseAgent SDK] Command timed out requestId=${this.formatId(requestId)} type=${command.type} after ${timeout}ms`
        );
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
    const signature = this.useSharedSecret ? await signMessage(this.secret, id, timestamp, payload) : '';
    const message: WSMessage = { id, timestamp, signature, payload };
    console.log(`[BrowseAgent SDK] -> signed message id=${this.formatId(id)} type=${payload.type}`);
    this.client.send(JSON.stringify(message));
  }

  private async sendRaw(ws: WebSocket, payload: WSPayload): Promise<void> {
    const id = generateId();
    const timestamp = Date.now();
    const signature = this.useSharedSecret ? await signMessage(this.secret, id, timestamp, payload) : '';
    const message: WSMessage = { id, timestamp, signature, payload };
    console.log(`[BrowseAgent SDK] -> raw message id=${this.formatId(id)} type=${payload.type}`);
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
      console.log('[BrowseAgent SDK] Stopping WebSocket server...');
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
