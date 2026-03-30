// ============================================================
// WebSocket Protocol - Wire format for messages
// ============================================================

import type { Command, CommandResponse } from './types.js';

/** Message envelope sent over WebSocket */
export interface WSMessage {
  /** Unique request ID for correlating responses */
  id: string;
  /** Timestamp of the message */
  timestamp: number;
  /** HMAC signature for authentication */
  signature: string;
  /** The payload */
  payload: WSPayload;
}

export type WSPayload =
  | AuthPayload
  | AuthResponsePayload
  | AuthAckPayload
  | CommandPayload
  | CommandResponsePayload
  | PingPayload
  | PongPayload;

// --- Auth ---
export interface AuthPayload {
  type: 'auth';
  /** Challenge nonce from the server */
  challenge: string;
}

export interface AuthResponsePayload {
  type: 'authResponse';
  /** HMAC-SHA256 of the challenge, signed with shared secret */
  hmac: string;
  /** Client-generated nonce for server to sign back (mutual auth) */
  clientChallenge: string;
}

export interface AuthAckPayload {
  type: 'authAck';
  /** Server's HMAC of clientChallenge */
  hmac: string;
  success: boolean;
}

// --- Commands ---
export interface CommandPayload {
  type: 'command';
  command: Command;
}

export interface CommandResponsePayload {
  type: 'commandResponse';
  response: CommandResponse;
}

// --- Keepalive ---
export interface PingPayload {
  type: 'ping';
}

export interface PongPayload {
  type: 'pong';
}

// ============================================================
// Auth Utilities
// ============================================================

/**
 * Compute HMAC-SHA256 using Web Crypto API (works in both
 * service worker and Node.js 18+).
 */
export async function computeHMAC(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify HMAC-SHA256 using constant-time comparison.
 */
export async function verifyHMAC(secret: string, data: string, expectedHex: string): Promise<boolean> {
  const computed = await computeHMAC(secret, data);
  if (computed.length !== expectedHex.length) return false;
  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Sign a WSMessage payload with HMAC.
 */
export async function signMessage(secret: string, id: string, timestamp: number, payload: WSPayload): Promise<string> {
  const data = `${id}:${timestamp}:${JSON.stringify(payload)}`;
  return computeHMAC(secret, data);
}

/**
 * Verify a WSMessage's signature.
 */
export async function verifyMessage(secret: string, message: WSMessage): Promise<boolean> {
  const data = `${message.id}:${message.timestamp}:${JSON.stringify(message.payload)}`;
  return verifyHMAC(secret, data, message.signature);
}

/**
 * Generate a random hex nonce.
 */
export function generateNonce(bytes: number = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a unique request ID.
 */
export function generateId(): string {
  return `${Date.now()}-${generateNonce(8)}`;
}

/** Default WebSocket port */
export const DEFAULT_PORT = 9315;

/** Message timestamp tolerance in ms (5 minutes) */
export const TIMESTAMP_TOLERANCE = 5 * 60 * 1000;
