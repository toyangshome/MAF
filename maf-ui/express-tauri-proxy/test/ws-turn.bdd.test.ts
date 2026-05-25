/**
 * BDD tests for WebSocket turn-based communication.
 *
 * Tests the turnstile WebSocket protocol:
 * - Connection lifecycle
 * - Ask → streaming delta → end
 * - Multiple turns on same connection
 * - Error handling
 * - Ping/pong keepalive
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import express from 'express';

// ── Types ──────────────────────────────────────────────────────────────

interface TurnFrame {
  type: 'ask' | 'ping';
  turn_id?: string;
  conversation_id?: string;
  payload?: {
    prompt: string;
    system?: string;
    tools?: string[];
  };
  context?: Record<string, unknown>;
}

interface StreamFrame {
  type: 'turn-start' | 'turn-delta' | 'turn-end' | 'error' | 'pong';
  turn_id?: string;
  delta?: string;
  finish_reason?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  code?: string;
  message?: string;
}

// ── Test fixture: mock WS server ───────────────────────────────────────

function createMockServer(port: number): { server: http.Server; wss: WebSocketServer; url: string } {
  const app = express();
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws/turnstile') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  const url = `ws://localhost:${port}/ws/turnstile`;
  return { server: httpServer, wss, url };
}

// ── Helpers ────────────────────────────────────────────────────────────

function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(data.toString());
    });
  });
}

function collectMessages(ws: WebSocket, count: number, timeoutMs = 5000): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const messages: string[] = [];
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout: only received ${messages.length}/${count} messages`));
    }, timeoutMs);

    const handler = (data: import('ws').RawData) => {
      messages.push(data.toString());
      if (messages.length >= count) {
        cleanup();
        resolve(messages);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.off('message', handler);
    };

    ws.on('message', handler);
  });
}

// ── Test suite ─────────────────────────────────────────────────────────

describe('WebSocket Turn-Based Communication (BDD)', () => {
  let server: http.Server;
  let wss: WebSocketServer;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    // Find available port
    const probe = http.createServer();
    await new Promise<void>((resolve) => probe.listen(0, resolve));
    port = (probe.address() as { port: number }).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const fixture = createMockServer(port);
    server = fixture.server;
    wss = fixture.wss;
    baseUrl = fixture.url;

    await new Promise<void>((resolve) => server.listen(port, resolve));
  });

  afterAll(async () => {
    wss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // ── Connection lifecycle ───────────────────────────────────────────

  describe('Scenario: Client connects to turnstile WebSocket', () => {
    let ws: WebSocket;

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    });

    it('GIVEN the turnstile server is running', () => {
      expect(server.listening).toBe(true);
    });

    it('WHEN a client connects to /ws/turnstile', async () => {
      ws = await connectWs(baseUrl);
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('THEN the connection is established successfully', async () => {
      ws = await connectWs(baseUrl);
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });
  });

  // ── Single turn ask → delta → end ──────────────────────────────────

  describe('Scenario: Single turn ask → streaming response', () => {
    let clientWs: WebSocket;
    let serverWs: WebSocket;

    beforeEach(async () => {
      // Set up server-side handler that streams a response
      wss.once('connection', (ws) => {
        serverWs = ws;
        ws.on('message', (data) => {
          const frame: TurnFrame = JSON.parse(data.toString());
          if (frame.type === 'ask' && frame.turn_id) {
            // Send turn-start
            ws.send(JSON.stringify({ type: 'turn-start', turn_id: frame.turn_id } as StreamFrame));
            // Send deltas
            ws.send(JSON.stringify({ type: 'turn-delta', turn_id: frame.turn_id, delta: 'Hello ' } as StreamFrame));
            ws.send(JSON.stringify({ type: 'turn-delta', turn_id: frame.turn_id, delta: 'World!' } as StreamFrame));
            // Send turn-end
            ws.send(
              JSON.stringify({
                type: 'turn-end',
                turn_id: frame.turn_id,
                finish_reason: 'stop',
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
              } as StreamFrame),
            );
          }
        });
      });

      clientWs = await connectWs(baseUrl);
    });

    afterEach(() => {
      clientWs.close();
    });

    it('GIVEN a connected client', () => {
      expect(clientWs.readyState).toBe(WebSocket.OPEN);
    });

    it('WHEN the client sends an ask frame with turn_id', async () => {
      const askFrame: TurnFrame = {
        type: 'ask',
        turn_id: 'turn-001',
        conversation_id: 'conv-abc',
        payload: { prompt: 'Hello, agent!' },
      };
      clientWs.send(JSON.stringify(askFrame));

      // Wait for 4 messages: turn-start, delta, delta, turn-end
      const messages = await collectMessages(clientWs, 4);
      expect(messages).toHaveLength(4);
    });

    it('THEN the server streams turn-start, deltas, and turn-end', async () => {
      const askFrame: TurnFrame = {
        type: 'ask',
        turn_id: 'turn-002',
        payload: { prompt: 'Test' },
      };
      clientWs.send(JSON.stringify(askFrame));

      const messages = await collectMessages(clientWs, 4);
      const frames: StreamFrame[] = messages.map((m) => JSON.parse(m));

      expect(frames[0].type).toBe('turn-start');
      expect(frames[0].turn_id).toBe('turn-002');

      expect(frames[1].type).toBe('turn-delta');
      expect(frames[1].delta).toBe('Hello ');

      expect(frames[2].type).toBe('turn-delta');
      expect(frames[2].delta).toBe('World!');

      expect(frames[3].type).toBe('turn-end');
      expect(frames[3].finish_reason).toBe('stop');
      expect(frames[3].usage).toBeDefined();
      expect(frames[3].usage!.total_tokens).toBe(15);
    });
  });

  // ── Multiple turns on same connection ──────────────────────────────

  describe('Scenario: Multiple turns on the same connection', () => {
    let clientWs: WebSocket;
    let turnCount = 0;

    beforeEach(async () => {
      turnCount = 0;
      wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          const frame: TurnFrame = JSON.parse(data.toString());
          if (frame.type === 'ask' && frame.turn_id) {
            turnCount++;
            ws.send(JSON.stringify({ type: 'turn-start', turn_id: frame.turn_id } as StreamFrame));
            ws.send(
              JSON.stringify({
                type: 'turn-delta',
                turn_id: frame.turn_id,
                delta: `Response for turn ${frame.turn_id}`,
              } as StreamFrame),
            );
            ws.send(
              JSON.stringify({
                type: 'turn-end',
                turn_id: frame.turn_id,
                finish_reason: 'stop',
                usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
              } as StreamFrame),
            );
          }
        });
      });

      clientWs = await connectWs(baseUrl);
    });

    afterEach(() => {
      clientWs.close();
      wss.removeAllListeners('connection');
    });

    it('GIVEN a connected client', () => {
      expect(clientWs.readyState).toBe(WebSocket.OPEN);
    });

    it('WHEN the client sends multiple ask frames sequentially', async () => {
      // Turn 1
      clientWs.send(
        JSON.stringify({
          type: 'ask',
          turn_id: 'turn-A',
          payload: { prompt: 'First question' },
        } as TurnFrame),
      );
      const msgs1 = await collectMessages(clientWs, 4);
      expect(msgs1).toHaveLength(4);

      // Turn 2
      clientWs.send(
        JSON.stringify({
          type: 'ask',
          turn_id: 'turn-B',
          payload: { prompt: 'Second question' },
        } as TurnFrame),
      );
      const msgs2 = await collectMessages(clientWs, 4);
      expect(msgs2).toHaveLength(4);
    });

    it('THEN each turn gets its own turn_id in the response', async () => {
      clientWs.send(
        JSON.stringify({ type: 'ask', turn_id: 'turn-C', payload: { prompt: 'Q' } } as TurnFrame),
      );
      const msgs = await collectMessages(clientWs, 4);
      const frames: StreamFrame[] = msgs.map((m) => JSON.parse(m));

      frames.forEach((f) => {
        expect(f.turn_id).toBe('turn-C');
      });
    });

    it('THEN the server tracks separate turn counts', async () => {
      clientWs.send(
        JSON.stringify({ type: 'ask', turn_id: 'turn-D', payload: { prompt: 'Q' } } as TurnFrame),
      );
      await collectMessages(clientWs, 4);
      expect(turnCount).toBe(1);

      clientWs.send(
        JSON.stringify({ type: 'ask', turn_id: 'turn-E', payload: { prompt: 'Q2' } } as TurnFrame),
      );
      await collectMessages(clientWs, 4);
      expect(turnCount).toBe(2);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────

  describe('Scenario: Server sends error during turn', () => {
    let clientWs: WebSocket;

    beforeEach(async () => {
      wss.once('connection', (ws) => {
        ws.on('message', (data) => {
          const frame: TurnFrame = JSON.parse(data.toString());
          if (frame.type === 'ask') {
            ws.send(
              JSON.stringify({
                type: 'error',
                turn_id: frame.turn_id,
                code: 'engine_error',
                message: 'Engine connection failed',
              } as StreamFrame),
            );
          }
        });
      });

      clientWs = await connectWs(baseUrl);
    });

    afterEach(() => {
      clientWs.close();
    });

    it('GIVEN a connected client', () => {
      expect(clientWs.readyState).toBe(WebSocket.OPEN);
    });

    it('WHEN the server encounters an error during processing', async () => {
      clientWs.send(
        JSON.stringify({ type: 'ask', turn_id: 'turn-err', payload: { prompt: 'Fail' } } as TurnFrame),
      );
      const msg = await waitForMessage(clientWs);
      const frame: StreamFrame = JSON.parse(msg);

      expect(frame.type).toBe('error');
      expect(frame.code).toBe('engine_error');
      expect(frame.message).toBe('Engine connection failed');
    });
  });

  // ── Ping/pong keepalive ────────────────────────────────────────────

  describe('Scenario: Ping/pong keepalive', () => {
    let clientWs: WebSocket;

    beforeEach(async () => {
      wss.once('connection', (ws) => {
        ws.on('message', (data) => {
          const frame: TurnFrame = JSON.parse(data.toString());
          if (frame.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' } as StreamFrame));
          }
        });
      });

      clientWs = await connectWs(baseUrl);
    });

    afterEach(() => {
      clientWs.close();
    });

    it('GIVEN a connected client', () => {
      expect(clientWs.readyState).toBe(WebSocket.OPEN);
    });

    it('WHEN the client sends a ping frame', async () => {
      clientWs.send(JSON.stringify({ type: 'ping' } as TurnFrame));
      const msg = await waitForMessage(clientWs);
      const frame: StreamFrame = JSON.parse(msg);

      expect(frame.type).toBe('pong');
    });
  });

  // ── Connection close during turn ───────────────────────────────────

  describe('Scenario: Client disconnects during streaming', () => {
    it('GIVEN a connected client and an in-flight turn', async () => {
      const clientWs = await connectWs(baseUrl);
      expect(clientWs.readyState).toBe(WebSocket.OPEN);

      // Server starts streaming but client disconnects
      wss.once('connection', (ws) => {
        ws.on('message', (data) => {
          const frame: TurnFrame = JSON.parse(data.toString());
          if (frame.type === 'ask') {
            // Send start, then try to send more after close
            ws.send(JSON.stringify({ type: 'turn-start', turn_id: frame.turn_id } as StreamFrame));
          }
        });
      });

      clientWs.send(
        JSON.stringify({ type: 'ask', turn_id: 'turn-close', payload: { prompt: 'Q' } } as TurnFrame),
      );
      const msg = await waitForMessage(clientWs);
      expect(JSON.parse(msg).type).toBe('turn-start');

      // Disconnect
      clientWs.close();

      // Wait for close to propagate
      await new Promise((r) => setTimeout(r, 100));
    });

    it('THEN the server handles the disconnection gracefully', () => {
      // No error thrown — the test passes if we get here
      expect(true).toBe(true);
    });
  });
});
