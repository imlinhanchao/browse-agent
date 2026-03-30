import {
  WSMessage,
  WSPayload,
  CommandPayload,
  signMessage,
  verifyMessage,
  computeHMAC,
  verifyHMAC,
  generateNonce,
  generateId,
  TIMESTAMP_TOLERANCE,
} from '@anthropic/browse-agent-shared';

type MessageHandler = (payload: CommandPayload, requestId: string) => Promise<void>;

export class WSClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private secret: string;
  private authenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private onCommand: MessageHandler | null = null;
  private pendingChallenge: string | null = null;
  private clientChallenge: string | null = null;

  constructor(serverUrl: string, secret: string) {
    this.serverUrl = serverUrl;
    this.secret = secret;
  }

  setCommandHandler(handler: MessageHandler) {
    this.onCommand = handler;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('[BrowseAgent] WebSocket connected, awaiting auth challenge...');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => this.handleMessage(event.data);

        this.ws.onerror = (err) => {
          console.error('[BrowseAgent] WebSocket error:', err);
          if (!this.authenticated) reject(err);
        };

        this.ws.onclose = () => {
          console.log('[BrowseAgent] WebSocket closed');
          this.authenticated = false;
          this.reconnect();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private async handleMessage(raw: string) {
    let message: WSMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      console.error('[BrowseAgent] Invalid message format');
      return;
    }

    // Verify timestamp freshness to prevent replay attacks
    const now = Date.now();
    if (Math.abs(now - message.timestamp) > TIMESTAMP_TOLERANCE) {
      console.error('[BrowseAgent] Message timestamp too old, possible replay attack');
      return;
    }

    const { payload } = message;

    // Handle auth challenge from server
    if (payload.type === 'auth') {
      this.pendingChallenge = payload.challenge;
      const hmac = await computeHMAC(this.secret, payload.challenge);
      this.clientChallenge = generateNonce(32);

      await this.send({
        type: 'authResponse',
        hmac,
        clientChallenge: this.clientChallenge,
      });
      return;
    }

    // Handle auth acknowledgement
    if (payload.type === 'authAck' as string) {
      const ack = payload as { type: 'authAck'; hmac: string; success: boolean };
      if (ack.success && this.clientChallenge) {
        const valid = await verifyHMAC(this.secret, this.clientChallenge, ack.hmac);
        if (valid) {
          this.authenticated = true;
          console.log('[BrowseAgent] Authenticated successfully (mutual)');
        } else {
          console.error('[BrowseAgent] Server failed mutual authentication');
          this.ws?.close();
        }
      } else {
        console.error('[BrowseAgent] Authentication rejected by server');
        this.ws?.close();
      }
      return;
    }

    // All other messages require authentication and valid signature
    if (!this.authenticated) {
      console.error('[BrowseAgent] Received message before authentication');
      return;
    }

    const validSig = await verifyMessage(this.secret, message);
    if (!validSig) {
      console.error('[BrowseAgent] Invalid message signature');
      return;
    }

    if (payload.type === 'command' && this.onCommand) {
      await this.onCommand(payload, message.id);
    } else if (payload.type === 'ping') {
      await this.send({ type: 'pong' });
    }
  }

  async send(payload: WSPayload): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = generateId();
    const timestamp = Date.now();
    const signature = await signMessage(this.secret, id, timestamp, payload);

    const message: WSMessage = { id, timestamp, signature, payload };
    this.ws.send(JSON.stringify(message));
  }

  async sendResponse(requestId: string, payload: WSPayload): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const timestamp = Date.now();
    const signature = await signMessage(this.secret, requestId, timestamp, payload);

    const message: WSMessage = { id: requestId, timestamp, signature, payload };
    this.ws.send(JSON.stringify(message));
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[BrowseAgent] Max reconnection attempts reached');
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`[BrowseAgent] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect().catch(() => {}), delay);
  }

  disconnect() {
    this.authenticated = false;
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isAuthenticated(): boolean {
    return this.authenticated;
  }
}
